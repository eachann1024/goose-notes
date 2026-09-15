import type { BlockNoteEditor } from "@blocknote/core";

import {
  getFormattingSelectionMode,
  getSelectedBlocksSafe,
  type FormattingSelectionMode,
} from "@/components/editor/toolbars/formatting/helpers";

export type ToolbarEdgeSide = "top" | "bottom" | "left" | "right";

export type ToolbarReferenceRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

/**
 * Union of selected block DOM boxes. Multi-block text selections often report a
 * PM rect glued to the first block's text; block boxes reflect the full span.
 */
function getSelectedBlocksUnionRect(
  editor: BlockNoteEditor<any, any, any>,
): DOMRect | undefined {
  const root = editor.domElement;
  if (!root) return undefined;

  const blocks = getSelectedBlocksSafe(editor);
  let minTop = Infinity;
  let minLeft = Infinity;
  let maxBottom = -Infinity;
  let maxRight = -Infinity;
  let found = false;

  for (const block of blocks) {
    const id = (block as { id?: string } | null)?.id;
    if (!id) continue;
    const el = root.querySelector(`[data-id="${id}"]`);
    if (!(el instanceof Element)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    found = true;
    minTop = Math.min(minTop, r.top);
    minLeft = Math.min(minLeft, r.left);
    maxBottom = Math.max(maxBottom, r.bottom);
    maxRight = Math.max(maxRight, r.right);
  }

  if (!found) return undefined;
  return new DOMRect(minLeft, minTop, maxRight - minLeft, maxBottom - minTop);
}

/**
 * Floating-toolbar anchor rect for the current formatting selection mode.
 * multiBlock → full selected-blocks bbox (centered above/below the span);
 * other modes → ProseMirror selection bounding box.
 */
export function getFormattingToolbarReferenceRect(
  editor: BlockNoteEditor<any, any, any>,
  mode?: FormattingSelectionMode,
): DOMRect | undefined {
  const resolvedMode = mode ?? getFormattingSelectionMode(editor);
  if (resolvedMode === "none") return undefined;

  if (resolvedMode === "multiBlock") {
    return (
      getSelectedBlocksUnionRect(editor) ?? editor.getSelectionBoundingBox()
    );
  }

  if (resolvedMode === "cellGrid") {
    return (
      getSelectedCellsUnionRect(editor) ?? editor.getSelectionBoundingBox()
    );
  }

  return editor.getSelectionBoundingBox();
}

function isUsableToolbarRect<T extends { width: number; height: number }>(
  rect: T | undefined,
): rect is T {
  return Boolean(rect && (rect.width > 0 || rect.height > 0));
}

/**
 * 拖选时选区会先塌成空：当前锚点暂时没有，沿用上一帧，避免工具栏跳到 0,0
 * 或被 avoid-overlap 隐掉（从而闪出被挡住的上一行）。
 */
export function rememberFormattingToolbarRect<
  T extends { width: number; height: number },
>(rect: T | undefined, last: { current: T | null }, empty: T): T {
  if (isUsableToolbarRect(rect)) {
    last.current = rect;
    return rect;
  }
  return last.current ?? rect ?? empty;
}

function getSelectedCellsUnionRect(
  editor: BlockNoteEditor<any, any, any>,
): DOMRect | undefined {
  const root = editor.domElement;
  if (!root) return undefined;

  const cells = root.querySelectorAll(".selectedCell");
  let minTop = Infinity;
  let minLeft = Infinity;
  let maxBottom = -Infinity;
  let maxRight = -Infinity;
  let found = false;

  for (const cell of cells) {
    if (!(cell instanceof Element)) continue;
    const r = cell.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    found = true;
    minTop = Math.min(minTop, r.top);
    minLeft = Math.min(minLeft, r.left);
    maxBottom = Math.max(maxBottom, r.bottom);
    maxRight = Math.max(maxRight, r.right);
  }

  if (!found) return undefined;
  return new DOMRect(minLeft, minTop, maxRight - minLeft, maxBottom - minTop);
}

/**
 * Collapse a tall multi-block reference to a 1px edge so avoid-overlap
 * middleware can place the toolbar above/below without treating the whole
 * selection height as forbidden space.
 */
export function getMultiBlockToolbarEdgeRect(
  reference: ToolbarReferenceRect,
  preferredSide: ToolbarEdgeSide,
  edgeH = 1,
): ToolbarReferenceRect {
  if (preferredSide === "top") {
    return {
      ...reference,
      bottom: reference.top + edgeH,
      height: edgeH,
    };
  }
  if (preferredSide === "bottom") {
    return {
      ...reference,
      top: reference.bottom - edgeH,
      height: edgeH,
    };
  }
  return reference;
}
