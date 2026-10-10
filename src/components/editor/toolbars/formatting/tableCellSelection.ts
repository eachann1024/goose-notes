import { TableHandlesExtension } from "@blocknote/core/extensions";
import type { BlockNoteEditor } from "@blocknote/core";

/**
 * 选区是否完全落在同一个表格单元格内。
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

export function findAncestorOfRole(
  $pos: any,
  role: "cell" | "row" | "table",
): { depth: number; pos: number } | null {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    const nodeRole = node?.type?.spec?.tableRole;
    const matches =
      nodeRole === role || (role === "cell" && nodeRole === "header_cell");
    if (matches) {
      return { depth: d, pos: $pos.before(d) };
    }
  }
  return null;
}
export type RelativeCell = { row: number; col: number };

export type CellSelectionInfo = {
  from: RelativeCell;
  to: RelativeCell;
  cells: RelativeCell[];
};
/**
 * Resolve table cell indices for the current selection.
 * Prefers TableHandlesExtension; falls back to ProseMirror tableRole walk.
 */
export function getCellSelectionSafe(
  editor: BlockNoteEditor<any, any, any>,
): CellSelectionInfo | undefined {
  try {
    const cellSelection = editor
      .getExtension(TableHandlesExtension)
      ?.getCellSelection();
    if (cellSelection?.cells?.length) return cellSelection;
  } catch {
    /* extension unavailable */
  }

  return resolveCellSelectionFromPm(editor);
}

/**
 * PM fallback when TableHandlesExtension.getCellSelection is unavailable.
 * Uses tableRole ancestors + $pos.index for row/col indices.
 */
function resolveCellSelectionFromPm(
  editor: BlockNoteEditor<any, any, any>,
): CellSelectionInfo | undefined {
  try {
    const { selection } = editor.prosemirrorState;
    const $from = selection.$from;
    const $to = selection.$to;

    if (
      !findAncestorOfRole($from, "cell") ||
      !findAncestorOfRole($to, "cell")
    ) {
      return undefined;
    }

    const indicesAt = ($pos: any): RelativeCell | null => {
      let row = -1;
      let col = -1;
      for (let d = $pos.depth; d > 0; d -= 1) {
        const node = $pos.node(d);
        const role = node.type?.spec?.tableRole;
        if (role === "cell" || role === "header_cell") {
          col = $pos.index(d - 1);
        } else if (role === "row") {
          row = $pos.index(d - 1);
        }
      }
      if (row < 0 || col < 0) return null;
      return { row, col };
    };

    const from = indicesAt($from);
    const to = indicesAt($to);
    if (!from || !to) return undefined;

    const minRow = Math.min(from.row, to.row);
    const maxRow = Math.max(from.row, to.row);
    const minCol = Math.min(from.col, to.col);
    const maxCol = Math.max(from.col, to.col);
    const cells: RelativeCell[] = [];
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        cells.push({ row, col });
      }
    }

    return { from, to, cells };
  } catch {
    return undefined;
  }
}
