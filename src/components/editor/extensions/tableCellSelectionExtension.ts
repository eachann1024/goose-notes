import { createExtension } from "@blocknote/core";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "prosemirror-state";
import type { ResolvedPos } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import {
  CellSelection,
  inSameTable,
  tableEditingKey,
} from "prosemirror-tables";

const GRID_CLASS = "goose-table-cell-grid";
const SPAN_CLASS = "goose-table-span-select";

export function cellPosFromResolved($pos: ResolvedPos): number | null {
  for (let d = $pos.depth; d > 0; d -= 1) {
    const role = $pos.node(d).type.spec?.tableRole;
    if (role === "cell" || role === "header_cell") return $pos.before(d);
  }
  return null;
}

function findTableDepth($pos: ResolvedPos): number {
  for (let d = $pos.depth; d > 0; d -= 1) {
    if ($pos.node(d).type.spec?.tableRole === "table") return d;
  }
  return -1;
}

function tablePosFromResolved($pos: ResolvedPos): number | null {
  const depth = findTableDepth($pos);
  return depth >= 0 ? $pos.before(depth) : null;
}

function blockContainerRangeAroundTable(
  $pos: ResolvedPos,
): { from: number; to: number } | null {
  const tableDepth = findTableDepth($pos);
  if (tableDepth < 0) return null;
  for (let d = tableDepth; d > 0; d -= 1) {
    if ($pos.node(d).type.name === "blockContainer") {
      return { from: $pos.before(d), to: $pos.after(d) };
    }
  }
  const tablePos = $pos.before(tableDepth);
  return {
    from: tablePos,
    to: tablePos + $pos.node(tableDepth).nodeSize,
  };
}

function textSelectionAt(
  doc: ResolvedPos["doc"],
  anchor: number,
  head: number,
) {
  try {
    return TextSelection.create(doc, anchor, head);
  } catch {
    return TextSelection.between(doc.resolve(anchor), doc.resolve(head));
  }
}

/** 一端在表格内、另一端在表外（或另一张表）时，选区已经跨出表格。 */
export function selectionCrossesTableBoundary(
  $a: ResolvedPos,
  $b: ResolvedPos,
): boolean {
  const aTable = tablePosFromResolved($a);
  const bTable = tablePosFromResolved($b);
  if (aTable == null && bTable == null) return false;
  return aTable !== bTable;
}

export function isSpanningTableSelection(
  sel: { empty?: boolean; $anchor: ResolvedPos; $head: ResolvedPos },
): boolean {
  if (sel.empty) return false;
  if (selectionCrossesTableBoundary(sel.$anchor, sel.$head)) return true;
  if (!(sel instanceof TextSelection)) return false;

  // 两端都在表格外时，选区仍可能完整跨过中间的表格块。
  // 两端位于同一张表格时则保留原有单元格选区行为。
  if (
    tablePosFromResolved(sel.$anchor) != null ||
    tablePosFromResolved(sel.$head) != null
  ) {
    return false;
  }

  const from = Math.min(sel.$anchor.pos, sel.$head.pos);
  const to = Math.max(sel.$anchor.pos, sel.$head.pos);
  let containsTable = false;
  sel.$anchor.doc.nodesBetween(from, to, (node) => {
    if (node.type.spec?.tableRole !== "table") return !containsTable;
    containsTable = true;
    return false;
  });
  return containsTable;
}

export function createSelectionLeavingTable(
  $inTable: ResolvedPos,
  $outside: ResolvedPos,
  inTableIsAnchor = true,
) {
  const range = blockContainerRangeAroundTable($inTable);
  if (!range) {
    return inTableIsAnchor
      ? TextSelection.between($inTable, $outside)
      : TextSelection.between($outside, $inTable);
  }
  const doc = $inTable.doc;
  if ($outside.pos <= range.from) {
    const tableEnd = TextSelection.near(doc.resolve(range.to), -1).head;
    return textSelectionAt(
      doc,
      inTableIsAnchor ? tableEnd : $outside.pos,
      inTableIsAnchor ? $outside.pos : tableEnd,
    );
  }
  if ($outside.pos >= range.to) {
    const tableStart = TextSelection.near(doc.resolve(range.from), 1).head;
    return textSelectionAt(
      doc,
      inTableIsAnchor ? tableStart : $outside.pos,
      inTableIsAnchor ? $outside.pos : tableStart,
    );
  }
  return null;
}

