import {
  closestCenter,
  pointerWithin,
  DndContext,
  PointerSensor,
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
  arrayMove,
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
  getProjection,
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
  isDropTarget: boolean;
  isNestDropTarget: boolean;
  isEmptyNestTarget: boolean;
  showDropLine: boolean;
  dropLinePosition: "top" | "bottom";
  dropLineLeft: number;
  nestPointerLeft: number;
  onToggleOpen: (id: string) => void;
  onRequestRename: (page: Page) => void;
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
  isDropTarget,
  isNestDropTarget,
  isEmptyNestTarget,
  showDropLine,
  dropLinePosition,
  dropLineLeft,
  nestPointerLeft,
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
      className={cn("group relative px-2", isDragging && "z-20")}
    >
      {showDropLine && (
        <div
          className="absolute h-0.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
          style={{
            left: dropLineLeft,
            right: 12,
            top: dropLinePosition === "top" ? 0 : undefined,
            bottom: dropLinePosition === "bottom" ? 0 : undefined,
          }}
        />
      )}
      {isNestDropTarget && (
        <div
          className={cn(
            "sidebar-drop-parent-pointer",
            isEmptyNestTarget && "sidebar-drop-parent-pointer-empty"
          )}
          style={{ left: nestPointerLeft }}
        >
          <LucideIcons.CornerDownRight className="h-3.5 w-3.5" />
          <span>作为子页面</span>
        </div>
      )}

      <SidebarContextMenu page={page} onRequestRename={onRequestRename}>
        <div
          {...attributes}
          {...guardedListeners}
          className={cn(
            "relative flex items-center h-full pl-2 pr-1 rounded-[8px] cursor-grab active:cursor-grabbing transition-colors text-sm font-medium",
            isDropTarget && "sidebar-drop-target",
            isNestDropTarget && "sidebar-drop-parent-target",
            isNestDropTarget && isEmptyNestTarget && "sidebar-drop-parent-target-empty",
            isDragging && "opacity-60",
            !isActive &&
              "text-muted-foreground dark:text-muted-foreground/65 hover:bg-muted/55 dark:hover:bg-muted/40 hover:text-foreground dark:hover:text-foreground/85 transition-colors duration-200",
            isActive &&
              "border workspace-divider-strong bg-background text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:bg-background dark:text-foreground/90"
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
              className="p-1 rounded hover:bg-muted-foreground/15 text-muted-foreground/70 hover:text-foreground transition-colors"
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
  const [overId, setOverId] = useState<string | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dropPlacement, setDropPlacement] = useState<"before" | "after">("before");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoExpandTimerRef = useRef<number | null>(null);

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

  const projected = useMemo(() => {
    if (!activeId || !overId) return null;
    return getProjection({
      items: flatItems,
      activeId,
      overId,
      dragOffsetX,
      indentationWidth: TREE_INDENT,
      pages,
      isLocalNotebook,
    });
  }, [activeId, overId, flatItems, dragOffsetX, pages, isLocalNotebook]);
  const activeDragItem = useMemo(
    () => (activeId ? flatItems.find((item) => item.id === activeId) ?? null : null),
    [flatItems, activeId]
  );

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

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOverId(null);
    setDragOffsetX(0);
    setDropPlacement("before");
  };

  const handleDragMove = ({ delta, active }: DragMoveEvent) => {
    setDragOffsetX(delta.x);

    const translatedRect = active.rect.current.translated ?? active.rect.current.initial;
    autoScrollVertical(translatedRect);
  };

  const handleDragOver = ({ over, active }: DragOverEvent) => {
    if (!over) {
      setOverId(null);
      return;
    }
    const overItemId = String(over.id);
    if (activeDescendantIds.has(overItemId)) {
      setOverId(null);
      return;
    }
    setOverId(overItemId);

    const translatedRect = active.rect.current.translated ?? active.rect.current.initial;
    if (translatedRect) {
      const activeCenterY = translatedRect.top + translatedRect.height / 2;
      const overMiddleY = over.rect.top + over.rect.height / 2;
      setDropPlacement(activeCenterY > overMiddleY ? "after" : "before");
    }

    const overItem = flatItems.find((item) => item.id === overItemId);
    if (!overItem || !overItem.hasChildren || overItem.isOpen) {
      clearAutoExpandTimer();
      return;
    }

    clearAutoExpandTimer();
    autoExpandTimerRef.current = window.setTimeout(() => {
      setOpenPageIds((prev) => {
        if (prev.has(overItem.id)) return prev;
        const next = new Set(prev);
        next.add(overItem.id);
        return next;
      });
    }, 320);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    clearAutoExpandTimer();

    const activeNodeId = String(active.id);
    const overNodeId = over ? String(over.id) : null;

    setActiveId(null);
    setOverId(null);
    setDragOffsetX(0);
    const currentPlacement = dropPlacement;
    setDropPlacement("before");

    if (!overNodeId) return;
    if (activeDescendantIds.has(overNodeId)) return;

    const activeItem = flatItems.find((item) => item.id === activeNodeId);
    if (!activeItem) return;

    const activeIndex = flatItems.findIndex((item) => item.id === activeNodeId);
    const overIndex = flatItems.findIndex((item) => item.id === overNodeId);
    if (activeIndex < 0 || overIndex < 0) return;

    const projection = getProjection({
      items: flatItems,
      activeId: activeNodeId,
      overId: overNodeId,
      dragOffsetX,
      indentationWidth: TREE_INDENT,
      pages,
      isLocalNotebook,
    });

    const overItem = flatItems.find((item) => item.id === overNodeId);
    const wantsPromoteToRoot =
      activeItem.depth > 0 && dragOffsetX < -TREE_INDENT / 3;
    const canNestIntoOver =
      !!overItem &&
      overNodeId !== activeNodeId &&
      !isDescendant(activeNodeId, overNodeId, pages) &&
      (!isLocalNotebook || !!overItem.page.isFolder);
    const wantsNestIntoOver = canNestIntoOver && dragOffsetX >= -TREE_INDENT / 8;

    const nextParentId = wantsPromoteToRoot
      ? undefined
      : wantsNestIntoOver
        ? overNodeId
        : projection?.parentId ?? activeItem.parentId;
    if (isDescendant(activeNodeId, nextParentId, pages)) {
      return;
    }
    if (isLocalNotebook && nextParentId && !pages[nextParentId]?.isFolder) {
      return;
    }

    const depthChanged = projection && projection.depth !== activeItem.depth;
    if (activeIndex === overIndex && !depthChanged && nextParentId === activeItem.parentId) {
      return;
    }

    const nextIndex = (() => {
      if (currentPlacement === "after") {
        return activeIndex < overIndex ? overIndex : overIndex + 1;
      }
      return activeIndex < overIndex ? overIndex - 1 : overIndex;
    })();
    const boundedIndex = Math.max(0, Math.min(nextIndex, flatItems.length - 1));

    const reordered = arrayMove(flatItems, activeIndex, boundedIndex).map((item) => {
      if (item.id !== activeNodeId) return item;
      return {
        ...item,
        parentId: nextParentId,
        depth: projection?.depth ?? item.depth,
      };
    });

    const rankMap = new Map(reordered.map((item, index) => [item.id, index]));
    const activePage = pages[activeNodeId];
    if (!activePage) return;

    const targetSiblings = getChildren(nextParentId, activeNotebookId || undefined);
    const mergedSiblings = [...targetSiblings.filter((page) => page.id !== activeNodeId), activePage];
    mergedSiblings.sort((a, b) => {
      const rankA = rankMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rankB = rankMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;

      const orderA = a.order ?? a.createdAt;
      const orderB = b.order ?? b.createdAt;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });

    reorderPages(
      mergedSiblings.map((page) => page.id),
      nextParentId
    );

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
    setActiveId(null);
    setOverId(null);
    setDragOffsetX(0);
    setDropPlacement("before");
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
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
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

                const rowDepth =
                  activeId === item.id && projected ? projected.depth : item.depth;
                const isDropTarget = overId === item.id && activeId !== item.id;
                const wantsPromoteToRoot =
                  !!activeDragItem &&
                  activeDragItem.depth > 0 &&
                  dragOffsetX < -TREE_INDENT / 3;
                const canNestIntoItem =
                  !!activeDragItem &&
                  activeId !== item.id &&
                  !activeDescendantIds.has(item.id) &&
                  (!isLocalNotebook || !!item.page.isFolder);
                const isNestDropTarget =
                  isDropTarget &&
                  !wantsPromoteToRoot &&
                  canNestIntoItem &&
                  dragOffsetX >= -TREE_INDENT / 8;
                const dropLineLeft = rowDepth * TREE_INDENT + 16;
                const nestPointerLeft = (item.depth + 1) * TREE_INDENT + 16;
                const dropLinePosition = dropPlacement === "after" ? "bottom" : "top";

                return (
                  <SortablePageRow
                    key={item.id}
                    item={item}
                    rowStyle={style}
                    depth={rowDepth}
                    itemHeight={itemHeight}
                    isLocalNotebook={isLocalNotebook}
                    isActive={activePageId === item.id}
                    isDropTarget={isDropTarget}
                    isNestDropTarget={isNestDropTarget}
                    isEmptyNestTarget={!item.hasChildren}
                    showDropLine={isDropTarget && !isNestDropTarget}
                    dropLinePosition={dropLinePosition}
                    dropLineLeft={dropLineLeft}
                    nestPointerLeft={nestPointerLeft}
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
