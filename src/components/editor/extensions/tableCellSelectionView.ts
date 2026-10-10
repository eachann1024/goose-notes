import type { EditorView } from "prosemirror-view";
import {
  GRID_CLASS,
  SPAN_CLASS,
  tableCellFromTarget,
  closestTable,
  cellPosFromDom,
  nativeSelectionSpansCells,
  clearNativeSelection,
  eventInsideEditor,
  tryDispatchCellSelection,
  tryDispatchDocSelection,
  cellsFromPoint,
  coordsPos,
  isDocPosInTable,
  syncSelectionClasses,
} from "./tableCellSelectionDom";
import {
  isSpanningTableSelection,
  tablePosFromResolved,
  textSelectionAt,
  shouldTakeOverOutsideTableDrag,
} from "./tableCellSelectionModel";

export function createTableCellSelectionView(view: EditorView) {
  let startCell: HTMLTableCellElement | null = null;
  let startDocPos: number | null = null;
  let startTablePos: number | null = null;
  let lastOutsidePos: number | null = null;
  let draggingCells = false;
  let draggingDoc = false;
  let mouseDown = false;

  const eventRoot: EventTarget =
    (view.root as Document | ShadowRoot | null) ?? window;

  const markCellDragging = () => {
    draggingCells = true;
    draggingDoc = false;
    syncSelectionClasses(view, true, false);
  };

  const markDocDragging = () => {
    draggingCells = false;
    draggingDoc = true;
    syncSelectionClasses(view, false, true);
  };

  const takeOverCellDrag = (
    event: Event,
    currentCell: HTMLTableCellElement,
  ) => {
    if (!startCell) return;
    const mouse = event as MouseEvent;
    mouse.preventDefault();
    mouse.stopPropagation();
    clearNativeSelection(view);
    markCellDragging();
    const startPos = cellPosFromDom(view, startCell);
    const currentPos = cellPosFromDom(view, currentCell);
    if (startPos != null && currentPos != null) {
      tryDispatchCellSelection(view, startPos, currentPos);
    }
  };

  const takeOverDocDrag = (event: Event, headDocPos: number) => {
    if (startDocPos == null) return;
    const mouse = event as MouseEvent;
    mouse.preventDefault();
    mouse.stopPropagation();
    const switching = !draggingDoc;
    if (switching) clearNativeSelection(view);
    markDocDragging();
    tryDispatchDocSelection(view, startDocPos, headDocPos);
  };

  const handlePointerMove = (event: Event) => {
    if (!mouseDown || startDocPos == null) return;
    const mouse = event as MouseEvent;
    const headDocPos = coordsPos(view, mouse);

    if (!startCell) {
      if (headDocPos == null) return;
      const currentTablePos = tablePosFromResolved(
        view.state.doc.resolve(headDocPos),
      );
      // Electron can coalesce fast pointer moves, so the first move after
      // mousedown may already be on the paragraph beyond the table. Detect
      // the crossed table from the document range instead of requiring an
      // intermediate mousemove whose target is inside a cell.
      const spansTable = isSpanningTableSelection(
        textSelectionAt(view.state.doc, startDocPos, headDocPos),
      );
      if (
        !shouldTakeOverOutsideTableDrag(
          draggingDoc,
          currentTablePos,
          spansTable,
        )
      ) {
        return;
      }
      if (!draggingDoc) startTablePos = currentTablePos;
      takeOverDocDrag(event, headDocPos);
      return;
    }

    if (draggingDoc) {
      let outsidePos = headDocPos;
      if (
        outsidePos != null &&
        isDocPosInTable(view, outsidePos, startTablePos)
      ) {
        outsidePos = lastOutsidePos;
      } else if (outsidePos != null) {
        lastOutsidePos = outsidePos;
      }
      if (outsidePos != null) takeOverDocDrag(event, outsidePos);
      return;
    }

    const stillInTable =
      headDocPos != null && isDocPosInTable(view, headDocPos, startTablePos);
    const currentCell = stillInTable
      ? cellsFromPoint(
          view,
          mouse.clientX,
          mouse.clientY,
          closestTable(startCell),
        ) || tableCellFromTarget(mouse.target, view.dom)
      : null;

    if (!stillInTable && headDocPos != null) {
      lastOutsidePos = headDocPos;
      takeOverDocDrag(event, headDocPos);
      return;
    }

    const crossed = currentCell != null && currentCell !== startCell;
    if (!crossed && !nativeSelectionSpansCells(view) && !draggingCells) {
      return;
    }
    if (currentCell) takeOverCellDrag(event, currentCell);
  };

  const onMouseDown = (event: Event) => {
    const mouse = event as MouseEvent;
    if (mouse.button !== 0 || mouse.ctrlKey || mouse.metaKey) return;
    const cell = tableCellFromTarget(mouse.target, view.dom);
    if (!eventInsideEditor(view, event)) {
      startCell = null;
      startDocPos = null;
      startTablePos = null;
      lastOutsidePos = null;
      mouseDown = false;
      draggingCells = false;
      draggingDoc = false;
      return;
    }
    const docPos = coordsPos(view, mouse);
    if (!cell) {
      startCell = null;
      startDocPos = docPos;
      startTablePos = null;
      lastOutsidePos = docPos;
      mouseDown = docPos != null;
      draggingCells = false;
      draggingDoc = false;
      return;
    }
    startCell = cell;
    startDocPos = docPos ?? cellPosFromDom(view, cell);
    startTablePos =
      startDocPos != null
        ? tablePosFromResolved(view.state.doc.resolve(startDocPos))
        : null;
    lastOutsidePos = null;
    mouseDown = true;
    draggingCells = false;
    draggingDoc = false;
  };

  const onDragStart = (event: Event) => {
    if (!startCell || !mouseDown) return;
    if (!eventInsideEditor(view, event) && !draggingDoc) return;
    if (draggingCells || draggingDoc) {
      event.preventDefault();
      handlePointerMove(event);
    }
  };

  const onSelectStart = (event: Event) => {
    if (!draggingCells && !draggingDoc) return;
    event.preventDefault();
  };

  const onMouseUp = () => {
    mouseDown = false;
    startCell = null;
    startDocPos = null;
    startTablePos = null;
    lastOutsidePos = null;
    draggingCells = false;
    draggingDoc = false;
    syncSelectionClasses(view, false, false);
  };

  view.dom.addEventListener("mousedown", onMouseDown, true);
  view.dom.addEventListener("dragstart", onDragStart, true);
  view.dom.addEventListener("selectstart", onSelectStart, true);
  eventRoot.addEventListener("mousemove", handlePointerMove, true);
  eventRoot.addEventListener("dragover", handlePointerMove, true);
  eventRoot.addEventListener("dragstart", onDragStart, true);
  eventRoot.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("mouseup", onMouseUp, true);
  syncSelectionClasses(view, draggingCells, draggingDoc);

  return {
    update() {
      syncSelectionClasses(view, draggingCells, draggingDoc);
    },
    destroy() {
      view.dom.removeEventListener("mousedown", onMouseDown, true);
      view.dom.removeEventListener("dragstart", onDragStart, true);
      view.dom.removeEventListener("selectstart", onSelectStart, true);
      eventRoot.removeEventListener("mousemove", handlePointerMove, true);
      eventRoot.removeEventListener("dragover", handlePointerMove, true);
      eventRoot.removeEventListener("dragstart", onDragStart, true);
      eventRoot.removeEventListener("mouseup", onMouseUp, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      view.dom.classList.remove(GRID_CLASS, SPAN_CLASS);
    },
  };
}
