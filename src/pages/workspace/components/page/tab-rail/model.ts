import { type TabItem } from "@/stores/useTabs";
import { type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";

export function sameFocusedPageMap(
  a: Record<string, string>,
  b: Record<string, string>,
) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

export function tabRailPageId(
  tab: TabItem,
  focusedByTabId: Record<string, string>,
): string {
  if (tab.type === "welcome" || tab.type === "notebook-ai") return tab.pageId;
  return focusedByTabId[tab.id] ?? tab.pageId;
}

export function readDragPointer(event: Event | undefined): {
  screenX: number;
  screenY: number;
  clientX: number;
  clientY: number;
} | null {
  if (!event || typeof event !== "object") return null;
  const rec = event as Partial<PointerEvent>;
  if (
    typeof rec.screenX !== "number" ||
    typeof rec.screenY !== "number" ||
    typeof rec.clientX !== "number" ||
    typeof rec.clientY !== "number"
  ) {
    return null;
  }
  return {
    screenX: rec.screenX,
    screenY: rec.screenY,
    clientX: rec.clientX,
    clientY: rec.clientY,
  };
}

export function dragDelta(event: DragStartEvent | DragMoveEvent): {
  x: number;
  y: number;
} {
  if (!("delta" in event)) return { x: 0, y: 0 };
  return event.delta;
}
