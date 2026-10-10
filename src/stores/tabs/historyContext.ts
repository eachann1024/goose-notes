import type { TabSet, TabGet, TabItem } from "./types";
import { clampHistoryIndex } from "./helpers";
import {
  useFileNavHistory,
  fileNavKeyForTab,
  parseFileNavKey,
} from "../useFileNavHistory";
import { usePages } from "../usePages";
import { useSidebarView } from "../useSidebarView";

export function createTabHistoryContext(set: TabSet, get: TabGet) {
  const syncHistoryWithOpenTabs = (nextOpenTabs: TabItem[]) => {
    const validTabIds = new Set(nextOpenTabs.map((tab) => tab.id));
    const { tabHistory, tabHistoryIndex } = get();
    const nextHistory = tabHistory.filter((tabId) => validTabIds.has(tabId));
    const nextHistoryIndex = clampHistoryIndex(
      nextHistory.length,
      tabHistoryIndex,
    );
    return {
      tabHistory: nextHistory,
      tabHistoryIndex: nextHistoryIndex,
    };
  };

  const pushTabHistory = (tabId: string) => {
    const { tabHistory, tabHistoryIndex, isHistoryNavigating, openTabs } =
      get();
    if (isHistoryNavigating) return;

    const currentTabId =
      tabHistoryIndex >= 0 && tabHistoryIndex < tabHistory.length
        ? tabHistory[tabHistoryIndex]
        : null;
    if (currentTabId !== tabId) {
      const nextHistory = tabHistory.slice(0, tabHistoryIndex + 1);
      nextHistory.push(tabId);
      set({
        tabHistory: nextHistory,
        tabHistoryIndex: nextHistory.length - 1,
      });
    }

    const tab = openTabs.find((item) => item.id === tabId);
    if (tab) useFileNavHistory.getState().push(fileNavKeyForTab(tab));
  };

  const restoreFileNavLocation = (key: string): boolean => {
    const location = parseFileNavKey(key);
    if (location.type === "ai-panel") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("goose-note:open-ai-panel"));
      }
      return true;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("goose-note:close-ai-panel-if-fullscreen"),
      );
    }
    if (location.type === "welcome") {
      get().openWelcomeTab();
      return true;
    }
    const page = usePages.getState().getPage(location.pageId);
    if (!page || page.trashedAt) return false;
    get().openPreviewTab(page.id);
    if (page.workspaceId) {
      const sidebar = useSidebarView.getState();
      sidebar.setSelected(page.workspaceId, page.id);
      sidebar.setFocused(page.workspaceId, page.id);
    }
    return true;
  };

  const stepFileNavHistory = (direction: "back" | "forward") => {
    const nav = useFileNavHistory.getState();
    const canMove = direction === "back" ? nav.canBack() : nav.canForward();
    if (!canMove) return;

    nav.markNavigating(true);
    try {
      while (direction === "back" ? nav.canBack() : nav.canForward()) {
        const key = direction === "back" ? nav.moveBack() : nav.moveForward();
        if (key && restoreFileNavLocation(key)) return;
      }
    } finally {
      nav.markNavigating(false);
    }
  };

  const resolveTabIdInHistory = (
    tabId: string | null | undefined,
    openTabs: TabItem[],
  ) => {
    if (!tabId) return null;
    return openTabs.some((tab) => tab.id === tabId) ? tabId : null;
  };
  return {
    syncHistoryWithOpenTabs,
    pushTabHistory,
    restoreFileNavLocation,
    stepFileNavHistory,
    resolveTabIdInHistory,
  };
}
