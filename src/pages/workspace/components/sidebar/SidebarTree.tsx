import {
  closestCenter,
  pointerWithin,
  DndContext,
  PointerSensor,
  useDroppable,
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { getPageTitle } from "@/lib/page-title";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import type { Page } from "@/types";
import { IconSelector } from "../shared/IconSelector";
import { SidebarContextMenu } from "./SidebarContextMenu";
import {
  buildVisibleTree,
  isDescendant,
  type FlatTreeItem,
  type VisibleTreeItem,
} from "./tree-dnd";

interface SidebarTreeProps {
  activeNotebookId: string | null;
  width: number;
  rowHeight: number;
  itemHeight: number;
  viewportHeight: number;
  onCreatePage: () => void;
  onRequestRename: (page: Page) => void;
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
}

const DEFAULT_NOTEBOOK = "default-notebook";
const TREE_INDENT = 24;
const SAME_ROW_BEFORE_RATIO = 0.48;
const SAME_ROW_AFTER_RATIO = 0.52;
const EDGE_DROP_PADDING = 10;
const NEST_HOVER_DELAY_MS = 500;
const DROP_INTENT_STABLE_PADDING = 8;
const RIGHT_NEST_ENTER_OFFSET = 20;
const RIGHT_NEST_EXIT_OFFSET = 10;
const TOP_EDGE_DROP_ID = "__sidebar-drop-top";
const BOTTOM_EDGE_DROP_ID = "__sidebar-drop-bottom";

type DropIntentKind = "before" | "after" | "nest";
type DragGuideDirection = "left" | "right";
type DragGuideMode = "sort" | "nest-pending" | "nest-ready";

interface DropIntent {
  overId: string;
  kind: DropIntentKind;
}

interface SidebarDragGuide {
  direction: DragGuideDirection;
  mode: DragGuideMode;
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

class LeftButtonPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) =>
        nativeEvent.isPrimary && nativeEvent.button === 0 && !nativeEvent.ctrlKey,
    },
  ];
}

interface SortablePageRowProps {
  item: FlatTreeItem;
  rowStyle: CSSProperties;
  depth: number;
  itemHeight: number;
  isLocalNotebook: boolean;
  isActive: boolean;
  isNestDropTarget: boolean;
  nestGuideState: "idle" | "pending" | "locked";
  showDropLine: boolean;
  dropLinePosition: "top" | "bottom";
  dropLineLeft: number;
  onToggleOpen: (id: string) => void;
  onRequestRename: (page: Page) => void;
  showAddChildButton: boolean;
}

function EdgeDropZone({
  id,
  top,
  height,
}: {
  id: string;
  top: number;
  height: number;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="pointer-events-none absolute left-0 right-0"
      style={{ top, height }}
    />
  );
}

function PlaceholderRow({
  style,
  depth,
  name,
}: {
  style: CSSProperties;
  depth: number;
  name: string;
}) {
  return (
    <div style={style} className="relative px-1 select-none">
      <div className="flex items-center h-full px-2 rounded-md">
        <div
          style={{ paddingLeft: depth * TREE_INDENT + 24 }}
          className="text-[13px] text-muted-foreground/45 dark:text-muted-foreground/35 italic truncate"
        >
          {name}
        </div>
      </div>
    </div>
  );
}

