import {
  blockHasType,
  defaultProps,
  editorHasBlockWithType,
  mapTableCell,
  type BlockNoteEditor,
  type TableContent,
} from "@blocknote/core";
import type { FormattingTextAlignment } from "./formattingCapabilities";
import { getSelectedBlocksSafe } from "./selectionBlocks";
import {
  getCellSelectionSafe,
  type CellSelectionInfo,
} from "./tableCellSelection";
import { withPreservedSelection } from "./selectionRestore";

/**
 * Apply text alignment to the current selection.
 * Follows BlockNote TextAlignButton: block props for paragraphs, cell props for tables.
 */
function applyAlignmentToSelection(
  editor: BlockNoteEditor<any, any, any>,
  alignment: FormattingTextAlignment,
  blocks: any[],
  cellSelection: CellSelectionInfo | undefined,
): void {
  for (const block of blocks) {
    if (
      blockHasType(block, editor, block.type, {
        textAlignment: defaultProps.textAlignment,
      }) &&
      editorHasBlockWithType(editor, block.type, {
        textAlignment: defaultProps.textAlignment,
      })
    ) {
      editor.updateBlock(block, {
        props: { textAlignment: alignment },
      });
      continue;
    }

    if (block.type !== "table") continue;

    if (!cellSelection?.cells?.length) continue;

    const content = block.content as TableContent<any, any>;
    if (!content?.rows) continue;

    const newTable = content.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => mapTableCell(cell)),
    }));

    for (const { row, col } of cellSelection.cells) {
      const target = newTable[row]?.cells?.[col];
      if (!target) continue;
      target.props.textAlignment = alignment;
    }

    editor.updateBlock(block, {
      type: "table",
      content: {
        ...content,
        type: "tableContent",
        rows: newTable,
      } as any,
    });
  }
}
export function applySelectionTextAlignment(
  editor: BlockNoteEditor<any, any, any>,
  alignment: FormattingTextAlignment,
): void {
  // transact 回调内读 prosemirrorState 会抛错，选区解析必须先于事务完成
  const blocks = getSelectedBlocksSafe(editor);
  const cellSelection = getCellSelectionSafe(editor);
  withPreservedSelection(editor, () => {
    editor.transact(() => {
      applyAlignmentToSelection(editor, alignment, blocks, cellSelection);
    });
  });
}

/**
 * Clear inline marks / colors and reset text alignment on the selection.
 */
export function clearSelectionFormatting(
  editor: BlockNoteEditor<any, any, any>,
): void {
  const blocks = getSelectedBlocksSafe(editor);
  const cellSelection = getCellSelectionSafe(editor);
  withPreservedSelection(editor, () => {
    editor.transact(() => {
      try {
        editor.removeStyles({
          bold: true,
          italic: true,
          underline: true,
          strike: true,
          code: true,
          textColor: true,
          backgroundColor: true,
        } as any);
      } catch {
        /* ignore */
      }
      applyAlignmentToSelection(editor, "left", blocks, cellSelection);
    });
  });
}
