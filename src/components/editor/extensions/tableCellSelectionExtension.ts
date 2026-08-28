import { createExtension } from "@blocknote/core";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
} from "prosemirror-state";
import type { ResolvedPos } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { CellSelection } from "prosemirror-tables";

const GRID_CLASS = "goose-table-cell-grid";

export function cellPosFromResolved($pos: ResolvedPos): number | null {
  for (let d = $pos.depth; d > 0; d -= 1) {
    const role = $pos.node(d).type.spec?.tableRole;
    if (role === "cell" || role === "header_cell") return $pos.before(d);
  }
  return null;
}

export function promoteCrossCellTextSelection(state: EditorState) {
  const sel = state.selection;
  if (!(sel instanceof TextSelection) || sel.empty) return null;
  const anchorCell = cellPosFromResolved(sel.$anchor);
  const headCell = cellPosFromResolved(sel.$head);
  if (anchorCell == null || headCell == null || anchorCell === headCell) {
    return null;
  }
  return state.tr.setSelection(
    CellSelection.create(state.doc, anchorCell, headCell),
  );
}

type DomNodeLike = {
  nodeName?: string;
  parentNode?: DomNodeLike | null;
};

function asDomNodeLike(target: EventTarget | Node | null): DomNodeLike | null {
  if (!target || typeof target !== "object") return null;
  return target as DomNodeLike;
}