function SortablePageRow({
  item,
  rowStyle,
  depth,
  itemHeight,
  isLocalNotebook,
  isActive,
  isNestDropTarget,
  nestGuideState,
  showDropLine,
  dropLinePosition,
  dropLineLeft,
  onToggleOpen,
  onRequestRename,
  showAddChildButton,
}: SortablePageRowProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const guardedListeners = {
    ...listeners,
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.ctrlKey) return;
      listeners?.onPointerDown?.(event);
    },
  };

  const setActivePage = usePages((state) => state.setActivePage);
  const createPage = usePages((state) => state.createPage);
  const createLocalPage = usePages((state) => state.createLocalPage);
  const updatePage = usePages((state) => state.updatePage);
  const activeNotebookId = useNotebooks((state) => state.activeNotebookId);

  const page = item.page;
  const hasChildren = item.hasChildren;
  const showArrow = hasChildren;
  const isLocalFolder = isLocalNotebook;
  const showFolderIcon = isLocalFolder && page.isFolder;
  const iconName = page.icon;
  const iconComponentMap = LucideIcons as unknown as Record<string, LucideIcon>;
  const SelectedIcon = iconName ? iconComponentMap[iconName] : null;

  const dndTransform = CSS.Transform.toString(transform);
  const virtualTransform = typeof rowStyle.transform === "string" ? rowStyle.transform : "";
  const mergedTransform = isDragging && dndTransform
    ? `${virtualTransform} ${dndTransform}`.trim()
    : virtualTransform;

  const handleAddChild = (e: MouseEvent) => {
    e.stopPropagation();

    if (isLocalFolder) {
      void createLocalPage(page.id, activeNotebookId || undefined);
      if (!item.isOpen) {
        onToggleOpen(page.id);
      }
      return;
    }

    const currentPages = usePages.getState().pages;
    const existingBlankChild = Object.values(currentPages).find((p) => {
      const isChild = p.parentId === page.id && !p.trashedAt;
      const title = getPageTitle(p);
      const isBlankTitle = !title || title.trim() === "" || title === "无标题";
      const isBlankContent =
        !p.content ||
        p.content.type !== "doc" ||
        !p.content.content ||
        p.content.content.length === 0 ||
        (p.content.content.length === 1 &&
          p.content.content[0].type === "paragraph" &&
          (!p.content.content[0].content ||
            p.content.content[0].content.length === 0));
      return isChild && isBlankTitle && isBlankContent;
    });

    if (existingBlankChild) {
      if (!item.isOpen) {
        onToggleOpen(page.id);
      }
      setActivePage(existingBlankChild.id);
      window.dispatchEvent(new CustomEvent("goose-note:focus-editor-start"));
      return;
    }

    if (!item.isOpen) {
      onToggleOpen(page.id);
    }
    createPage(page.id, activeNotebookId || DEFAULT_NOTEBOOK);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...rowStyle,
        height: itemHeight,
        transform: mergedTransform,
        transition,
      }}
      className={cn("group relative px-1", isDragging && "z-20 pointer-events-none")}
    >
      {isNestDropTarget && (
        <div className="pointer-events-none absolute -inset-x-0.5 -inset-y-[2px] z-10 rounded-[10px] bg-[hsl(var(--primary)/0.18)] ring-1 ring-[hsl(var(--primary)/0.52)] shadow-[0_0_0_1px_hsl(var(--background)/0.5)_inset] transition-all duration-100" />
      )}
      {showDropLine && (
        <div
          className="pointer-events-none absolute z-[5] h-0.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.88),0_0_0_1px_rgba(15,23,42,0.28)] transition-all duration-100"
          style={{
            left: dropLineLeft,
            right: 12,
            top: dropLinePosition === "top" ? 0 : undefined,
            bottom: dropLinePosition === "bottom" ? 0 : undefined,
          }}
        />
      )}

      <SidebarContextMenu page={page} onRequestRename={onRequestRename}>
        <div
          data-goose-context-trigger="true"
          {...attributes}
          {...guardedListeners}
          className={cn(
            "relative z-20 flex items-center h-full px-1 rounded-[8px] cursor-grab active:cursor-grabbing transition-colors text-sm font-medium",
            isNestDropTarget && "sidebar-drop-parent-target",
            isDragging && "opacity-60",
            nestGuideState !== "idle" &&
              "bg-[hsl(var(--primary)/0.14)] ring-1 ring-[hsl(var(--primary)/0.45)]",
            !isActive &&
              "text-muted-foreground dark:text-muted-foreground/65 hover:bg-[hsl(var(--goose-selected-bg)/0.72)] dark:hover:bg-[hsl(var(--goose-selected-bg)/0.82)] hover:text-foreground dark:hover:text-foreground/85 transition-colors duration-200",
            isActive &&
              "bg-[hsl(var(--goose-selected-bg))] text-foreground dark:text-foreground/90"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (isLocalFolder && page.isFolder) {
              onToggleOpen(page.id);
              return;
            }
            setActivePage(page.id);
          }}
        >
          <div
            className="flex items-center h-full flex-1 min-w-0"
            style={{ paddingLeft: depth * TREE_INDENT }}
          >
            <div
              className={cn(
                "flex items-center justify-center w-5 h-5 shrink-0 -ml-1 mr-0.5 rounded transition-all duration-300 ease-out",
                showArrow
                  ? "hover:bg-muted-foreground/10 cursor-pointer"
                  : "opacity-0 pointer-events-none"
              )}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (showArrow) {
                  onToggleOpen(page.id);
                }
              }}
            >
              <LucideIcons.ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200",
                  item.isOpen && "rotate-90"
                )}
              />
            </div>

            <div
              className="flex items-center justify-center w-5 h-5 shrink-0 mr-1.5 select-none"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {isLocalFolder ? (
                <div className="flex items-center justify-center w-5 h-5">
                  {showFolderIcon ? (
                    <LucideIcons.Folder className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/55" />
                  ) : (
                    <LucideIcons.FileText className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/55" />
                  )}
                </div>
              ) : (
                <IconSelector
                  value={iconName}
                  onChange={(newIcon) => updatePage(page.id, { icon: newIcon as string })}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted-foreground/15 transition-colors cursor-pointer">
                    {iconName ? (
                      <div className="h-4 w-4 flex items-center justify-center">
                        {SelectedIcon ? (
                          <SelectedIcon className="h-4 w-4" />
                        ) : (
                          <span className="text-sm">{iconName}</span>
                        )}
                      </div>
                    ) : showFolderIcon ? (
                      <LucideIcons.Folder className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/55" />
                    ) : (
                      <LucideIcons.FileText className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/55" />
                    )}
                  </div>
                </IconSelector>
              )}
            </div>

            <span className="truncate text-sm flex-1 min-w-0 select-none">
              {getPageTitle(page)}
            </span>
          </div>

          {showAddChildButton && (
            <div
              className={cn(
                "ml-1 items-center shrink-0",
                nestGuideState !== "idle" ? "flex" : "hidden group-hover:flex"
              )}
            >
              {nestGuideState !== "idle" && (
                <span className="mr-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary bg-[hsl(var(--primary)/0.14)]">
                  {nestGuideState === "locked" ? "松手移入子页面" : "右移停留后移入"}
                </span>
              )}
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted-foreground/15 hover:text-foreground"
                onClick={handleAddChild}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <LucideIcons.Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </SidebarContextMenu>
    </div>
  );
}

