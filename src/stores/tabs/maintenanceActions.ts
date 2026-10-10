import type { TabSet, TabGet, TabsState, TabItem } from "./types";
import type { TabsActionContext } from "./context";
import { usePages } from "../usePages";
import { useNotebooks } from "../useNotebooks";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { useSettings } from "../useSettings";
import { normalizeAutoCloseInactiveTabsHours } from "../settings/types";
import { isSpecialTab, WELCOME_TAB_PAGE_ID } from "./types";
import { useFileNavHistory } from "../useFileNavHistory";
import {
  findTabByPageId,
  createTabId,
  getWorkspaceIdForPage,
  collectTabsPageIds,
  commitActiveEditor,
  flushClosedPageSaves,
  scheduleSetActivePage,
  workspaceTabPageId,
} from "./helpers";

export function createMaintenanceTabActions(
  set: TabSet,
  get: TabGet,
  context: TabsActionContext,
): Pick<
  TabsState,
  | "reconcileTabs"
  | "closeExpiredTabs"
  | "clearAllTabs"
  | "collapseToActiveTab"
  | "reopenLastClosedTab"
> {
  const { syncHistoryWithOpenTabs } = context;
  return {
    reconcileTabs: () => {
      const { openTabs, activeTabId } = get();
      const pagesState = usePages.getState();
      const notebooks = useNotebooks.getState().notebooks;
      const loadedWorkspaceIds = new Set<string>();
      for (const page of Object.values(pagesState.pages)) {
        loadedWorkspaceIds.add(page.workspaceId);
      }

      let nextTabs = openTabs.filter((tab) => {
        // 欢迎 tab 不关联真实页面，始终保留。
        if (tab.type === "welcome") return true;
        // AI 标签按笔记本存活：笔记本还在就保留。
        if (tab.type === "notebook-ai") {
          const notebookId = tab.workspaceId;
          return Boolean(notebookId && notebooks[notebookId]);
        }
        if (pagesState.getPage(tab.pageId)) return true;
        // 页面不在内存：若它属于尚未加载的本地文件夹笔记本，保留（稍后会加载）。
        const ws = tab.workspaceId;
        if (
          ws &&
          notebooks[ws]?.source === "local-folder" &&
          !loadedWorkspaceIds.has(ws)
        ) {
          return true;
        }
        return false;
      });

      if (effectiveSingleTabMode() && nextTabs.length > 1) {
        const active = nextTabs.find((tab) => tab.id === activeTabId);
        nextTabs = active ? [active] : [nextTabs[nextTabs.length - 1]];
      }

      if (nextTabs.length === openTabs.length) return;
      const nextActiveValid = nextTabs.some((tab) => tab.id === activeTabId);
      const historyState = syncHistoryWithOpenTabs(nextTabs);
      set({
        openTabs: nextTabs,
        activeTabId: nextActiveValid
          ? activeTabId
          : (nextTabs[nextTabs.length - 1]?.id ?? null),
        ...historyState,
      });
    },

    closeExpiredTabs: (now = Date.now()) => {
      if (effectiveSingleTabMode()) return;
      const { privacy } = useSettings.getState();
      if (!privacy.autoCloseInactiveTabs) return;

      const maxIdleMs =
        normalizeAutoCloseInactiveTabsHours(
          privacy.autoCloseInactiveTabsHours,
        ) *
        60 *
        60 *
        1000;
      const { openTabs, activeTabId } = get();
      const expiredTabs = openTabs.filter((tab) => {
        if (isSpecialTab(tab)) return false;
        if (tab.pinned) return false;
        if (tab.id === activeTabId) return false;
        const lastAccessedAt = tab.lastAccessedAt ?? now;
        return now - lastAccessedAt >= maxIdleMs;
      });

      expiredTabs.forEach((tab) => {
        get().closeTab(tab.id);
      });
    },

    clearAllTabs: () => {
      useFileNavHistory.getState().reset();
      set({
        openTabs: [],
        activeTabId: null,
        tabHistory: [],
        tabHistoryIndex: -1,
        isHistoryNavigating: false,
        recentlyClosedPageIds: [],
      });
    },

    collapseToActiveTab: () => {
      const { openTabs, activeTabId } = get();
      if (!activeTabId) return;
      let activeTab = openTabs.find((tab) => tab.id === activeTabId);
      if (!activeTab) return;

      if (activeTab.type === "notebook-ai") {
        const activePageId = usePages.getState().activePageId;
        const pageTab = activePageId
          ? findTabByPageId(openTabs, activePageId)
          : undefined;
        if (pageTab) {
          activeTab = pageTab;
        } else if (activePageId && usePages.getState().getPage(activePageId)) {
          activeTab = {
            id: createTabId(activePageId),
            pageId: activePageId,
            workspaceId: getWorkspaceIdForPage(activePageId),
            lastAccessedAt: Date.now(),
          };
        } else {
          const welcomeTab: TabItem = {
            id: createTabId(WELCOME_TAB_PAGE_ID),
            pageId: WELCOME_TAB_PAGE_ID,
            type: "welcome",
            lastAccessedAt: Date.now(),
          };
          activeTab = welcomeTab;
        }
      }

      const closedPageIds = collectTabsPageIds(
        openTabs.filter((tab) => tab.id !== activeTab.id),
      );

      commitActiveEditor();
      flushClosedPageSaves(closedPageIds);

      const nextTabs = [activeTab];
      const historyState = syncHistoryWithOpenTabs(nextTabs);
      set({
        openTabs: nextTabs,
        activeTabId: activeTab.id,
        ...historyState,
      });
      if (isSpecialTab(activeTab)) {
        void scheduleSetActivePage(null);
      } else {
        const pageId = workspaceTabPageId(activeTab);
        get().syncNotebookForPage(pageId);
        void scheduleSetActivePage(pageId);
      }
    },

    reopenLastClosedTab: () => {
      if (effectiveSingleTabMode()) return;
      const { recentlyClosedPageIds, openTabs } = get();
      const openPageIds = new Set(openTabs.map((tab) => tab.pageId));
      const candidate = recentlyClosedPageIds.find((id) => {
        if (openPageIds.has(id)) return false;
        const page = usePages.getState().getPage(id);
        return page && !page.trashedAt;
      });
      if (!candidate) return;
      set({
        recentlyClosedPageIds: recentlyClosedPageIds.filter(
          (id) => id !== candidate,
        ),
      });
      get().openPermanentTab(candidate);
    },
  };
}
