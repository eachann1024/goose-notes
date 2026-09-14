import { createExtension } from "@blocknote/core";
import { TextSelection, type EditorState, type Transaction } from "prosemirror-state";
import {
  addRow,
  CellSelection,
  isInTable,
  selectedRect,
  TableMap,
} from "prosemirror-tables";

/**
 * Notion 简易表格：
 * - Enter：跳到同列下一行；已在末行则先加一行再跳过去
 * - Shift+Enter：单元格内换行（hardBreak），不加行
 *
 * BlockNote / ProseMirror 默认 Enter 会尝试 splitBlock，单元格又只收
 * inline，所以回车经常被吞掉、看起来完全没反应。
 */

function caretInCell(tr: Transaction, cellPos: number): Transaction {
  return tr
    .setSelection(TextSelection.near(tr.doc.resolve(cellPos), 1))
    .scrollIntoView();
}

function tableNodeAt(doc: Transaction["doc"], tableStart: number) {
  if (tableStart <= 0) return null;
  const table = doc.nodeAt(tableStart - 1);
  if (!table || table.type.spec.tableRole !== "table") return null;
  return table;
}

export function applyTableEnter(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  if (!isInTable(state)) return false;

  let rect;
  try {
    rect = selectedRect(state);
  } catch {
    return false;
  }

  const targetRow = rect.bottom;
  const targetCol = rect.left;

  if (targetRow < rect.map.height) {
    if (dispatch) {
      const rel = rect.map.positionAt(targetRow, targetCol, rect.table);
      dispatch(caretInCell(state.tr, rect.tableStart + rel));
    }
    return true;
  }

  if (!dispatch) return true;

  let tr = addRow(state.tr, rect, targetRow);
  const mappedTableStart = tr.mapping.map(rect.tableStart);
  const table = tableNodeAt(tr.doc, mappedTableStart);
  if (!table) {
    dispatch(tr);
    return true;
  }

  const map = TableMap.get(table);
  const col = Math.min(Math.max(targetCol, 0), map.width - 1);
  const row = Math.min(targetRow, map.height - 1);
  const rel = map.positionAt(row, col, table);
  dispatch(caretInCell(tr, mappedTableStart + rel));
  return true;
}

export function applyTableShiftEnter(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  if (!isInTable(state)) return false;

  const hardBreak = state.schema.nodes.hardBreak;
  if (!dispatch) return true;

  let tr = state.tr;
  if (state.selection instanceof CellSelection) {
    try {
      const rect = selectedRect(state);
      const rel = rect.map.positionAt(rect.top, rect.left, rect.table);
      tr = caretInCell(tr, rect.tableStart + rel);
    } catch {
      return false;
    }
  }

  if (hardBreak) {
    const $from = tr.selection.$from;
    if ($from.parent.canReplaceWith($from.index(), $from.index(), hardBreak)) {
      dispatch(tr.replaceSelectionWith(hardBreak.create()).scrollIntoView());
      return true;
    }
  }

  dispatch(tr.insertText("\n").scrollIntoView());
  return true;
}

export const gooseTableEnterExtension = createExtension({
  key: "goose-table-enter",
  // 抢在默认 splitBlock 之前，否则单元格里 Enter 会被吞掉却什么都不做。
  runsBefore: ["default"],
  keyboardShortcuts: {
    Enter: ({ editor }) => {
      const view = editor.prosemirrorView;
      if (!view) return false;
      return applyTableEnter(view.state, view.dispatch);
    },
    "Shift-Enter": ({ editor }) => {
      const view = editor.prosemirrorView;
      if (!view) return false;
      return applyTableShiftEnter(view.state, view.dispatch);
    },
  },
});
