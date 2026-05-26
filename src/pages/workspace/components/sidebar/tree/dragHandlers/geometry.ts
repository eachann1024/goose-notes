import type { DropIntentKind } from "../useTreeDragHandlers";

const SAME_ROW_BEFORE_RATIO = 0.48;
const SAME_ROW_AFTER_RATIO = 0.52;

export const TOP_EDGE_DROP_ID = "__sidebar-drop-top";
export const BOTTOM_EDGE_DROP_ID = "__sidebar-drop-bottom";

export function getClientYFromActivator(event: Event | null | undefined): number | null {
  if (!event) return null;

  if (event instanceof MouseEvent || event instanceof PointerEvent) {
    return event.clientY;
  }

  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
    const touch = event.touches[0] || event.changedTouches[0];
    return touch?.clientY ?? null;
  }

  return null;
}

export function getClientXFromActivator(event: Event | null | undefined): number | null {
  if (!event) return null;

  if (event instanceof MouseEvent || event instanceof PointerEvent) {
    return event.clientX;
  }

  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
    const touch = event.touches[0] || event.changedTouches[0];
    return touch?.clientX ?? null;
  }

  return null;
}

export function getDragCenterY(
  translatedRect: { top: number; height: number } | null | undefined,
  activatorEvent: Event | null | undefined
): number | null {
  if (translatedRect) {
    return translatedRect.top + translatedRect.height / 2;
  }
  return getClientYFromActivator(activatorEvent);
}

export function getDragCenterX(
  translatedRect: { left: number; width: number } | null | undefined,
  activatorEvent: Event | null | undefined
): number | null {
  if (translatedRect) {
    return translatedRect.left + translatedRect.width / 2;
  }
  return getClientXFromActivator(activatorEvent);
}

export function resolveDropKind(
  activeIndex: number,
  overIndex: number,
  overRect: { top: number; height: number },
  pointerY: number | null,
  previousKind: DropIntentKind | null,
  isNestLocked: boolean
): DropIntentKind {
  if (isNestLocked) {
    return "nest";
  }

  if (activeIndex < overIndex) {
    return "after";
  }
  if (activeIndex > overIndex) {
    return "before";
  }

  let ratio = 0.5;
  if (pointerY !== null) {
    const overHeight = Math.max(overRect.height, 1);
    ratio = (pointerY - overRect.top) / overHeight;
  }
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  if (previousKind === "before" && clampedRatio <= SAME_ROW_AFTER_RATIO + 0.06) {
    return "before";
  }

  if (previousKind === "after" && clampedRatio >= SAME_ROW_BEFORE_RATIO - 0.06) {
    return "after";
  }

  if (clampedRatio < SAME_ROW_BEFORE_RATIO) {
    return "before";
  }
  if (clampedRatio > SAME_ROW_AFTER_RATIO) {
    return "after";
  }

  if (previousKind === "before" || previousKind === "after") {
    return previousKind;
  }
  return activeIndex <= overIndex ? "before" : "after";
}
