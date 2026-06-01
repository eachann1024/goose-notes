import { useEditorState } from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";

export const NON_FORMATTABLE_TYPES = new Set([
  "image",
  "file",
  "audio",
  "video",
  "divider",
  "table",
]);

export const BOOLEAN_MARK_NAMES = [
  "bold",
  "italic",
  "strike",
  "underline",
  "code",
] as const;
export type BooleanMarkName = (typeof BOOLEAN_MARK_NAMES)[number];

/**
 * Walk the selection so partial-coverage marks register as inactive.
 * BlockNote's useActiveStyles() only inspects selection.$to which misses ranges.
 */
export function useSelectionMarkStates(editor: BlockNoteEditor<any, any, any>) {
  return useEditorState({
    editor,
    selector: ({ editor }) => {
      const { selection, doc } = editor.prosemirrorState;
      const from = selection.from;
      const to = selection.to;

      const result: Record<BooleanMarkName, boolean> = {
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        code: false,
      };

      if (from === to) {
        const marks = selection.$to.marks();
        for (const name of BOOLEAN_MARK_NAMES) {
          result[name] = marks.some((m: any) => m.type.name === name);
        }
        return result;
      }

      const counts: Record<BooleanMarkName, { with: number; total: number }> = {
        bold: { with: 0, total: 0 },
        italic: { with: 0, total: 0 },
        strike: { with: 0, total: 0 },
        underline: { with: 0, total: 0 },
        code: { with: 0, total: 0 },
      };

      doc.nodesBetween(from, to, (node: any) => {
        if (!node.isText) return true;
        for (const name of BOOLEAN_MARK_NAMES) {
          counts[name].total += 1;
          if (node.marks.some((m: any) => m.type.name === name)) {
            counts[name].with += 1;
          }
        }
        return false;
      });

      for (const name of BOOLEAN_MARK_NAMES) {
        result[name] =
          counts[name].total > 0 && counts[name].with === counts[name].total;
      }
      return result;
    },
  });
}

function selectionTouchesTable(selection: any): boolean {
  const hasTableAncestor = ($pos: any) => {
    if (!$pos) return false;
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.spec?.tableRole) return true;
    }
    return false;
  };

  if (hasTableAncestor(selection.$from) || hasTableAncestor(selection.$to)) {
    return true;
  }

  if (selection.$anchorCell || selection.$headCell) return true;

  let touchesTable = false;
  selection.content?.().content.descendants((node: any) => {
    if (node.type.spec?.tableRole || node.type.name === "table") {
      touchesTable = true;
    }
    return !touchesTable;
  });

  return touchesTable;
}

export function shouldRenderFormattingToolbar(
  editor: BlockNoteEditor<any, any, any>,
) {
  const { selection, doc } = editor.prosemirrorState;

  if (selection.empty) return false;
  if (doc.textBetween(selection.from, selection.to).length === 0) return false;
  // 表格内选区暂不暴露——BlockNote FormattingToolbarController 的 store 和
  // position 选择子在 cell 选择下无法稳定再开（pointerup 链路被 prosemirror-tables
  // 截获，setState 后 useEditorState 也不会重新计算 position）。
  // 走自有 Popover 方案的代价较大，目前保留原行为：表格内编辑直接走右键菜单。
  if (selectionTouchesTable(selection)) return false;

  return true;
}

/**
 * 选区是否完全落在同一个表格单元格内（保留 helper 供未来扩展）。
 */
export function isSelectionInsideSingleCell(selection: any): boolean {
  const $from = selection.$from;
  const $to = selection.$to;
  if (!$from || !$to) return false;
  const fromCell = findAncestorOfRole($from, "cell");
  const toCell = findAncestorOfRole($to, "cell");
  if (!fromCell || !toCell) return false;
  return fromCell.depth === toCell.depth && fromCell.pos === toCell.pos;
}

function findAncestorOfRole(
  $pos: any,
  role: "cell" | "row" | "table",
): { depth: number; pos: number } | null {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node?.type?.spec?.tableRole === role) {
      return { depth: d, pos: $pos.before(d) };
    }
  }
  return null;
}
