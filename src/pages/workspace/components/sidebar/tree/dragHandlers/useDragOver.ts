import { type Dispatch, type RefObject, type SetStateAction, type MutableRefObject } from "react";
import type { DragOverEvent } from "@dnd-kit/core";
import type { FlatTreeItem } from "../../tree-dnd";
import type { DropIntent, SidebarDragGuide } from "../useTreeDragHandlers";
import {
  getClientXFromActivator,
  getClientYFromActivator,
  getDragCenterX,
  getDragCenterY,
  resolveDropKind,
  TOP_EDGE_DROP_ID,
  BOTTOM_EDGE_DROP_ID,
} from "./geometry";

const EDGE_DROP_PADDING = 10;
const DROP_INTENT_STABLE_PADDING = 8;

interface UseDragOverParams {
  dragPointerYRef: MutableRefObject<number | null>;
  dragPointerXRef: MutableRefObject<number | null>;
  dragStartPointerXRef: MutableRefObject<number | null>;
  lockedNestIdRef: MutableRefObject<string | null>;
  nestCandidateRef: MutableRefObject<string | null>;
  rightNestActiveRef: MutableRefObject<boolean>;
  nestDelayTimerRef: MutableRefObject<number | null>;
  dropIntent: DropIntent | null;
  setDropIntent: Dispatch<SetStateAction<DropIntent | null>>;
  updateNestGuide: (guide: { overId: string; locked: boolean } | null) => void;
  emitDragGuide: (guide: SidebarDragGuide | null) => void;
  flatItems: FlatTreeItem[];
  scrollRef: RefObject<HTMLDivElement | null>;
  visibleIndexMap: Map<string, number>;
  activeDescendantIds: Set<string>;
  allowNest: boolean;
  isLocalNotebook: boolean;
  rightNestEnterOffset: number;
  rightNestExitOffset: number;
  rowHeight: number;
  itemHeight: number;
  nestHoverDelayMs: number;
  clearNestDelayTimer: () => void;
}

export function useDragOver({
  dragPointerYRef,
  dragPointerXRef,
  dragStartPointerXRef,
  lockedNestIdRef,
  nestCandidateRef,
  rightNestActiveRef,
  nestDelayTimerRef,
  dropIntent,
  setDropIntent,
  updateNestGuide,
  emitDragGuide,
  flatItems,
  scrollRef,
  visibleIndexMap,
  activeDescendantIds,
  allowNest,
  isLocalNotebook,
  rightNestEnterOffset,
  rightNestExitOffset,
  rowHeight,
  itemHeight,
  nestHoverDelayMs,
  clearNestDelayTimer,
}: UseDragOverParams) {
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

  return { handleDragOver };
}
