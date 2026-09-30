import { activateWorkspace } from "@/lib/settings-navigation";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import type { Page } from "@/types";
import { useTabs, type TabItem } from "@/stores/useTabs";
import type { NotebookAiLayoutMode } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { isFullscreenAiLayout } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSidebarView } from "@/stores/useSidebarView";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { isElectronRuntime } from "@/lib/electron/runtime";
import {
  cancelTabDragPreview,
  createDesktopWindow,
  finishTabDrag,
  previewTabDrag,
  tabToSnapshot,
} from "@/lib/electron/windowContext";
import {
  canDragTabBetweenWindows,
  tabDragEnabled,
} from "@/lib/electron/tabTearOff";
import { cn, formatShortcut } from "@/lib/utils";
import { SingleTabTitle } from "./SingleTabTitle";
import {
  isTabRailTitleFieldTarget,
  shouldHandleTabActivationKey,
  tabRailItemClassName,
  tabRailListClassName,
  tabRailSelectionClassName,
} from "./tabRailLayout";
import { useTabDocking } from "./useTabDocking";
import {
  listVisibleWorkspaceTabs,
  shouldEditTitleInTab,
  shouldEditTitleInTabPill,
} from "./visibleTabs";
import { useEditorSplitSelector } from "@/stores/useEditorSplit";
import { focusedPageIdOf } from "@/lib/editor-split/tree";
import { detachTabFromThisWindow } from "@/lib/electron/detachTab";
import { bindIdleWindowDrag } from "@/lib/electron/windowDrag";

function sameFocusedPageMap(
  a: Record<string, string>,
  b: Record<string, string>,
) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

function tabRailPageId(
  tab: TabItem,
  focusedByTabId: Record<string, string>,
): string {
  if (tab.type === "welcome" || tab.type === "notebook-ai") return tab.pageId;
  return focusedByTabId[tab.id] ?? tab.pageId;
}

