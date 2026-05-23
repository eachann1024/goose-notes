import {
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Page } from "@/types";
import { isDescendant, type FlatTreeItem } from "../tree-dnd";

const SAME_ROW_BEFORE_RATIO = 0.48;
const SAME_ROW_AFTER_RATIO = 0.52;
const EDGE_DROP_PADDING = 10;
const DROP_INTENT_STABLE_PADDING = 8;

export const TOP_EDGE_DROP_ID = "__sidebar-drop-top";
export const BOTTOM_EDGE_DROP_ID = "__sidebar-drop-bottom";

export type DropIntentKind = "before" | "after" | "nest";
export type DragGuideDirection = "left" | "right";
export type DragGuideMode = "sort" | "nest-pending" | "nest-ready";

export interface DropIntent {
  overId: string;
  kind: DropIntentKind;
}

export interface SidebarDragGuide {
  direction: DragGuideDirection;
  mode: DragGuideMode;
}

interface UseTreeDragHandlersParams {
  activeDescendantIds: Set<string>;
  allowNest: boolean;
  dropIntent: DropIntent | null;
  emitDragGuide: (guide: SidebarDragGuide | null) => void;
  flatItems: FlatTreeItem[];
  getSiblingPages: (parentId: string | undefined) => Page[];
  isLocalNotebook: boolean;
  itemHeight: number;
  nestHoverDelayMs: number;
  onReorder?: (ids: string[], parentId: string | undefined) => void;
  pages: Record<string, Page>;
  reorderPages: (ids: string[], parentId?: string) => void;
  resetTitleReveal: () => void;
  rightNestEnterOffset: number;
  rightNestExitOffset: number;
  rowHeight: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  setDropIntent: Dispatch<SetStateAction<DropIntent | null>>;
  setOpenPageIds: Dispatch<SetStateAction<Set<string>>>;
  updateNestGuide: (guide: { overId: string; locked: boolean } | null) => void;
  visibleIndexMap: Map<string, number>;
}

