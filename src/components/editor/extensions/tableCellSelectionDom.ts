import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { CellSelection, tableEditingKey } from "prosemirror-tables";
import {
  cellPosFromResolved,
  createTableAwareSelection,
  isSpanningTableSelection,
  tablePosFromResolved,
} from "./tableCellSelectionModel";

export const GRID_CLASS = "goose-table-cell-grid";
export const SPAN_CLASS = "goose-table-span-select";

type DomNodeLike = {
  nodeName?: string;
  parentNode?: DomNodeLike | null;
};

function asDomNodeLike(target: EventTarget | Node | null): DomNodeLike | null {
  if (!target || typeof target !== "object") return null;
  return target as DomNodeLike;
}

export function tableCellFromTarget(
  target: EventTarget | Node | null,
  root?: Node | null,
): HTMLTableCellElement | null {
  let node = asDomNodeLike(target);
  const stop = root ?? null;
  while (node && node !== stop) {
    const name = node.nodeName;
    if (name === "TD" || name === "TH") {
      return node as HTMLTableCellElement;
    }
    node = node.parentNode ?? null;
  }
  return null;
}

export function closestTable(
  cell: HTMLTableCellElement | null,
): HTMLTableElement | null {
  return cell?.closest("table") ?? null;
}

/** True when two pointer targets sit in different TD/TH cells. */
export function isCrossCellPointer(
  startEl: EventTarget | null,
  currentEl: EventTarget | null,
): boolean {
  const startCell = tableCellFromTarget(startEl);
  const currentCell = tableCellFromTarget(currentEl);
  return startCell != null && currentCell != null && startCell !== currentCell;
}

export function cellPosFromDom(
  view: EditorView,
  cell: HTMLTableCellElement,
): number | null {
  try {
    const pos = view.posAtDOM(cell, 0);
    return cellPosFromResolved(view.state.doc.resolve(pos));
  } catch {
    return null;
  }
}

function getDomSelection(view: EditorView): Selection | null {
  const root = view.root as { getSelection?: () => Selection | null };
  return root.getSelection?.() ?? window.getSelection();
}

export function nativeSelectionSpansCells(view: EditorView): boolean {
  const sel = getDomSelection(view);
  if (!sel || sel.isCollapsed) return false;
  const anchorCell = tableCellFromTarget(sel.anchorNode, view.dom);
  const focusCell = tableCellFromTarget(sel.focusNode, view.dom);
  return Boolean(anchorCell && focusCell && anchorCell !== focusCell);
}

export function clearNativeSelection(view: EditorView) {
  getDomSelection(view)?.removeAllRanges();
}

export function eventInsideEditor(view: EditorView, event: Event): boolean {
  const target = event.target;
  return target instanceof Node && view.dom.contains(target);
}

export function tryDispatchCellSelection(
  view: EditorView,
  anchorPos: number,
  headPos: number,
): boolean {
  try {
    const selection = CellSelection.create(view.state.doc, anchorPos, headPos);
    if (!view.state.selection.eq(selection)) {
      view.dispatch(view.state.tr.setSelection(selection));
    }
    return true;
  } catch {
    return false;
  }
}

export function tryDispatchDocSelection(
  view: EditorView,
  anchorPos: number,
  headPos: number,
): boolean {
  try {
    const $anchor = view.state.doc.resolve(anchorPos);
    const $head = view.state.doc.resolve(headPos);
    const selection =
      createTableAwareSelection($anchor, $head) ??
      TextSelection.between($anchor, $head);
    if (view.state.selection.eq(selection)) return true;
    const tr = view.state.tr.setSelection(selection);
    tr.setMeta(tableEditingKey, -1);
    view.dispatch(tr);
    return true;
  } catch {
    return false;
  }
}

function getHitDocument(view: EditorView): Document | ShadowRoot {
  const root = view.root as Document | ShadowRoot | null;
  return root && "elementFromPoint" in root ? root : document;
}

export function cellsFromPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
  startTable: HTMLTableElement | null,
): HTMLTableCellElement | null {
  const doc = getHitDocument(view);
  const stack = doc.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (!el) continue;
    const cell = tableCellFromTarget(el, view.dom);
    if (cell && (!startTable || closestTable(cell) === startTable)) return cell;
  }
  return null;
}

export function coordsPos(view: EditorView, event: MouseEvent): number | null {
  const coords = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });
  return coords?.pos ?? null;
}

export function isDocPosInTable(
  view: EditorView,
  docPos: number,
  tablePos: number | null,
): boolean {
  if (tablePos == null) return false;
  try {
    return tablePosFromResolved(view.state.doc.resolve(docPos)) === tablePos;
  } catch {
    return false;
  }
}

export function syncSelectionClasses(
  view: EditorView,
  draggingCells = false,
  draggingDoc = false,
) {
  const spanning =
    draggingDoc || isSpanningTableSelection(view.state.selection);
  view.dom.classList.toggle(
    GRID_CLASS,
    !spanning &&
      (draggingCells || view.state.selection instanceof CellSelection),
  );
  view.dom.classList.toggle(SPAN_CLASS, spanning);
}