function tableCellFromTarget(
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

/** True when two pointer targets sit in different TD/TH cells. */
export function isCrossCellPointer(
  startEl: EventTarget | null,
  currentEl: EventTarget | null,
): boolean {
  const startCell = tableCellFromTarget(startEl);
  const currentCell = tableCellFromTarget(currentEl);
  return startCell != null && currentCell != null && startCell !== currentCell;
}

function cellPosFromDom(
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

function nativeSelectionSpansCells(view: EditorView): boolean {
  const sel = getDomSelection(view);
  if (!sel || sel.isCollapsed) return false;
  const anchorCell = tableCellFromTarget(sel.anchorNode, view.dom);
  const focusCell = tableCellFromTarget(sel.focusNode, view.dom);
  return Boolean(anchorCell && focusCell && anchorCell !== focusCell);
}

function clearNativeSelection(view: EditorView) {
  getDomSelection(view)?.removeAllRanges();
}

function eventInsideEditor(view: EditorView, event: Event): boolean {
  const target = event.target;
  return target instanceof Node && view.dom.contains(target);
}

function tryDispatchCellSelection(
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

function promoteFromPointerOrSelection(
  view: EditorView,
  startCell: HTMLTableCellElement | null,
  currentTarget: EventTarget | null,
): boolean {
  if (view.state.selection instanceof CellSelection) return true;
  const promoteTr = promoteCrossCellTextSelection(view.state);
  if (promoteTr) {
    view.dispatch(promoteTr);
    return true;
  }
  const currentCell = tableCellFromTarget(currentTarget, view.dom);
  if (!startCell || !currentCell || startCell === currentCell) return false;
  const startPos = cellPosFromDom(view, startCell);
  const currentPos = cellPosFromDom(view, currentCell);
  if (startPos == null || currentPos == null) return false;
  return tryDispatchCellSelection(view, startPos, currentPos);
}

function cellFromPoint(
  view: EditorView,
  event: MouseEvent,
): HTMLTableCellElement | null {
  const root = view.root as Document | ShadowRoot | null;
  const doc = root && "elementFromPoint" in root ? root : document;
  const el = doc.elementFromPoint(event.clientX, event.clientY);
  return tableCellFromTarget(el, view.dom);
}

function syncGridClass(view: EditorView, draggingCells = false) {
  view.dom.classList.toggle(
    GRID_CLASS,
    draggingCells || view.state.selection instanceof CellSelection,
  );
}

const PLUGIN_KEY = new PluginKey("goose-table-cell-selection");

const tableCellSelectionPlugin = new Plugin({
  key: PLUGIN_KEY,
  props: {
    createSelectionBetween(_view, $anchor, $head) {
      const anchorCell = cellPosFromResolved($anchor);
      const headCell = cellPosFromResolved($head);
      if (anchorCell == null || headCell == null || anchorCell === headCell) {
        return null;
      }
      return CellSelection.create(_view.state.doc, anchorCell, headCell);
    },
  },
  appendTransaction(_trs, _oldState, newState) {
    return promoteCrossCellTextSelection(newState);
  },
  view(view) {
    let startCell: HTMLTableCellElement | null = null;
    let draggingCells = false;
    let mouseDown = false;

    const eventRoot: EventTarget =
      (view.root as Document | ShadowRoot | null) ?? window;

    const markDragging = () => {
      draggingCells = true;
      syncGridClass(view, true);
    };

    const handlePointerMove = (event: Event) => {
      if (!mouseDown || !startCell) return;
      const mouse = event as MouseEvent;
      const currentCell =
        cellFromPoint(view, mouse) ||
        tableCellFromTarget(mouse.target, view.dom);
      const crossed = currentCell != null && currentCell !== startCell;
      const nativeCross = nativeSelectionSpansCells(view);
      if (!crossed && !nativeCross) return;
      mouse.preventDefault();
      mouse.stopPropagation();
      clearNativeSelection(view);
      markDragging();
      if (crossed && currentCell) {
        const startPos = cellPosFromDom(view, startCell);
        const currentPos = cellPosFromDom(view, currentCell);
        if (startPos != null && currentPos != null) {
          tryDispatchCellSelection(view, startPos, currentPos);
        }
      } else {
        promoteFromPointerOrSelection(
          view,
          startCell,
          currentCell || mouse.target,
        );
      }
    };

    const onMouseDown = (event: Event) => {
      const mouse = event as MouseEvent;
      if (mouse.button !== 0 || mouse.ctrlKey || mouse.metaKey) return;
      const cell = tableCellFromTarget(mouse.target, view.dom);
      if (!cell || !view.dom.contains(cell)) {
        startCell = null;
        mouseDown = false;
        draggingCells = false;
        return;
      }
      startCell = cell;
      mouseDown = true;
      draggingCells = false;
    };

    const onDragStart = (event: Event) => {
      if (!startCell || !mouseDown) return;
      if (!eventInsideEditor(view, event)) return;
      const mouse = event as MouseEvent;
      const currentCell =
        cellFromPoint(view, mouse) ||
        tableCellFromTarget(mouse.target, view.dom);
      const shouldBlock =
        draggingCells ||
        (currentCell != null && currentCell !== startCell) ||
        nativeSelectionSpansCells(view);
      if (!shouldBlock) return;
      event.preventDefault();
      clearNativeSelection(view);
      handlePointerMove(event);
    };

    const onMouseUp = () => {
      mouseDown = false;
      startCell = null;
      draggingCells = false;
      syncGridClass(view, false);
    };

    view.dom.addEventListener("mousedown", onMouseDown, true);
    view.dom.addEventListener("dragstart", onDragStart, true);
    eventRoot.addEventListener("mousemove", handlePointerMove, true);
    eventRoot.addEventListener("dragover", handlePointerMove, true);
    eventRoot.addEventListener("dragstart", onDragStart, true);
    eventRoot.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("mouseup", onMouseUp, true);
    syncGridClass(view, draggingCells);

    return {
      update() {
        syncGridClass(view, draggingCells);
      },
      destroy() {
        view.dom.removeEventListener("mousedown", onMouseDown, true);
        view.dom.removeEventListener("dragstart", onDragStart, true);
        eventRoot.removeEventListener("mousemove", handlePointerMove, true);
        eventRoot.removeEventListener("dragover", handlePointerMove, true);
        eventRoot.removeEventListener("dragstart", onDragStart, true);
        eventRoot.removeEventListener("mouseup", onMouseUp, true);
        window.removeEventListener("mouseup", onMouseUp, true);
        view.dom.classList.remove(GRID_CLASS);
      },
    };
  },
});

export const gooseTableCellSelectionExtension = createExtension({
  key: "goose-table-cell-selection",
  prosemirrorPlugins: [tableCellSelectionPlugin],
});
