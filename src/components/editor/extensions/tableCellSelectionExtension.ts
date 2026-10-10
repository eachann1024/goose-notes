import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { CellSelection, selectedRect } from "prosemirror-tables";
import {
  createTableAwareSelection,
  keepSpanningSelection,
  restoreSpanningSelection,
  promoteCrossCellTextSelection,
} from "./tableCellSelectionModel";
import { createTableCellSelectionView } from "./tableCellSelectionView";
export {
  cellPosFromResolved,
  selectionCrossesTableBoundary,
  isSpanningTableSelection,
  createSelectionLeavingTable,
  createTableAwareSelection,
  promoteCrossCellTextSelection,
  shouldTakeOverOutsideTableDrag,
} from "./tableCellSelectionModel";
export { isCrossCellPointer } from "./tableCellSelectionDom";

/** Derive chrome from the live selection on every transaction, never document attrs. */
function tableCellSelectionDecorations(state: EditorState) {
  if (!(state.selection instanceof CellSelection)) return DecorationSet.empty;
  const { map, tableStart } = selectedRect(state);
  const cells: { pos: number; size: number }[] = [];
  state.selection.forEachCell((node, pos) => {
    cells.push({ pos, size: node.nodeSize });
  });
  const selected = new Set(cells.map(({ pos }) => pos - tableStart));
  const decorations = cells.map(({ pos, size }) => {
    const { top, right, bottom, left } = map.findCell(pos - tableStart);
    const outside = (row: number, col: number) =>
      row < 0 ||
      row >= map.height ||
      col < 0 ||
      col >= map.width ||
      !selected.has(map.map[row * map.width + col]);
    const columns = Array.from({ length: right - left }, (_, i) => left + i);
    const rows = Array.from({ length: bottom - top }, (_, i) => top + i);
    // ponytail: partial merged-cell edges keep fill only; segment strokes need
    // measured DOM geometry, not grid fractions (columns/rows can be unequal).
    const edges = [
      columns.every((col) => outside(top - 1, col)) && "top",
      rows.every((row) => outside(row, right)) && "right",
      columns.every((col) => outside(bottom, col)) && "bottom",
      rows.every((row) => outside(row, left - 1)) && "left",
    ].filter(Boolean);
    return Decoration.node(pos, pos + size, {
      class: edges.map((edge) => `goose-table-selection-${edge}`).join(" "),
    });
  });
  return DecorationSet.create(state.doc, decorations);
}

const PLUGIN_KEY = new PluginKey("goose-table-cell-selection");

const tableCellSelectionPlugin = new Plugin({
  key: PLUGIN_KEY,
  filterTransaction(tr, state) {
    return keepSpanningSelection(tr, state);
  },
  props: {
    decorations: tableCellSelectionDecorations,
    createSelectionBetween(_view, $anchor, $head) {
      return createTableAwareSelection($anchor, $head);
    },
  },
  appendTransaction(trs, _oldState, newState) {
    return (
      restoreSpanningSelection(trs, newState) ??
      promoteCrossCellTextSelection(newState)
    );
  },
  view: createTableCellSelectionView,
});

export const gooseTableCellSelectionExtension = createExtension({
  key: "goose-table-cell-selection",
  prosemirrorPlugins: [tableCellSelectionPlugin],
});
