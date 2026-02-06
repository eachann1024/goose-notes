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
} from "./tree-dnd";

interface SidebarTreeProps {
  activeNotebookId: string | null;
  width: number;
  rowHeight: number;
  itemHeight: number;
  viewportHeight: number;
  onCreatePage: () => void;
  onRequestRename: (page: Page) => void;
}

const DEFAULT_NOTEBOOK = "default-notebook";
const TREE_INDENT = 24;
const SAME_ROW_BEFORE_RATIO = 0.48;
const SAME_ROW_AFTER_RATIO = 0.52;
const EDGE_DROP_PADDING = 10;
const NEST_ZONE_TOP_RATIO = 0.42;
const NEST_ZONE_BOTTOM_RATIO = 0.58;
const NEST_HOVER_DELAY_MS = 500;
const DROP_INTENT_STABLE_PADDING = 6;
const TOP_EDGE_DROP_ID = "__sidebar-drop-top";
const BOTTOM_EDGE_DROP_ID = "__sidebar-drop-bottom";

type DropIntentKind = "before" | "after" | "nest";

interface DropIntent {
  overId: string;
  kind: DropIntentKind;
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

function getDragCenterY(
  translatedRect: { top: number; height: number } | null | undefined,
  activatorEvent: Event | null | undefined
): number | null {
  if (translatedRect) {
    return translatedRect.top + translatedRect.height / 2;
  }
  return getClientYFromActivator(activatorEvent);
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
  showDropLine: boolean;
  dropLinePosition: "top" | "bottom";
  dropLineLeft: number;
  onToggleOpen: (id: string) => void;
  onRequestRename: (page: Page) => void;
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
  showDropLine,
  dropLinePosition,
  dropLineLeft,
  onToggleOpen,
  onRequestRename,
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
      {showDropLine && (
        <div
          className="pointer-events-none absolute h-0.5 rounded-full bg-[#2563eb] shadow-[0_0_8px_rgba(37,99,235,0.42)]"
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
            "relative flex items-center h-full px-1 rounded-[8px] cursor-grab active:cursor-grabbing transition-colors text-sm font-medium",
            isNestDropTarget && "sidebar-drop-parent-target",
            isDragging && "opacity-60",
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

          <div className="ml-1 hidden group-hover:flex items-center shrink-0">
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

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoExpandTimerRef = useRef<number | null>(null);
  const dragPointerYRef = useRef<number | null>(null);
  const isTrackingPointerRef = useRef(false);
  const nestDelayTimerRef = useRef<number | null>(null);
  const nestCandidateRef = useRef<string | null>(null);
  const lockedNestIdRef = useRef<string | null>(null);

  const visibleItems = useMemo(
    () =>
      buildVisibleTree({
        pages,
        openIds: openPageIds,
        workspaceId: activeNotebookId || undefined,
        isLocalNotebook,
      }),
    [pages, openPageIds, activeNotebookId, isLocalNotebook]
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

  const handleGlobalPointerMove = useCallback((event: PointerEvent) => {
    dragPointerYRef.current = event.clientY;
  }, []);

  const handleGlobalTouchMove = useCallback((event: TouchEvent) => {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return;
    dragPointerYRef.current = touch.clientY;
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
    clearNestDelayTimer();
    nestCandidateRef.current = null;
    lockedNestIdRef.current = null;
    startPointerTracking();
    const translatedRect = active.rect.current.translated ?? active.rect.current.initial;
    dragPointerYRef.current =
      getClientYFromActivator(activatorEvent) ??
      getDragCenterY(translatedRect, activatorEvent);
  };

  const handleDragMove = ({ active }: DragMoveEvent) => {
    const translatedRect = active.rect.current.translated ?? active.rect.current.initial;
    dragPointerYRef.current = getDragCenterY(translatedRect, undefined);
    autoScrollVertical(translatedRect);
  };

  const resolveDropKind = (
    activeIndex: number,
    overIndex: number,
    overRect: { top: number; height: number },
    pointerY: number | null,
    previousKind: DropIntentKind | null,
    canNest: boolean,
    isNestLocked: boolean
  ): DropIntentKind => {
    if ((previousKind === "nest" || isNestLocked) && canNest) {
      return "nest";
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

    if (!over) {
      clearNestDelayTimer();
      nestCandidateRef.current = null;
      lockedNestIdRef.current = null;
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
    if (
      pointerY !== null &&
      dropIntent?.overId &&
      dropIntent.overId !== overItemId &&
      dropIntent.overId !== TOP_EDGE_DROP_ID &&
      dropIntent.overId !== BOTTOM_EDGE_DROP_ID &&
      scrollRef.current
    ) {
      const currentVisibleIndex = visibleIndexMap.get(dropIntent.overId);
      if (currentVisibleIndex !== undefined) {
        const containerRect = scrollRef.current.getBoundingClientRect();
        const currentTop =
          containerRect.top - scrollRef.current.scrollTop + currentVisibleIndex * rowHeight;
        const currentBottom = currentTop + rowHeight;
        if (
          pointerY >= currentTop + DROP_INTENT_STABLE_PADDING &&
          pointerY <= currentBottom - DROP_INTENT_STABLE_PADDING
        ) {
          overItemId = dropIntent.overId;
        }
      }
    }

    if (overItemId === TOP_EDGE_DROP_ID) {
      clearNestDelayTimer();
      nestCandidateRef.current = null;
      lockedNestIdRef.current = null;
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
      setDropIntent(null);
      return;
    }

    if (lockedNestIdRef.current && lockedNestIdRef.current !== overItemId) {
      lockedNestIdRef.current = null;
    }

    const canNest =
      !activeDescendantIds.has(overItem.id) &&
      (!isLocalNotebook || !!overItem.page.isFolder);

    let overRectForIntent = over.rect;
    const overVisibleIndex = visibleIndexMap.get(overItemId);
    if (overVisibleIndex !== undefined && scrollRef.current) {
      const containerRect = scrollRef.current.getBoundingClientRect();
      overRectForIntent = {
        top:
          containerRect.top - scrollRef.current.scrollTop + overVisibleIndex * rowHeight,
        height: rowHeight,
      };
    }

    const overHeight = Math.max(overRectForIntent.height, 1);
    const pointerRatio =
      pointerY === null
        ? 0.5
        : Math.max(0, Math.min(1, (pointerY - overRectForIntent.top) / overHeight));
    const inNestZone =
      pointerRatio >= NEST_ZONE_TOP_RATIO && pointerRatio <= NEST_ZONE_BOTTOM_RATIO;

    if (canNest && inNestZone) {
      if (
        nestCandidateRef.current !== overItemId &&
        lockedNestIdRef.current !== overItemId
      ) {
        clearNestDelayTimer();
        nestCandidateRef.current = overItemId;
        nestDelayTimerRef.current = window.setTimeout(() => {
          lockedNestIdRef.current = overItemId;
          setDropIntent((current) => {
            if (!current || current.overId !== overItemId) return current;
            return { overId: overItemId, kind: "nest" };
          });
        }, NEST_HOVER_DELAY_MS);
      }
    } else {
      clearNestDelayTimer();
      nestCandidateRef.current = null;
      if (lockedNestIdRef.current === overItemId) {
        lockedNestIdRef.current = null;
      }
    }

    const previousKind =
      dropIntent?.overId === overItemId ? dropIntent.kind : null;
    const kind = resolveDropKind(
      activeIndex,
      overIndex,
      overRectForIntent,
      pointerY,
      previousKind,
      canNest,
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
    stopPointerTracking();

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
      const targetChildren = getChildren(nextParentId, activeNotebookId || undefined)
        .filter((page) => page.id !== activeNodeId);
      nextOrderIds = [...targetChildren, activePage].map((page) => page.id);
    } else {
      nextParentId = overItem.parentId;
      const siblings = getChildren(nextParentId, activeNotebookId || undefined)
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

    const currentOrder = getChildren(nextParentId, activeNotebookId || undefined).map((page) => page.id);
    if (
      nextParentId === activeItem.parentId &&
      currentOrder.length === nextIds.length &&
      currentOrder.every((id, index) => id === nextIds[index])
    ) {
      return;
    }

    reorderPages(nextIds, nextParentId);

    if (nextParentId) {
      setOpenPageIds((prev) => {
        if (prev.has(nextParentId)) return prev;
        const next = new Set(prev);
        next.add(nextParentId);
        return next;
      });
    }

    if (activeItem.parentId && activeItem.parentId !== nextParentId) {
      const remaining = getChildren(
        activeItem.parentId,
        activeNotebookId || undefined
      ).filter((page) => page.id !== activeNodeId);

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
    stopPointerTracking();
    setActiveId(null);
    setDropIntent(null);
    dragPointerYRef.current = null;
  };

  if (flatItems.length === 0) {
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

  return (
    <div className="h-full w-full relative overflow-hidden">
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
            className="h-full overflow-y-auto overflow-x-hidden"
            style={{ width, minHeight: viewportHeight || 0 }}
          >
            <div
              style={{
                height: Math.max(virtualizer.getTotalSize(), viewportHeight || 0),
                width: "100%",
                position: "relative",
              }}
            >
              <EdgeDropZone id={TOP_EDGE_DROP_ID} top={0} height={14} />
              <EdgeDropZone
                id={BOTTOM_EDGE_DROP_ID}
                top={Math.max(virtualizer.getTotalSize(), viewportHeight || 0) - 14}
                height={14}
              />
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = visibleItems[virtualRow.index];
                const style: CSSProperties = {
                  position: "absolute",
                  top: virtualRow.start,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
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
                const isNestDropTarget = isDropTarget && dropIntent?.kind === "nest";
                const showDropLine = isDropTarget && dropIntent?.kind !== "nest";
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
                    showDropLine={showDropLine}
                    dropLinePosition={dropLinePosition}
                    dropLineLeft={dropLineLeft}
                    onToggleOpen={handleToggle}
                    onRequestRename={onRequestRename}
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