export function SidebarTree({
  activeNotebookId,
  width,
  rowHeight,
  itemHeight,
  viewportHeight,
  onCreatePage,
  onRequestRename,
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
}: SidebarTreeProps) {
  const {
    pages,
    activePageId,
    reorderPages,
    getChildren,
    expandPageId,
    setExpandPageId,
  } = usePages();

  const notebook = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]
    : undefined;
  const isLocalNotebook = notebook?.source === "local-folder";

  const [openPageIds, setOpenPageIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null);
  const [nestGuide, setNestGuide] = useState<{ overId: string; locked: boolean } | null>(null);

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

  const flatItems = useMemo(
    () => visibleItems.filter((item) => !("isPlaceholder" in item)) as FlatTreeItem[],
    [visibleItems]
  );

  const visibleIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleItems.forEach((item, index) => {
      if ("isPlaceholder" in item) return;
      map.set(item.id, index);
    });
    return map;
  }, [visibleItems]);

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

  const sensors = useSensors(
    useSensor(LeftButtonPointerSensor, {
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

  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const handleToggle = useCallback((id: string) => {
    setOpenPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const getSiblingPages = useCallback(
    (parentId: string | undefined) => {
      if (resolveSiblings) {
        return resolveSiblings(parentId);
      }
      return getChildren(parentId, activeNotebookId || undefined);
    },
    [resolveSiblings, getChildren, activeNotebookId],
  );

  useEffect(() => {
    if (!expandPageId) return;

    const page = pages[expandPageId];
    if (!page) return;
    if (page.trashedAt) {
      setExpandPageId(null);
      return;
    }
    if (activeNotebookId && page.workspaceId !== activeNotebookId) {
      return;
    }

    const ancestorIds: string[] = [];
    let current = page;
    while (current.parentId && pages[current.parentId]) {
      ancestorIds.push(current.parentId);
      current = pages[current.parentId];
    }

    setOpenPageIds((prev) => {
      const next = new Set(prev);
      ancestorIds.forEach((id) => next.add(id));
      return next;
    });

    const timer = window.setTimeout(() => {
      const index = visibleItems.findIndex((item) => item.id === expandPageId);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: "center" });
      }
    }, 80);

    setExpandPageId(null);
    return () => window.clearTimeout(timer);
  }, [expandPageId, pages, activeNotebookId, setExpandPageId, visibleItems, virtualizer]);

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

  useEffect(() => {
    return () => {
      onDragGuideChange?.(null);
    };
  }, [onDragGuideChange]);

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

  const resolveDropKind = (
    activeIndex: number,
    overIndex: number,
    overRect: { top: number; height: number },
    pointerY: number | null,
    previousKind: DropIntentKind | null,
    isNestLocked: boolean
  ): DropIntentKind => {
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

  if (flatItems.length === 0) {
    if (!showEmptyState) return null;
    return (
      <div className="text-sm text-muted-foreground dark:text-muted-foreground/65 px-4 py-8 text-center bg-gradient-to-br from-muted/40 to-muted/20 rounded mx-2 border border-dashed">
        <div className="mb-2">👻</div>
        <p>{isLocalNotebook ? "暂无文件" : "暂无页面"}</p>
        <Button variant="link" onClick={onCreatePage} className="h-auto p-0 mt-1">
          {isLocalNotebook ? "创建第一个文件" : "创建第一个页面"}
        </Button>
      </div>
    );
  }

  const contentHeight = fitContent
    ? Math.max(visibleItems.length * rowHeight, rowHeight)
    : Math.max(virtualizer.getTotalSize(), viewportHeight || 0);
  const rows: Array<{ item: VisibleTreeItem; size: number; start: number }> = fitContent
    ? visibleItems.map((item, index) => ({
        item,
        size: rowHeight,
        start: index * rowHeight,
      }))
    : virtualizer
        .getVirtualItems()
        .flatMap((virtualRow) => {
          const item = visibleItems[virtualRow.index];
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

                return (
                  <SortablePageRow
                    key={item.id}
                    item={item}
                    rowStyle={style}
                    depth={item.depth}
                    itemHeight={itemHeight}
                    isLocalNotebook={isLocalNotebook}
                    isActive={activePageId === item.id}
                    isNestDropTarget={isNestDropTarget}
                    nestGuideState={nestGuideState}
                    showDropLine={showDropLine}
                    dropLinePosition={dropLinePosition}
                    dropLineLeft={dropLineLeft}
                    onToggleOpen={handleToggle}
                    onRequestRename={onRequestRename}
                    showAddChildButton={showAddChildButton}
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