export function createTableAwareSelection(
  $anchor: ResolvedPos,
  $head: ResolvedPos,
) {
  const anchorCell = cellPosFromResolved($anchor);
  const headCell = cellPosFromResolved($head);
  if (
    anchorCell != null &&
    headCell != null &&
    anchorCell !== headCell &&
    sameTableCells($anchor.doc, anchorCell, headCell)
  ) {
    return CellSelection.create($anchor.doc, anchorCell, headCell);
  }
  if (!selectionCrossesTableBoundary($anchor, $head)) return null;
  const anchorInTable = tablePosFromResolved($anchor) != null;
  const inTable = anchorInTable ? $anchor : $head;
  const outside = inTable === $anchor ? $head : $anchor;
  return createSelectionLeavingTable(inTable, outside, anchorInTable);
}

function sameTableCells(
  doc: ResolvedPos["doc"],
  aPos: number,
  bPos: number,
): boolean {
  try {
    return inSameTable(doc.resolve(aPos), doc.resolve(bPos));
  } catch {
    return false;
  }
}

export function promoteCrossCellTextSelection(state: EditorState) {
  const sel = state.selection;
  if (!(sel instanceof TextSelection) || sel.empty) return null;
  if (isSpanningTableSelection(sel)) return null;
  const anchorCell = cellPosFromResolved(sel.$anchor);
  const headCell = cellPosFromResolved(sel.$head);
  if (anchorCell == null || headCell == null || anchorCell === headCell) {
    return null;
  }
  return state.tr.setSelection(
    CellSelection.create(state.doc, anchorCell, headCell),
  );
}

function restoreSpanningSelection(
  trs: readonly Transaction[],
  newState: EditorState,
) {
  for (let i = trs.length - 1; i >= 0; i -= 1) {
    const sel = trs[i].selection;
    if (!isSpanningTableSelection(sel)) continue;
    if (newState.selection.eq(sel)) return null;
    return newState.tr.setSelection(sel);
  }
  return null;
}

function keepSpanningSelection(tr: Transaction, state: EditorState) {
  if (!tr.selectionSet || !isSpanningTableSelection(state.selection)) {
    return true;
  }
  const next = tr.selection;
  if (isSpanningTableSelection(next) || next.empty) return true;
  if (next instanceof CellSelection) return false;
  if (
    next instanceof NodeSelection &&
    next.node.type.spec?.tableRole === "table"
  ) {
    return false;
  }
  return !(next instanceof TextSelection);
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

function closestTable(cell: HTMLTableCellElement | null): HTMLTableElement | null {
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

function tryDispatchDocSelection(
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

function cellsFromPoint(
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

function coordsPos(view: EditorView, event: MouseEvent): number | null {
  const coords = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });
  return coords?.pos ?? null;
}

function isDocPosInTable(
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

/** 表外拖选命中或跨过表格后接管，普通文本拖选继续使用原生行为。 */
export function shouldTakeOverOutsideTableDrag(
  draggingDoc: boolean,
  currentTablePos: number | null,
  spansTable = false,
): boolean {
  return draggingDoc || currentTablePos != null || spansTable;
}

function syncSelectionClasses(
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

const PLUGIN_KEY = new PluginKey("goose-table-cell-selection");

const tableCellSelectionPlugin = new Plugin({
  key: PLUGIN_KEY,
  filterTransaction(tr, state) {
    return keepSpanningSelection(tr, state);
  },
  props: {
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
  view(view) {
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
  },
});

export const gooseTableCellSelectionExtension = createExtension({
  key: "goose-table-cell-selection",
  prosemirrorPlugins: [tableCellSelectionPlugin],
});