function getClientYFromActivator(event: Event | null | undefined): number | null {
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

function getClientXFromActivator(event: Event | null | undefined): number | null {
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

function getDragCenterY(
  translatedRect: { top: number; height: number } | null | undefined,
  activatorEvent: Event | null | undefined
): number | null {
  if (translatedRect) {
    return translatedRect.top + translatedRect.height / 2;
  }
  return getClientYFromActivator(activatorEvent);
}

function getDragCenterX(
  translatedRect: { left: number; width: number } | null | undefined,
  activatorEvent: Event | null | undefined
): number | null {
  if (translatedRect) {
    return translatedRect.left + translatedRect.width / 2;
  }
  return getClientXFromActivator(activatorEvent);
}

function resolveDropKind(
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

export function useTreeDragHandlers({
  activeDescendantIds,
  allowNest,
  dropIntent,
  emitDragGuide,
  flatItems,
  getSiblingPages,
  isLocalNotebook,
  itemHeight,
  nestHoverDelayMs,
  onReorder,
  pages,
  reorderPages,
  resetTitleReveal,
  rightNestEnterOffset,
  rightNestExitOffset,
  rowHeight,
  scrollRef,
  setActiveId,
  setDropIntent,
  setOpenPageIds,
  updateNestGuide,
  visibleIndexMap,
}: UseTreeDragHandlersParams) {
  const autoExpandTimerRef = useRef<number | null>(null);
  const dragPointerYRef = useRef<number | null>(null);
  const dragPointerXRef = useRef<number | null>(null);
  const dragStartPointerXRef = useRef<number | null>(null);
  const dragStartPointerYRef = useRef<number | null>(null);
  const isTrackingPointerRef = useRef(false);
  const nestDelayTimerRef = useRef<number | null>(null);
  const nestCandidateRef = useRef<string | null>(null);
  const lockedNestIdRef = useRef<string | null>(null);
  const rightNestActiveRef = useRef(false);

  const clearAutoExpandTimer = () => {
    if (autoExpandTimerRef.current !== null) {
      window.clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }
  };

  const clearNestDelayTimer = () => {
    if (nestDelayTimerRef.current !== null) {
      window.clearTimeout(nestDelayTimerRef.current);
      nestDelayTimerRef.current = null;
    }
  };

  const handleGlobalPointerMove = useCallback((event: PointerEvent) => {
    dragPointerYRef.current = event.clientY;
    dragPointerXRef.current = event.clientX;
  }, []);

  const handleGlobalTouchMove = useCallback((event: TouchEvent) => {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return;
    dragPointerYRef.current = touch.clientY;
    dragPointerXRef.current = touch.clientX;
  }, []);

  const startPointerTracking = useCallback(() => {
    if (isTrackingPointerRef.current) return;
    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
    window.addEventListener("touchmove", handleGlobalTouchMove, { passive: true });
    isTrackingPointerRef.current = true;
  }, [handleGlobalPointerMove, handleGlobalTouchMove]);

  const stopPointerTracking = useCallback(() => {
    if (!isTrackingPointerRef.current) return;
    window.removeEventListener("pointermove", handleGlobalPointerMove);
    window.removeEventListener("touchmove", handleGlobalTouchMove);
    isTrackingPointerRef.current = false;
  }, [handleGlobalPointerMove, handleGlobalTouchMove]);

  useEffect(() => {
    return () => {
      stopPointerTracking();
      clearNestDelayTimer();
    };
  }, [stopPointerTracking]);

  const autoScrollVertical = (activeRect: { top: number; bottom: number } | null) => {
    const container = scrollRef.current;
    if (!container || !activeRect) return;

    const containerRect = container.getBoundingClientRect();
    const edge = 42;
    const step = 18;

    if (activeRect.top < containerRect.top + edge) {
      container.scrollTop -= step;
      return;
    }

    if (activeRect.bottom > containerRect.bottom - edge) {
      container.scrollTop += step;
    }
  };

  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    resetTitleReveal();
    setActiveId(String(active.id));
    setDropIntent(null);
    updateNestGuide(null);
    clearNestDelayTimer();
    nestCandidateRef.current = null;
    lockedNestIdRef.current = null;
    rightNestActiveRef.current = false;
    startPointerTracking();
    const translatedRect = active.rect.current.translated ?? active.rect.current.initial;
    dragPointerYRef.current =
      getClientYFromActivator(activatorEvent) ??
      getDragCenterY(translatedRect, activatorEvent);
    dragPointerXRef.current =
      getClientXFromActivator(activatorEvent) ??
      getDragCenterX(translatedRect, activatorEvent);
    dragStartPointerXRef.current = dragPointerXRef.current;
    dragStartPointerYRef.current = dragPointerYRef.current;
    emitDragGuide({ direction: "left", mode: "sort" });
  };

  const handleDragMove = ({ active, delta }: DragMoveEvent) => {
    const translatedRect = active.rect.current.translated ?? active.rect.current.initial;
    if (dragStartPointerYRef.current !== null) {
      dragPointerYRef.current = dragStartPointerYRef.current + delta.y;
    } else {
      dragPointerYRef.current = getDragCenterY(translatedRect, undefined);
    }
    if (dragStartPointerXRef.current !== null) {
      dragPointerXRef.current = dragStartPointerXRef.current + delta.x;
    } else {
      dragPointerXRef.current = getDragCenterX(translatedRect, undefined);
    }
    autoScrollVertical(translatedRect);
  };

  const handleDragOver = ({ over, active, activatorEvent }: DragOverEvent) => {
    const translatedRect = active.rect.current.translated ?? active.rect.current.initial;
    const pointerY =
      dragPointerYRef.current ??
      getClientYFromActivator(activatorEvent) ??
      getDragCenterY(translatedRect, activatorEvent);
    const pointerX = dragPointerXRef.current ?? getClientXFromActivator(activatorEvent);

    if (!over) {
      clearNestDelayTimer();
      nestCandidateRef.current = null;
      lockedNestIdRef.current = null;
      rightNestActiveRef.current = false;
      updateNestGuide(null);
      emitDragGuide({ direction: "left", mode: "sort" });
      if (flatItems.length > 0 && pointerY !== null) {
        const containerRect = scrollRef.current?.getBoundingClientRect();
        const firstItem = flatItems[0];
        const lastItem = flatItems[flatItems.length - 1];
        if (containerRect) {
          if (pointerY <= containerRect.top + EDGE_DROP_PADDING) {
            setDropIntent({ overId: firstItem.id, kind: "before" });
            return;
          }
          if (pointerY >= containerRect.bottom - EDGE_DROP_PADDING) {
            setDropIntent({ overId: lastItem.id, kind: "after" });
            return;
          }
        }
      }
      setDropIntent(null);
      return;
    }

    let overItemId = String(over.id);
    const stableAnchorId =
      lockedNestIdRef.current ??
      nestCandidateRef.current ??
      dropIntent?.overId;
    if (
      pointerY !== null &&
      stableAnchorId &&
      overItemId !== TOP_EDGE_DROP_ID &&
      overItemId !== BOTTOM_EDGE_DROP_ID &&
      stableAnchorId !== overItemId &&
      stableAnchorId !== TOP_EDGE_DROP_ID &&
      stableAnchorId !== BOTTOM_EDGE_DROP_ID &&
      scrollRef.current
    ) {
      const currentVisibleIndex = visibleIndexMap.get(stableAnchorId);
      if (currentVisibleIndex !== undefined) {
        const containerRect = scrollRef.current.getBoundingClientRect();
        const currentTop =
          containerRect.top - scrollRef.current.scrollTop + currentVisibleIndex * rowHeight;
        const currentBottom = currentTop + itemHeight;
        if (
          pointerY >= currentTop + DROP_INTENT_STABLE_PADDING &&
          pointerY <= currentBottom - DROP_INTENT_STABLE_PADDING
        ) {
          overItemId = stableAnchorId;
        }
      }
    }

    if (overItemId === TOP_EDGE_DROP_ID) {
      clearNestDelayTimer();
      nestCandidateRef.current = null;
      lockedNestIdRef.current = null;
      rightNestActiveRef.current = false;
      updateNestGuide(null);
      emitDragGuide({ direction: "left", mode: "sort" });
      const firstItem = flatItems[0];
      if (!firstItem) {
        setDropIntent(null);
        return;
      }
      setDropIntent({ overId: firstItem.id, kind: "before" });
      return;
    }

    if (overItemId === BOTTOM_EDGE_DROP_ID) {
      clearNestDelayTimer();
      nestCandidateRef.current = null;
      lockedNestIdRef.current = null;
      rightNestActiveRef.current = false;
      updateNestGuide(null);
      emitDragGuide({ direction: "left", mode: "sort" });
      const lastItem = flatItems[flatItems.length - 1];
      if (!lastItem) {
        setDropIntent(null);
        return;
      }
      setDropIntent({ overId: lastItem.id, kind: "after" });
      return;
    }

    if (activeDescendantIds.has(overItemId)) {
      clearNestDelayTimer();
      nestCandidateRef.current = null;
      lockedNestIdRef.current = null;
      rightNestActiveRef.current = false;
      updateNestGuide(null);
      emitDragGuide({ direction: "left", mode: "sort" });
      setDropIntent(null);
      return;
    }

    const activeIndex = flatItems.findIndex((item) => item.id === String(active.id));
    const overIndex = flatItems.findIndex((item) => item.id === overItemId);
    const overItem = flatItems.find((item) => item.id === overItemId);
    if (!overItem || activeIndex < 0 || overIndex < 0) {
      clearNestDelayTimer();
      nestCandidateRef.current = null;
      lockedNestIdRef.current = null;
      rightNestActiveRef.current = false;
      updateNestGuide(null);
      emitDragGuide({ direction: "left", mode: "sort" });
      setDropIntent(null);
      return;
    }

    if (lockedNestIdRef.current && lockedNestIdRef.current !== overItemId) {
      lockedNestIdRef.current = null;
    }

    const canNest =
      allowNest &&
      !activeDescendantIds.has(overItem.id) &&
      (!isLocalNotebook || !!overItem.page.isFolder);
    const pointerOffsetX =
      pointerX !== null && dragStartPointerXRef.current !== null
        ? pointerX - dragStartPointerXRef.current
        : null;
    const rectOffsetX =
      active.rect.current.initial && translatedRect
        ? translatedRect.left - active.rect.current.initial.left
        : 0;
    const dragOffsetX = pointerOffsetX ?? rectOffsetX;
    const horizontalNestEnabled = canNest && (
      rightNestActiveRef.current
        ? dragOffsetX >= rightNestExitOffset
        : dragOffsetX >= rightNestEnterOffset
    );
    rightNestActiveRef.current = horizontalNestEnabled;

    let overRectForIntent: { top: number; height: number } = {
      top: over.rect.top,
      height: over.rect.height,
    };
    const overVisibleIndex = visibleIndexMap.get(overItemId);
    if (overVisibleIndex !== undefined && scrollRef.current) {
      const containerRect = scrollRef.current.getBoundingClientRect();
      overRectForIntent = {
        top:
          containerRect.top - scrollRef.current.scrollTop + overVisibleIndex * rowHeight,
        height: itemHeight,
      };
    }

    if (horizontalNestEnabled) {
      if (
        nestCandidateRef.current !== overItemId &&
        lockedNestIdRef.current !== overItemId
      ) {
        clearNestDelayTimer();
        nestCandidateRef.current = overItemId;
        updateNestGuide({ overId: overItemId, locked: false });
        nestDelayTimerRef.current = window.setTimeout(() => {
          lockedNestIdRef.current = overItemId;
          updateNestGuide({ overId: overItemId, locked: true });
          setDropIntent((current) => {
            if (!current || current.overId !== overItemId) return current;
            return { overId: overItemId, kind: "nest" };
          });
        }, nestHoverDelayMs);
      } else {
        updateNestGuide({
          overId: overItemId,
          locked: lockedNestIdRef.current === overItemId,
        });
      }
    } else {
      clearNestDelayTimer();
      nestCandidateRef.current = null;
      if (lockedNestIdRef.current === overItemId) {
        lockedNestIdRef.current = null;
      }
      updateNestGuide(null);
    }

    if (horizontalNestEnabled) {
      emitDragGuide({
        direction: "right",
        mode: lockedNestIdRef.current === overItemId ? "nest-ready" : "nest-pending",
      });
    } else {
      emitDragGuide({ direction: "left", mode: "sort" });
    }

    const previousKind =
      dropIntent?.overId === overItemId ? dropIntent.kind : null;
    const kind = resolveDropKind(
      activeIndex,
      overIndex,
      overRectForIntent,
      pointerY,
      previousKind,
      lockedNestIdRef.current === overItemId
    );
    if (dropIntent?.overId === overItemId && dropIntent.kind === kind) {
      return;
    }
    setDropIntent({ overId: overItemId, kind });
  };

  const handleDragEnd = ({ active }: DragEndEvent) => {
    resetTitleReveal();
    clearAutoExpandTimer();
    clearNestDelayTimer();
    nestCandidateRef.current = null;
    lockedNestIdRef.current = null;
    rightNestActiveRef.current = false;
    stopPointerTracking();
    updateNestGuide(null);
    emitDragGuide(null);

    const activeNodeId = String(active.id);
    const fallbackIntent = (() => {
      if (dropIntent) return dropIntent;
      if (flatItems.length === 0) return null;
      const pointerY = dragPointerYRef.current;
      const containerRect = scrollRef.current?.getBoundingClientRect();
      if (pointerY === null || pointerY === undefined || !containerRect) {
        return null;
      }

      const firstItem = flatItems[0];
      const lastItem = flatItems[flatItems.length - 1];
      if (pointerY <= containerRect.top + EDGE_DROP_PADDING) {
        return { overId: firstItem.id, kind: "before" as const };
      }
      if (pointerY >= containerRect.bottom - EDGE_DROP_PADDING) {
        return { overId: lastItem.id, kind: "after" as const };
      }
      return null;
    })();
    const finalIntent = dropIntent ?? fallbackIntent;

    setActiveId(null);
    setDropIntent(null);
    dragPointerYRef.current = null;
    dragPointerXRef.current = null;
    dragStartPointerXRef.current = null;
    dragStartPointerYRef.current = null;

    if (!finalIntent) return;
    const overNodeId = finalIntent.overId;
    if (activeDescendantIds.has(overNodeId)) return;

    const activeItem = flatItems.find((item) => item.id === activeNodeId);
    const overItem = flatItems.find((item) => item.id === overNodeId);
    const activePage = pages[activeNodeId];
    if (!activeItem || !overItem || !activePage) return;

    let nextParentId: string | undefined;
    let nextOrderIds: string[] | null = null;

    if (finalIntent.kind === "nest") {
      const canNestIntoOver =
        overNodeId !== activeNodeId &&
        !isDescendant(activeNodeId, overNodeId, pages) &&
        (!isLocalNotebook || !!overItem.page.isFolder);
      if (!canNestIntoOver) return;

      nextParentId = overNodeId;
      const targetChildren = getSiblingPages(nextParentId)
        .filter((page) => page.id !== activeNodeId);
      nextOrderIds = [...targetChildren, activePage].map((page) => page.id);
    } else {
      nextParentId = overItem.parentId;
      const siblings = getSiblingPages(nextParentId)
        .filter((page) => page.id !== activeNodeId);
      const overSiblingIndex = siblings.findIndex((page) => page.id === overNodeId);
      if (overSiblingIndex < 0) return;

      const insertIndex =
        finalIntent.kind === "after" ? overSiblingIndex + 1 : overSiblingIndex;
      const reordered = [...siblings];
      reordered.splice(insertIndex, 0, activePage);
      nextOrderIds = reordered.map((page) => page.id);
    }

    if (isDescendant(activeNodeId, nextParentId, pages)) {
      return;
    }
    if (isLocalNotebook && nextParentId && !pages[nextParentId]?.isFolder) {
      return;
    }
    if (!nextOrderIds) return;
    const nextIds = nextOrderIds;

    const currentOrder = getSiblingPages(nextParentId).map((page) => page.id);
    if (
      nextParentId === activeItem.parentId &&
      currentOrder.length === nextIds.length &&
      currentOrder.every((id, index) => id === nextIds[index])
    ) {
      return;
    }

    if (onReorder) {
      onReorder(nextIds, nextParentId);
    } else {
      reorderPages(nextIds, nextParentId);
    }

    if (nextParentId) {
      setOpenPageIds((prev) => {
        if (prev.has(nextParentId)) return prev;
        const next = new Set(prev);
        next.add(nextParentId);
        return next;
      });
    }

    if (activeItem.parentId && activeItem.parentId !== nextParentId) {
      const remaining = getSiblingPages(activeItem.parentId).filter(
        (page) => page.id !== activeNodeId,
      );

      if (remaining.length === 0) {
        setOpenPageIds((prev) => {
          if (!prev.has(activeItem.parentId!)) return prev;
          const next = new Set(prev);
          next.delete(activeItem.parentId!);
          return next;
        });
      }
    }
  };

  const handleDragCancel = () => {
    resetTitleReveal();
    clearAutoExpandTimer();
    clearNestDelayTimer();
    nestCandidateRef.current = null;
    lockedNestIdRef.current = null;
    rightNestActiveRef.current = false;
    stopPointerTracking();
    setActiveId(null);
    setDropIntent(null);
    updateNestGuide(null);
    emitDragGuide(null);
    dragPointerYRef.current = null;
    dragPointerXRef.current = null;
    dragStartPointerXRef.current = null;
    dragStartPointerYRef.current = null;
  };

  return {
    handleDragCancel,
    handleDragEnd,
    handleDragMove,
    handleDragOver,
    handleDragStart,
  };
}