function readDragPointer(event: Event | undefined): {
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

function dragDelta(event: DragStartEvent | DragMoveEvent): {
  x: number;
  y: number;
} {
  if (!("delta" in event)) return { x: 0, y: 0 };
  return event.delta;
}

interface SortableTabItemProps {
  tab: TabItem;
  tabPage?: Page;
  tabCount: number;
  variant: TabRailVariant;
  isActive: boolean;
  hasLeftTabs: boolean;
  hasRightTabs: boolean;
  hasOtherTabs: boolean;
  closeTabShortcutLabel: string;
  editTitleInPill: boolean;
  dragEnabled: boolean;
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseLeft: () => void;
  onCloseRight: () => void;
  onTogglePin: () => void;
  onPromotePreview: () => void;
  onLocateInTree?: () => void;
  onOpenInNewWindow?: () => void;
}

function SortableTabItem({
  tab,
  tabPage,
  tabCount,
  variant,
  isActive,
  hasLeftTabs,
  hasRightTabs,
  hasOtherTabs,
  closeTabShortcutLabel,
  editTitleInPill,
  dragEnabled,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseLeft,
  onCloseRight,
  onTogglePin,
  onPromotePreview,
  onLocateInTree,
  onOpenInNewWindow,
}: SortableTabItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: !dragEnabled });
  const windowDragStartedRef = useRef(false);
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const title =
    tab.type === "welcome"
      ? "新标签页"
      : tabPage
        ? getPageTitle(tabPage)
        : "页面已不存在";
  const electronNoDrag = variant === "electron-titlebar";
  const windowDragEnabled = !dragEnabled && variant === "electron-titlebar";
  const onWindowDragPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!windowDragEnabled) return;
    bindIdleWindowDrag(event, windowDragStartedRef);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...(dragEnabled ? listeners : {})}
          aria-disabled={undefined}
          role="tab"
          tabIndex={isActive ? 0 : -1}
          aria-selected={isActive}
          data-tab-id={tab.id}
          data-tab-active={isActive || undefined}
          data-tab-page-id={tab.pageId}
          data-tab-preview={tab.preview || undefined}
          data-tab-pinned={tab.pinned || undefined}
          data-electron-no-drag={electronNoDrag ? "" : undefined}
          data-electron-option-drag={windowDragEnabled ? "" : undefined}
          onPointerDown={onWindowDragPointerDown}
          onClick={onActivate}
          onDoubleClick={(event) => {
            if (!tab.preview) return;
            event.preventDefault();
            event.stopPropagation();
            onPromotePreview();
          }}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          onKeyDown={(event) => {
            if (shouldHandleTabActivationKey(event.key, event.target)) {
              event.preventDefault();
              onActivate();
            }
          }}
          className={cn(
            "group relative @container flex items-center gap-1 px-2 text-sm",
            tabCount > 1 && "goose-interactive",
            tabRailItemClassName(tabCount),
            tab.preview && "italic",
            isDragging && "opacity-60",
            tabRailSelectionClassName(tabCount, isActive),
          )}
        >
          {tab.pinned && (
            <LucideIcons.Pin
              aria-label="已固定"
              className="h-3 w-3 shrink-0 text-primary"
            />
          )}
          {isActive && shouldEditTitleInTab(tabPage, editTitleInPill) && tabPage ? (
            <SingleTabTitle
              key={`${tabPage.id}:${tabPage.localFilePath ?? ""}:${getPageTitle(tabPage)}`}
              page={tabPage}
              surface="tab-pill"
              idleWindowDrag={variant === "electron-titlebar"}
            />
          ) : (
            <span
              className={cn(
                "min-w-0 flex-1 truncate no-underline",
                tab.preview && "italic text-muted-foreground",
              )}
            >
              {title}
            </span>
          )}
          <TooltipProvider delayDuration={2000}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-md p-0 transition-colors",
                    tabPage
                      ? "hidden @[64px]:group-hover:flex"
                      : "flex",
                    isActive
                      ? "text-foreground/70 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                      : "text-muted-foreground/70 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                  )}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                  }}
                  aria-label="关闭标签页"
                >
                  <LucideIcons.X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>关闭标签页</span>
                  {closeTabShortcutLabel && (
                    <span className="text-[11px] text-muted-foreground">
                      {closeTabShortcutLabel}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[200px]">
        {tab.type !== "welcome" && onLocateInTree && (
          <>
            <ContextMenuItem onSelect={onLocateInTree}>
              在文件树中定位
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {onOpenInNewWindow ? (
          <ContextMenuItem onSelect={onOpenInNewWindow}>
            在新窗口打开
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onSelect={onTogglePin}>
          {tab.pinned ? "取消固定" : "固定标签"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onClose}>
          关闭
          {closeTabShortcutLabel && (
            <span className="ml-auto text-xs text-muted-foreground">
              {closeTabShortcutLabel}
            </span>
          )}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseOthers} disabled={!hasOtherTabs}>
          关闭其他标签页
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseLeft} disabled={!hasLeftTabs}>
          关闭左侧标签页
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseRight} disabled={!hasRightTabs}>
          关闭右侧标签页
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export type TabRailVariant = "page-header" | "electron-titlebar";

interface TabRailProps {
  variant: TabRailVariant;
  page?: Page;
  onOpenSearch: () => void;
  onBeforeActivateTab?: () => void;
  settingsOpen?: boolean;
  aiPanelOpen?: boolean;
  aiLayoutMode?: NotebookAiLayoutMode;
}

export function TabRail({
  variant,
  page,
  onOpenSearch,
  onBeforeActivateTab,
  settingsOpen = false,
  aiPanelOpen,
  aiLayoutMode = "fullscreen",
}: TabRailProps) {
  const getPage = usePages((s) => s.getPage);
  const activeNotebookId = useNotebooks((state) => state.activeNotebookId);
  const {
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    reorderTabs,
    togglePinTab,
    promotePreviewTab,
    syncNotebookForPage,
  } = useTabs();
  const setExpandPageId = usePages((s) => s.setExpandPageId);
  const setSidebarCollapsedView = useSidebarView((s) => s.setSidebarCollapsed);
  const locateInTree = (pageId: string) => {
    activateWorkspace();
    setSidebarCollapsedView(false);
    syncNotebookForPage(pageId);
    setExpandPageId(pageId);
  };
  const { closeTabShortcut } = useSettings();
  const visibleTabs = listVisibleWorkspaceTabs(
    openTabs,
    getPage,
    activeNotebookId,
  );
  const focusedPageByTabId = useEditorSplitSelector((state) => {
    const next: Record<string, string> = {};
    for (const tab of openTabs) {
      if (tab.type === "welcome" || tab.type === "notebook-ai") continue;
      const split = state.byTabId[tab.id];
      const pageId = split ? focusedPageIdOf(split) : null;
      if (pageId) next[tab.id] = pageId;
    }
    return next;
  }, sameFocusedPageMap);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const tabsScrollerRef = useRef<HTMLDivElement>(null);
  const lastCursorRef = useRef<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const grabOffsetXRef = useRef(80);
  const previewFrameRef = useRef(0);
  const canDockTabs = canDragTabBetweenWindows({
    isElectron: isElectronRuntime(),
    variant,
  });
  const dragEnabled = tabDragEnabled({
    isElectron: isElectronRuntime(),
    variant,
    tabCount: visibleTabs.length,
  });
  const { insertLeft } = useTabDocking({
    enabled: canDockTabs,
    scrollerRef: tabsScrollerRef,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const updateDragCursor = (event: DragStartEvent | DragMoveEvent) => {
    const pointer = readDragPointer(event.activatorEvent);
    if (!pointer) return;
    const delta = dragDelta(event);
    lastCursorRef.current = {
      x: pointer.screenX + delta.x,
      y: pointer.screenY + delta.y,
      clientX: pointer.clientX + delta.x,
      clientY: pointer.clientY + delta.y,
    };
  };
  const pointerInsideSourceWindow = (cursor: {
    clientX: number;
    clientY: number;
  }) =>
    cursor.clientX >= -8 &&
    cursor.clientY >= -8 &&
    cursor.clientX <= window.innerWidth + 8 &&
    cursor.clientY <= window.innerHeight + 8;
  const handleTabDragStart = (event: DragStartEvent) => {
    activateWorkspace();
    updateDragCursor(event);
    const pointer = readDragPointer(event.activatorEvent);
    const el = document.querySelector<HTMLElement>(
      `[data-tab-id="${String(event.active.id)}"]`,
    );
    if (el && pointer) {
      grabOffsetXRef.current = pointer.clientX - el.getBoundingClientRect().left;
    }
  };
  const handleTabDragMove = (event: DragMoveEvent) => {
    updateDragCursor(event);
    const cursor = lastCursorRef.current;
    if (!canDockTabs || !cursor || pointerInsideSourceWindow(cursor)) return;
    if (previewFrameRef.current) return;
    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = 0;
      const latest = lastCursorRef.current;
      if (!latest || pointerInsideSourceWindow(latest)) return;
      previewTabDrag(latest);
    });
  };
  const handleTabDragCancel = () => {
    lastCursorRef.current = null;
    if (previewFrameRef.current) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = 0;
    }
    if (canDockTabs) cancelTabDragPreview();
  };
  const reorderFromEvent = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = openTabs.findIndex((tab) => tab.id === active.id);
    const to = openTabs.findIndex((tab) => tab.id === over.id);
    if (from === -1 || to === -1) return;
    reorderTabs(from, to);
  };
  const handleTabDragEnd = (event: DragEndEvent) => {
    const cursor = lastCursorRef.current;
    lastCursorRef.current = null;
    if (previewFrameRef.current) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = 0;
    }
    const tab = openTabs.find((item) => item.id === event.active.id);
    const stayInside =
      !canDockTabs ||
      !tab ||
      !cursor ||
      pointerInsideSourceWindow(cursor);
    if (stayInside) {
      if (canDockTabs) cancelTabDragPreview();
      reorderFromEvent(event);
      return;
    }
    void (async () => {
      const result = await finishTabDrag({
        tab: tabToSnapshot(tab),
        cursor,
        sourceTabCount: visibleTabs.length,
        grabOffsetX: grabOffsetXRef.current,
      });
      if (result.action === "none" || (result.action === "tearOff" && !result.windowId)) {
        reorderFromEvent(event);
        return;
      }
      detachTabFromThisWindow(tab.id, result.windowId);
    })();
  };
  const closeTabShortcutLabel = closeTabShortcut
    ? formatShortcut(closeTabShortcut)
    : isElectronRuntime()
      ? formatShortcut("Mod+W")
      : "";
  const canOpenInNewWindow = isElectronRuntime();
  const editTitleInPill = !settingsOpen && shouldEditTitleInTabPill(visibleTabs);

  useEffect(() => {
    const scroller = tabsScrollerRef.current;
    if (!scroller) return;
    const scrollActiveIntoView = () => {
      scroller
        .querySelector<HTMLElement>('[data-tab-active="true"]')
        ?.scrollIntoView({ inline: "nearest", block: "nearest" });
      setIsOverflowing(scroller.scrollWidth > scroller.clientWidth);
    };
    scrollActiveIntoView();
    const observer = new ResizeObserver(scrollActiveIntoView);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [activeTabId, visibleTabs.length]);

  const handleTabsWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const scroller = tabsScrollerRef.current;
    if (!scroller) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    scroller.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  const handleTabListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (isTabRailTitleFieldTarget(event.target)) return;
    if (visibleTabs.length < 2) return;
    const currentIndex = visibleTabs.findIndex((tab) => tab.id === activeTabId);
    if (currentIndex === -1) return;
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      (currentIndex + delta + visibleTabs.length) % visibleTabs.length;
    const nextTab = visibleTabs[nextIndex];
    if (!nextTab) return;
    event.preventDefault();
    onBeforeActivateTab?.();
    setActiveTab(nextTab.id);
    requestAnimationFrame(() => {
      tabsScrollerRef.current
        ?.querySelector<HTMLElement>(`[data-tab-id="${nextTab.id}"]`)
        ?.focus();
    });
  };

  const openTabInNewWindow = async (tab: TabItem) => {
    activateWorkspace();
    const created = await createDesktopWindow({
      mode: "currentTab",
      tab: {
        id: tab.id,
        pageId: tab.pageId,
        type: tab.type,
        pinned: tab.pinned,
        workspaceId: tab.workspaceId,
      },
    });
    if (created?.windowId) detachTabFromThisWindow(tab.id, created.windowId);
  };

  const tabItems = (
    <>
      {visibleTabs.map((tab) => {
        const displayPageId = tabRailPageId(tab, focusedPageByTabId);
        const tabPage =
          tab.type === "welcome" ? undefined : getPage(displayPageId);
        const visibleIndex = visibleTabs.findIndex((t) => t.id === tab.id);
        return (
          <SortableTabItem
            key={tab.id}
            tab={{ ...tab, pageId: displayPageId }}
            tabPage={tabPage}
            tabCount={visibleTabs.length}
            variant={variant}
            isActive={
              activeTabId === tab.id &&
              !(aiPanelOpen && isFullscreenAiLayout(aiLayoutMode))
            }
            hasLeftTabs={visibleIndex > 0}
            hasRightTabs={visibleIndex < visibleTabs.length - 1}
            hasOtherTabs={visibleTabs.length > 1}
            closeTabShortcutLabel={closeTabShortcutLabel}
            editTitleInPill={editTitleInPill}
            dragEnabled={dragEnabled}
            onActivate={() => {
              onBeforeActivateTab?.();
              setActiveTab(tab.id);
            }}
            onClose={() => { activateWorkspace(); closeTab(tab.id); }}
            onCloseOthers={() => {
              activateWorkspace();
              visibleTabs
                .filter((item) => item.id !== tab.id)
                .forEach((item) => closeTab(item.id));
            }}
            onCloseLeft={() => {
              activateWorkspace();
              visibleTabs
                .slice(0, visibleIndex)
                .forEach((item) => closeTab(item.id));
            }}
            onCloseRight={() => {
              activateWorkspace();
              visibleTabs
                .slice(visibleIndex + 1)
                .forEach((item) => closeTab(item.id));
            }}
            onTogglePin={() => togglePinTab(tab.id)}
            onPromotePreview={() => promotePreviewTab(tab.id)}
            onLocateInTree={() => locateInTree(displayPageId)}
            onOpenInNewWindow={
              canOpenInNewWindow ? () => void openTabInNewWindow(tab) : undefined
            }
          />
        );
      })}
    </>
  );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div
        ref={tabsScrollerRef}
        role="tablist"
        aria-label="打开的标签页"
        className={cn(
          "relative @container min-w-0 flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          tabRailListClassName(visibleTabs.length),
        )}
        onWheel={handleTabsWheel}
        onKeyDown={handleTabListKeyDown}
        onDoubleClick={(e) => {
          if (variant === "electron-titlebar") return;
          if (e.target === e.currentTarget) {
            onBeforeActivateTab?.();
            useTabs.getState().openNewTab();
          }
        }}
      >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleTabDragStart}
        onDragMove={handleTabDragMove}
        onDragCancel={handleTabDragCancel}
        onDragEnd={handleTabDragEnd}
      >
        <SortableContext
          items={visibleTabs.map((tab) => tab.id)}
          strategy={horizontalListSortingStrategy}
        >
          {tabItems}
        </SortableContext>
      </DndContext>
      {insertLeft != null && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 z-20 w-0.5 rounded-full bg-primary motion-reduce:transition-none"
          style={{ left: insertLeft }}
        />
      )}

      {openTabs.length === 0 && page && (
        <span className="truncate text-sm text-foreground/80">
          {getPageTitle(page)}
        </span>
      )}
    </div>

      {!page?.trashedAt && (
        <div
          className="flex shrink-0 items-center gap-0.5"
          data-electron-no-drag={
            variant === "electron-titlebar" ? "" : undefined
          }
        >
          <TooltipProvider delayDuration={600}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-[8px] text-muted-foreground/70 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                  onClick={onOpenSearch}
                  aria-label="新标签页"
                >
                  <LucideIcons.Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>新标签页</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isOverflowing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="outline-none inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-muted-foreground/70 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]"
                  aria-label="全部标签页"
                >
                  <LucideIcons.ChevronDown
                    className="h-3.5 w-3.5"
                    strokeWidth={1.75}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[220px] outline-none"
                align="end"
                sideOffset={4}
              >
                {visibleTabs.map((tab) => {
                  const displayPageId = tabRailPageId(tab, focusedPageByTabId);
                  const tabPage =
                    tab.type === "welcome" ? undefined : getPage(displayPageId);
                  const title =
                    tab.type === "welcome"
                      ? "新标签页"
                      : tabPage
                        ? getPageTitle(tabPage)
                        : "页面已不存在";
                  const isActive =
                    activeTabId === tab.id &&
                    !(aiPanelOpen && isFullscreenAiLayout(aiLayoutMode));
                  return (
                    <DropdownMenuItem
                      key={tab.id}
                      aria-selected={isActive}
                      className={cn(
                        "goose-interactive flex items-center gap-2 text-[13px]",
                        isActive &&
                          "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]",
                      )}
                      onSelect={() => {
                        onBeforeActivateTab?.();
                        setActiveTab(tab.id);
                        setTimeout(() => {
                          const scroller = tabsScrollerRef.current;
                          if (!scroller) return;
                          const el = scroller.querySelector<HTMLElement>(
                            `[data-tab-id="${tab.id}"]`,
                          );
                          el?.scrollIntoView({
                            inline: "nearest",
                            block: "nearest",
                          });
                        }, 0);
                      }}
                    >
                      {tab.pinned && (
                        <LucideIcons.Pin
                          className="h-3 w-3 shrink-0 text-primary"
                          strokeWidth={1.75}
                        />
                      )}
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          tab.preview && "italic text-muted-foreground",
                        )}
                      >
                        {title}
                      </span>
                      {isActive && (
                        <LucideIcons.Check
                          className="h-3.5 w-3.5 shrink-0 text-foreground/60"
                          strokeWidth={1.75}
                        />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
