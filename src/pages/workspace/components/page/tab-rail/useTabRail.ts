import { activateWorkspace } from "@/lib/settings-navigation";
import type { KeyboardEvent as ReactKeyboardEvent, WheelEvent as ReactWheelEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useTabs, type TabItem } from "@/stores/useTabs";
import { PointerSensor, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";
import { useSidebarView } from "@/stores/useSidebarView";
import { isElectronRuntime } from "@/lib/electron/runtime";
import { cancelTabDragPreview, createDesktopWindow, finishTabDrag, previewTabDrag, tabToSnapshot } from "@/lib/electron/windowContext";
import { canDragTabBetweenWindows, tabDragEnabled } from "@/lib/electron/tabTearOff";
import { formatShortcut } from "@/lib/utils";
import { isTabRailTitleFieldTarget } from "../tabRailLayout";
import { useTabDocking } from "../useTabDocking";
import { listVisibleWorkspaceTabs, shouldEditTitleInTabPill } from "../visibleTabs";
import { useEditorSplitSelector } from "@/stores/useEditorSplit";
import { focusedPageIdOf } from "@/lib/editor-split/tree";
import { detachTabFromThisWindow } from "@/lib/electron/detachTab";

import type { TabRailProps } from "./types";
import { sameFocusedPageMap, readDragPointer, dragDelta } from "./model";

export function useTabRail({ variant, settingsOpen = false, onBeforeActivateTab }: Pick<TabRailProps, "variant" | "settingsOpen" | "onBeforeActivateTab">) {
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

  return {
    visibleTabs, focusedPageByTabId, getPage,
    activeTabId, isOverflowing, tabsScrollerRef,
    dragEnabled, insertLeft, sensors,
    handleTabDragStart, handleTabDragMove, handleTabDragCancel,
    handleTabDragEnd, closeTabShortcutLabel, editTitleInPill,
    canOpenInNewWindow, setActiveTab, closeTab,
    togglePinTab, promotePreviewTab, locateInTree,
    openTabInNewWindow, handleTabsWheel, handleTabListKeyDown,
    openTabs,
  };
}
