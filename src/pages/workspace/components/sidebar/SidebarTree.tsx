import {
  closestCenter,
  pointerWithin,
  DndContext,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as LucideIcons from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { getPageTitle } from "@/lib/page-title";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import type { Page } from "@/types";
import { LocalFolderLoadingSkeleton } from "./LocalFolderLoadingSkeleton";
import { buildSidebarTitleDisambiguationMap } from "./sidebar-title-disambiguation";
import {
  buildVisibleTree,
  isDescendant,
  type FlatTreeItem,
  type VisibleTreeItem,
} from "./tree-dnd";
import { EdgeDropZone, PlaceholderRow, SortablePageRow } from "./tree/TreeRow";
import {
  TREE_INDENT,
  EDGE_DROP_PADDING,
  NEST_HOVER_DELAY_MS,
  DROP_INTENT_STABLE_PADDING,
  RIGHT_NEST_ENTER_OFFSET,
  RIGHT_NEST_EXIT_OFFSET,
  TOP_EDGE_DROP_ID,
  BOTTOM_EDGE_DROP_ID,
  LeftButtonPointerSensor,
  getClientYFromActivator,
  getClientXFromActivator,
  getDragCenterY,
  getDragCenterX,
  resolveDropKind,
  type DropIntentKind,
  type DropIntent,
  type SidebarDragGuide,
} from "./tree/useTreeDnd";
import { useTreeSelection } from "./tree/useTreeSelection";

// Re-export for consumers importing SidebarDragGuide from this file
export type { SidebarDragGuide };

interface SidebarTreeProps {
  activeNotebookId: string | null;
  selectedPageId?: string | null;
  width: number;
  rowHeight: number;
  itemHeight: number;
  viewportHeight: number;
  onCreatePage: () => void;
  onDragGuideChange?: (guide: SidebarDragGuide | null) => void;
  rootPageIds?: string[];
  fitContent?: boolean;
  showEmptyState?: boolean;
  nestHoverDelayMs?: number;
  rightNestEnterOffset?: number;
  rightNestExitOffset?: number;
  allowNest?: boolean;
  resolveSiblings?: (parentId: string | undefined) => Page[];
  onReorder?: (ids: string[], parentId: string | undefined) => void;
  showAddChildButton?: boolean;
  draggablePageIds?: string[];
}

export function SidebarTree({
  activeNotebookId,
  selectedPageId,
  width,
  rowHeight,
  itemHeight,
  viewportHeight,
  onCreatePage,
  onDragGuideChange,
  rootPageIds,
  fitContent = false,
  showEmptyState = true,
  nestHoverDelayMs = NEST_HOVER_DELAY_MS,
  rightNestEnterOffset = RIGHT_NEST_ENTER_OFFSET,
  rightNestExitOffset = RIGHT_NEST_EXIT_OFFSET,
  allowNest = true,
  resolveSiblings,
  onReorder,
  showAddChildButton = true,
  draggablePageIds,
}: SidebarTreeProps) {
  const {
    pages,
    activePageId,
    reorderPages,
    getChildren,
  } = usePages();

  // selectedPageId 传 null 表示"不高亮任何项"（如 AI 界面打开时），undefined 才 fallback 到 activePageId
  const highlightedPageId = selectedPageId !== undefined ? selectedPageId : activePageId;

  const notebook = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]
    : undefined;
  const isLocalNotebook = notebook?.source === "local-folder";
  const localLoadStatus = useNotebooks((state) =>
    activeNotebookId
      ? state.localFolderLoadStates[activeNotebookId]?.status ?? "idle"
      : "idle",
  );
  const shouldShowLocalSkeleton =
    !rootPageIds && isLocalNotebook && localLoadStatus === "loading";

  // ─── Drag state ──────────────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null);
  const [nestGuide, setNestGuide] = useState<{ overId: string; locked: boolean } | null>(null);
  const [titleRevealResetSignal, setTitleRevealResetSignal] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
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
  const dragGuideKeyRef = useRef<string>("__init__");

  // renderItemsRef allows useTreeSelection to access latest renderItems
  // for scroll-to-index without requiring it as a dependency of virtualizer
  const renderItemsRef = useRef<VisibleTreeItem[]>([]);

  const virtualizer = useVirtualizer({
    count: renderItemsRef.current.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // ─── Selection / open state ───────────────────────────────────────────
  const { openPageIds, handleToggle, openPageId, closePageId } = useTreeSelection({
    activeNotebookId,
    renderItems: renderItemsRef.current,
    virtualizer,
  });

  // ─── Tree data ────────────────────────────────────────────────────────
  const visibleItems = useMemo(
    () =>
      buildVisibleTree({
        pages,
        openIds: openPageIds,
        workspaceId: activeNotebookId || undefined,
        isLocalNotebook,
        rootPageIds,
      }),
    [pages, openPageIds, activeNotebookId, isLocalNotebook, rootPageIds]
  );

  const activeDescendantIds = useMemo(() => {
    if (!activeId) return new Set<string>();
    const descendants = new Set<string>();
    const stack = [activeId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      Object.values(pages).forEach((page) => {
        if (page.trashedAt || page.parentId !== currentId) return;
        descendants.add(page.id);
        stack.push(page.id);
      });
    }

    return descendants;
  }, [activeId, pages]);

  const renderItems = useMemo(
    () =>
      activeId
        ? visibleItems.filter((item) => ("isPlaceholder" in item ? true : !activeDescendantIds.has(item.id)))
        : visibleItems,
    [visibleItems, activeId, activeDescendantIds]
  );

  // Keep ref in sync for useTreeSelection
  renderItemsRef.current = renderItems;

  const titleDisambiguationMap = useMemo(
    () =>
      buildSidebarTitleDisambiguationMap({
        pages,
        activeNotebookId,
        notebook,
        rootPageIds,
      }),
    [pages, activeNotebookId, notebook, rootPageIds],
  );

  const flatItems = useMemo(
    () => renderItems.filter((item) => !("isPlaceholder" in item)) as FlatTreeItem[],
    [renderItems]
  );
  const draggablePageIdSet = useMemo(
    () => (draggablePageIds ? new Set(draggablePageIds) : null),
    [draggablePageIds],
  );

  const visibleIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    renderItems.forEach((item, index) => {
      if ("isPlaceholder" in item) return;
      map.set(item.id, index);
    });
    return map;
  }, [renderItems]);

  const resetTitleReveal = useCallback(() => {
    setTitleRevealResetSignal((current) => current + 1);
  }, []);

  // ─── DnD setup ───────────────────────────────────────────────────────
  const DragSensor = LeftButtonPointerSensor;
  const sensors = useSensors(
    useSensor(DragSensor, {
      activationConstraint: {
        distance: 4,
      },
    })
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const filterSelf = (collisions: Collision[]) =>
      collisions.filter((collision) => String(collision.id) !== String(args.active.id));
    const pointerHits = filterSelf(pointerWithin(args));
    if (pointerHits.length > 0) {
      return pointerHits;
    }
    return filterSelf(closestCenter(args));
  }, []);

  // ─── Sibling resolution ───────────────────────────────────────────────
  const getSiblingPages = useCallback(
    (parentId: string | undefined) => {
      if (resolveSiblings) {
        return resolveSiblings(parentId);
      }
      return getChildren(parentId, activeNotebookId || undefined);
    },
    [resolveSiblings, getChildren, activeNotebookId],
  );

  // ─── Drag guide emit ──────────────────────────────────────────────────
  const emitDragGuide = useCallback((guide: SidebarDragGuide | null) => {
    if (!onDragGuideChange) return;
    const key = guide ? `${guide.direction}:${guide.mode}` : "__none__";
    if (dragGuideKeyRef.current === key) return;
    dragGuideKeyRef.current = key;
    onDragGuideChange(guide);
  }, [onDragGuideChange]);

  const updateNestGuide = useCallback((guide: { overId: string; locked: boolean } | null) => {
    setNestGuide((current) => {
      if (
        current?.overId === guide?.overId &&
        current?.locked === guide?.locked
      ) {
        return current;
      }
      return guide;
    });
  }, []);

  // ─── Pointer tracking ─────────────────────────────────────────────────
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

  // ─── Effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      onDragGuideChange?.(null);
    };
  }, [onDragGuideChange]);

  useEffect(() => {
    return () => {
      stopPointerTracking();
      clearNestDelayTimer();
    };
  }, [stopPointerTracking]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      resetTitleReveal();
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [resetTitleReveal]);

  // ─── Timer helpers ────────────────────────────────────────────────────
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

  // ─── Drag handlers ────────────────────────────────────────────────────
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
      openPageId(nextParentId);
    }

    if (activeItem.parentId && activeItem.parentId !== nextParentId) {
      const remaining = getSiblingPages(activeItem.parentId).filter(
        (page) => page.id !== activeNodeId,
      );

      if (remaining.length === 0) {
        closePageId(activeItem.parentId);
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

  // ─── Render ───────────────────────────────────────────────────────────
  if (shouldShowLocalSkeleton) {
    return <LocalFolderLoadingSkeleton />;
  }

  if (flatItems.length === 0) {
    if (!showEmptyState) return null;
    const EmptyIcon = isLocalNotebook ? LucideIcons.FolderOpen : LucideIcons.Files;
    const isCompactEmptyState = width <= 172;
    return (
      <div
        className={cn("flex flex-col flex-1 items-center justify-center", isCompactEmptyState ? "px-2" : "px-4")}
      >
        <div className="flex flex-col items-center gap-2.5">
          <EmptyIcon className="h-7 w-7 text-foreground/45 stroke-[1.75]" />
          <p
            className={cn(
              "font-medium tracking-[0.01em] text-foreground/70",
              isCompactEmptyState ? "text-[14px]" : "text-[15px]",
            )}
          >
            {isLocalNotebook ? "暂无文件可选" : "暂无页面可选"}
          </p>
        </div>
        <Button
          variant="link"
          onClick={onCreatePage}
          className={cn(
            "mt-1 h-auto p-0 font-medium text-muted-foreground hover:text-foreground whitespace-normal break-words leading-snug",
            isCompactEmptyState ? "max-w-[9.5rem] text-[13px]" : "max-w-[11rem] text-[15px]",
          )}
        >
          {isLocalNotebook ? "新建文件" : "点击侧栏右上角加号创建"}
        </Button>
      </div>
    );
  }

  const contentHeight = fitContent
    ? Math.max(renderItems.length * rowHeight, rowHeight)
    : Math.max(virtualizer.getTotalSize(), viewportHeight || 0);
  const rows: Array<{ item: VisibleTreeItem; size: number; start: number }> = fitContent
    ? renderItems.map((item, index) => ({
        item,
        size: rowHeight,
        start: index * rowHeight,
      }))
    : virtualizer
        .getVirtualItems()
        .flatMap((virtualRow) => {
          const item = renderItems[virtualRow.index];
          if (!item) return [];
          return [
            {
              item,
              size: virtualRow.size,
              start: virtualRow.start,
            },
          ];
        });

  return (
    <div
      className={cn(
        "w-full relative",
        fitContent ? "overflow-visible" : "h-full overflow-hidden",
      )}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        autoScroll={false}
      >
        <SortableContext
          items={flatItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={scrollRef}
            className={cn(
              "overflow-x-hidden",
              fitContent ? "overflow-y-visible" : "h-full overflow-y-auto"
            )}
            style={
              fitContent
                ? { width, minHeight: contentHeight }
                : { width, minHeight: viewportHeight || 0 }
            }
          >
            <div
              style={{
                height: contentHeight,
                width: "100%",
                position: "relative",
              }}
            >
              <EdgeDropZone id={TOP_EDGE_DROP_ID} top={0} height={14} />
              <EdgeDropZone
                id={BOTTOM_EDGE_DROP_ID}
                top={contentHeight - 14}
                height={14}
              />
              {rows.map((row) => {
                const item = row.item;
                const style: CSSProperties = {
                  position: "absolute",
                  top: row.start,
                  left: 0,
                  width: "100%",
                  height: row.size,
                };

                if ("isPlaceholder" in item) {
                  return (
                    <PlaceholderRow
                      key={item.id}
                      style={style}
                      depth={item.depth}
                      name={item.name}
                    />
                  );
                }

                const isDropTarget = dropIntent?.overId === item.id && activeId !== item.id;
                const nestGuideState =
                  nestGuide?.overId === item.id
                    ? (nestGuide.locked ? "locked" : "pending")
                    : "idle";
                const isNestDropTarget =
                  isDropTarget && (dropIntent?.kind === "nest" || nestGuideState !== "idle");
                const showDropLine =
                  isDropTarget &&
                  dropIntent?.kind !== "nest" &&
                  nestGuideState === "idle";
                const dropLinePosition = dropIntent?.kind === "after" ? "bottom" : "top";
                const dropLineLeft = item.depth * TREE_INDENT + 16;
                const dragEnabled = draggablePageIdSet
                  ? draggablePageIdSet.has(item.id)
                  : true;
                const titleText = getPageTitle(item.page);
                const disambiguation = titleDisambiguationMap.get(item.id);
                const expandedTitleText = disambiguation
                  ? `${titleText} · ${disambiguation}`
                  : titleText;

                return (
                  <SortablePageRow
                    key={item.id}
                    item={item}
                    rowStyle={style}
                    depth={item.depth}
                    itemHeight={itemHeight}
                    isLocalNotebook={isLocalNotebook}
                    isActive={highlightedPageId === item.id}
                    isNestDropTarget={isNestDropTarget}
                    nestGuideState={nestGuideState}
                    showDropLine={showDropLine}
                    dropLinePosition={dropLinePosition}
                    dropLineLeft={dropLineLeft}
                    onToggleOpen={handleToggle}
                    showAddChildButton={showAddChildButton}
                    dragEnabled={dragEnabled}
                    titleText={titleText}
                    expandedTitleText={expandedTitleText}
                    revealResetSignal={titleRevealResetSignal}
                    titleRevealDisabled={activeId !== null}
                  />
                );
              })}
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
