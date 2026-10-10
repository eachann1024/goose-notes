import {
  blockHasType,
  defaultProps,
  mapTableCell,
  type BlockNoteEditor,
  type TableContent,
} from "@blocknote/core";
import { CellSelection } from "prosemirror-tables";
import {
  getSelectedBlocksSafe,
  dropBlocksWithoutSelectedContent,
  collectSelectedContentBlockIds,
} from "./selectionBlocks";
import {
  getCellSelectionSafe,
  isSelectionInsideSingleCell,
  findAncestorOfRole,
} from "./tableCellSelection";

export type FormattingSelectionMode =
  | "none"
  | "cellText" // text selection touching table (single continuous text range inside table)
  | "cellGrid" // prosemirror-tables CellSelection (multi-cell grid)
  | "singleBlock" // one non-table block
  | "multiBlock"; // ≥2 blocks

export type FormattingTextAlignment = "left" | "center" | "right";

export interface FormattingToolbarCapabilities {
  mode: FormattingSelectionMode;
  showMarks: boolean; // bold/italic/strike/underline/code
  showColors: boolean;
  showLink: boolean;
  showAlign: boolean;
  showAi: boolean; // presence of extractable text; AI enabled is UI concern
  showClear: boolean;
  textAlignment: FormattingTextAlignment;
}
/** 选区是否触及表格（tableRole 或 type.name === "table"）。 */
function selectionTouchesTable(selection: { $from: any; $to: any }): boolean {
  if (findAncestorOfRole(selection.$from, "table")) return true;
  if (findAncestorOfRole(selection.$to, "table")) return true;
  for (const $pos of [selection.$from, selection.$to]) {
    for (let d = $pos.depth; d > 0; d -= 1) {
      if ($pos.node(d)?.type?.name === "table") return true;
    }
  }
  return false;
}
function blockSupportsTextAlignment(
  editor: BlockNoteEditor<any, any, any>,
  block: any,
): boolean {
  if (!block) return false;
  try {
    return blockHasType(block, editor, block.type, {
      textAlignment: defaultProps.textAlignment,
    });
  } catch {
    return false;
  }
}

function normalizeTextAlignment(value: unknown): FormattingTextAlignment {
  if (value === "center" || value === "right" || value === "left") {
    return value;
  }
  return "left";
}

/**
 * 是否应显示对齐控件：
 * - 无任何选中块支持 textAlignment，且无表格单元格选区 → false
 * - 表格无 getCellSelection() 且无块级 textAlignment → false
 */
export function canShowAlign(editor: BlockNoteEditor<any, any, any>): boolean {
  const blocks = getSelectedBlocksSafe(editor);
  const cellSelection = getCellSelectionSafe(editor);

  let anySupports = false;
  let hasTable = false;
  for (const block of blocks) {
    if (blockSupportsTextAlignment(editor, block)) {
      anySupports = true;
      break;
    }
    if (block?.type === "table") {
      hasTable = true;
    }
  }

  if (anySupports) return true;
  if (hasTable && cellSelection) return true;
  if (
    cellSelection &&
    selectionTouchesTable(editor.prosemirrorState.selection)
  ) {
    return true;
  }
  return false;
}

export function getFormattingSelectionMode(
  editor: BlockNoteEditor<any, any, any>,
): FormattingSelectionMode {
  const { selection, doc } = editor.prosemirrorState;

  if (selection.empty) return "none";
  if (doc.textBetween(selection.from, selection.to).length === 0) {
    return "none";
  }

  if (selection instanceof CellSelection) {
    return "cellGrid";
  }

  if (selectionTouchesTable(selection)) {
    return isSelectionInsideSingleCell(selection) ? "cellText" : "cellGrid";
  }

  let blockCount: number;
  try {
    blockCount = dropBlocksWithoutSelectedContent(
      editor,
      editor.getSelection()?.blocks ?? [],
    ).length;
  } catch {
    blockCount = 0;
  }
  if (blockCount <= 1) {
    // getSelection 在 AllSelection / 部分 PM 选区可能为空；回退 safe + 容器计数
    const safeCount = getSelectedBlocksSafe(editor).length;
    blockCount = Math.max(blockCount, safeCount);
  }
  if (blockCount <= 1) {
    blockCount = Math.max(
      blockCount,
      collectSelectedContentBlockIds(editor).size,
    );
  }

  if (blockCount > 1) return "multiBlock";
  return "singleBlock";
}

/**
 * 读取当前选区文字对齐（块级 props 或表格选中单元格）。
 * 对齐算法对齐 BlockNote TextAlignButton；表格优先首个选中单元格。
 */
export function getSelectionTextAlignment(
  editor: BlockNoteEditor<any, any, any>,
): FormattingTextAlignment {
  const blocks = getSelectedBlocksSafe(editor);
  const first = blocks[0];
  if (!first) return "left";

  if (blockSupportsTextAlignment(editor, first)) {
    return normalizeTextAlignment(
      (first.props as { textAlignment?: string } | undefined)?.textAlignment,
    );
  }

  if (first.type === "table") {
    const cellSel = getCellSelectionSafe(editor);
    const content = first.content as TableContent<any, any> | undefined;
    if (cellSel && content?.rows) {
      const anchor = cellSel.cells[0] ?? cellSel.from;
      const raw = content.rows[anchor.row]?.cells?.[anchor.col];
      if (raw != null) {
        const cell = mapTableCell(raw);
        return normalizeTextAlignment(cell.props.textAlignment);
      }
    }
    return "left";
  }

  return "left";
}

export function getFormattingToolbarCapabilities(
  editor: BlockNoteEditor<any, any, any>,
  options?: { isInHeading?: boolean },
): FormattingToolbarCapabilities {
  const mode = getFormattingSelectionMode(editor);
  const isInHeading = Boolean(options?.isInHeading);
  const textAlignment = getSelectionTextAlignment(editor);

  if (mode === "none") {
    return {
      mode,
      showMarks: false,
      showColors: false,
      showLink: false,
      showAlign: false,
      showAi: false,
      showClear: false,
      textAlignment,
    };
  }

  if (mode === "cellText") {
    return {
      mode,
      showMarks: !isInHeading,
      showColors: true,
      showLink: true,
      showAlign: true,
      showAi: true,
      showClear: true,
      textAlignment,
    };
  }

  if (mode === "cellGrid") {
    return {
      mode,
      showMarks: !isInHeading,
      showColors: true,
      showLink: false,
      showAlign: true,
      showAi: true,
      showClear: true,
      textAlignment,
    };
  }

  if (mode === "singleBlock") {
    return {
      mode,
      showMarks: !isInHeading,
      showColors: true,
      showLink: true,
      showAlign: canShowAlign(editor),
      showAi: true,
      showClear: true,
      textAlignment,
    };
  }

  // multiBlock
  return {
    mode,
    showMarks: !isInHeading,
    showColors: true,
    showLink: false,
    showAlign: canShowAlign(editor),
    showAi: true,
    showClear: true,
    textAlignment,
  };
}
