import { create } from "zustand";
import { trackEvent } from "@/lib/analytics";
import { usePages } from "./usePages";
import { useNotebooks } from "./useNotebooks";

export interface TabItem {
  id: string;
  pageId: string;
}

interface TabsState {
  openTabs: TabItem[];
  activeTabId: string | null;
  tabHistory: string[];
  tabHistoryIndex: number;
  isHistoryNavigating: boolean;
  syncNotebookForPage: (pageId: string | null) => void;
  openTab: (pageId: string) => void;
  openInCurrentTab: (pageId: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToLeft: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  goBackTabHistory: () => void;
  goForwardTabHistory: () => void;
  canGoBackTabHistory: () => boolean;
  canGoForwardTabHistory: () => boolean;
  reorderTabs: (from: number, to: number) => void;
  removeDeletedPage: (pageId: string) => void;
}

const createTabId = (pageId: string) =>
  `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${pageId.slice(0, 6)}`;

let setActivePageChain: Promise<void> = Promise.resolve();

const scheduleSetActivePage = (pageId: string | null) => {
  setActivePageChain = setActivePageChain
    .catch(() => {})
    .then(() => usePages.getState().setActivePage(pageId));
  return setActivePageChain;
};

const clampHistoryIndex = (historyLength: number, currentIndex: number) => {
  if (historyLength === 0) return -1;
  if (currentIndex < 0) return 0;
  return Math.min(currentIndex, historyLength - 1);
};

export const useTabs = create<TabsState>()((set, get) => {
  const syncHistoryWithOpenTabs = (nextOpenTabs: TabItem[]) => {
    const validTabIds = new Set(nextOpenTabs.map((tab) => tab.id));
    const { tabHistory, tabHistoryIndex } = get();
    const nextHistory = tabHistory.filter((tabId) => validTabIds.has(tabId));
    const nextHistoryIndex = clampHistoryIndex(nextHistory.length, tabHistoryIndex);
    return {
      tabHistory: nextHistory,
      tabHistoryIndex: nextHistoryIndex,
    };
  };

  const pushTabHistory = (tabId: string) => {
    const { tabHistory, tabHistoryIndex, isHistoryNavigating } = get();
    if (isHistoryNavigating) return;

    const currentTabId =
      tabHistoryIndex >= 0 && tabHistoryIndex < tabHistory.length
        ? tabHistory[tabHistoryIndex]
        : null;
    if (currentTabId === tabId) return;

    const nextHistory = tabHistory.slice(0, tabHistoryIndex + 1);
    nextHistory.push(tabId);

    set({
      tabHistory: nextHistory,
      tabHistoryIndex: nextHistory.length - 1,
    });
  };

  const resolveTabIdInHistory = (
    tabId: string | null | undefined,
    openTabs: TabItem[],
  ) => {
    if (!tabId) return null;
    return openTabs.some((tab) => tab.id === tabId) ? tabId : null;
  };

  return {
    openTabs: [],
    activeTabId: null,
    tabHistory: [],
    tabHistoryIndex: -1,
    isHistoryNavigating: false,

    syncNotebookForPage: (pageId: string | null) => {
      if (!pageId) return;
      const page = usePages.getState().getPage(pageId);
      if (!page) return;
      const notebookStore = useNotebooks.getState();
      if (notebookStore.activeNotebookId !== page.workspaceId) {
        notebookStore.setActiveNotebook(page.workspaceId);
      }
    },

    openTab: (pageId: string) => {
      const { openTabs } = get();
      const existingTab = openTabs.find((tab) => tab.pageId === pageId);
      if (existingTab) {
        get().setActiveTab(existingTab.id);
        return;
      }

      const newTab: TabItem = {
        id: createTabId(pageId),
        pageId,
      };
      const nextOpenTabs = [...openTabs, newTab];
      set({
        openTabs: nextOpenTabs,
        activeTabId: newTab.id,
      });
      trackEvent("tab_opened", {
        feature: "tabs",
        action: "open",
        source: "page_navigation",
        tab_count_after_open: nextOpenTabs.length,
      });
      pushTabHistory(newTab.id);
      get().syncNotebookForPage(pageId);
      void scheduleSetActivePage(pageId);
    },

    openInCurrentTab: (pageId: string) => {
      const { openTabs, activeTabId } = get();
      const activeIndex = openTabs.findIndex((tab) => tab.id === activeTabId);
      if (activeIndex === -1) {
        get().openTab(pageId);
        return;
      }

      const nextTabs = [...openTabs];
      nextTabs[activeIndex] = {
        ...nextTabs[activeIndex],
        pageId,
      };
      set({ openTabs: nextTabs });
      trackEvent("tab_reused_for_navigation", {
        feature: "tabs",
        action: "switch",
        source: "page_navigation",
        tab_count_current: nextTabs.length,
      });
      pushTabHistory(nextTabs[activeIndex].id);
      get().syncNotebookForPage(pageId);
      void scheduleSetActivePage(pageId);
    },

    closeTab: (tabId: string) => {
      const { openTabs, activeTabId } = get();
      const index = openTabs.findIndex((tab) => tab.id === tabId);
      if (index === -1) return;

      const nextTabs = openTabs.filter((tab) => tab.id !== tabId);
      let nextActiveId: string | null = null;
      if (activeTabId === tabId && nextTabs.length > 0) {
        nextActiveId = nextTabs[Math.min(index, nextTabs.length - 1)]?.id ?? null;
      } else if (activeTabId !== tabId) {
        nextActiveId = resolveTabIdInHistory(activeTabId, nextTabs);
      }

      const historyState = syncHistoryWithOpenTabs(nextTabs);
      const fallbackActiveId =
        resolveTabIdInHistory(nextActiveId, nextTabs) ??
        (historyState.tabHistoryIndex >= 0
          ? historyState.tabHistory[historyState.tabHistoryIndex]
          : null);

      set({
        openTabs: nextTabs,
        activeTabId: fallbackActiveId,
        ...historyState,
      });
      const nextActiveTab = nextTabs.find((tab) => tab.id === fallbackActiveId);
      get().syncNotebookForPage(nextActiveTab?.pageId ?? null);
      void scheduleSetActivePage(nextActiveTab?.pageId ?? null);
    },

    closeOtherTabs: (tabId: string) => {
      const { openTabs } = get();
      const currentTab = openTabs.find((tab) => tab.id === tabId);
      if (!currentTab) return;

      const nextTabs = [currentTab];
      const historyState = syncHistoryWithOpenTabs(nextTabs);
      set({
        openTabs: nextTabs,
        activeTabId: currentTab.id,
        ...historyState,
      });
      get().syncNotebookForPage(currentTab.pageId);
      void scheduleSetActivePage(currentTab.pageId);
    },

    closeTabsToLeft: (tabId: string) => {
      const { openTabs, activeTabId } = get();
      const currentIndex = openTabs.findIndex((tab) => tab.id === tabId);
      if (currentIndex <= 0) return;

      const nextTabs = openTabs.slice(currentIndex);
      const nextActiveId = nextTabs.some((tab) => tab.id === activeTabId)
        ? activeTabId
        : tabId;
      const historyState = syncHistoryWithOpenTabs(nextTabs);

      set({
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        ...historyState,
      });
      const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId);
      get().syncNotebookForPage(nextActiveTab?.pageId ?? null);
      void scheduleSetActivePage(nextActiveTab?.pageId ?? null);
    },

    closeTabsToRight: (tabId: string) => {
      const { openTabs, activeTabId } = get();
      const currentIndex = openTabs.findIndex((tab) => tab.id === tabId);
      if (currentIndex === -1 || currentIndex >= openTabs.length - 1) return;

      const nextTabs = openTabs.slice(0, currentIndex + 1);
      const nextActiveId = nextTabs.some((tab) => tab.id === activeTabId)
        ? activeTabId
        : tabId;
      const historyState = syncHistoryWithOpenTabs(nextTabs);

      set({
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        ...historyState,
      });
      const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId);
      get().syncNotebookForPage(nextActiveTab?.pageId ?? null);
      void scheduleSetActivePage(nextActiveTab?.pageId ?? null);
    },

    setActiveTab: (tabId: string) => {
      const { openTabs } = get();
      const tab = openTabs.find((item) => item.id === tabId);
      if (!tab) return;

      set({ activeTabId: tab.id });
      pushTabHistory(tab.id);
      get().syncNotebookForPage(tab.pageId);
      void scheduleSetActivePage(tab.pageId);
    },

    goBackTabHistory: () => {
      const { tabHistory, tabHistoryIndex, openTabs } = get();
      if (tabHistoryIndex <= 0) return;

      const validTabIds = new Set(openTabs.map((tab) => tab.id));
      const sanitizedHistory = tabHistory.filter((tabId) => validTabIds.has(tabId));
      const sanitizedIndex = clampHistoryIndex(sanitizedHistory.length, tabHistoryIndex);
      if (sanitizedIndex <= 0) {
        set({ tabHistory: sanitizedHistory, tabHistoryIndex: sanitizedIndex });
        return;
      }

      const targetIndex = sanitizedIndex - 1;
      const targetTabId = sanitizedHistory[targetIndex];
      set({
        tabHistory: sanitizedHistory,
        tabHistoryIndex: sanitizedIndex,
        isHistoryNavigating: true,
      });
      try {
        get().setActiveTab(targetTabId);
        set({ tabHistoryIndex: targetIndex });
      } finally {
        set({ isHistoryNavigating: false });
      }
    },

    goForwardTabHistory: () => {
      const { tabHistory, tabHistoryIndex, openTabs } = get();
      if (tabHistoryIndex >= tabHistory.length - 1) return;

      const validTabIds = new Set(openTabs.map((tab) => tab.id));
      const sanitizedHistory = tabHistory.filter((tabId) => validTabIds.has(tabId));
      const sanitizedIndex = clampHistoryIndex(sanitizedHistory.length, tabHistoryIndex);
      if (sanitizedIndex >= sanitizedHistory.length - 1) {
        set({ tabHistory: sanitizedHistory, tabHistoryIndex: sanitizedIndex });
        return;
      }

      const targetIndex = sanitizedIndex + 1;
      const targetTabId = sanitizedHistory[targetIndex];
      set({
        tabHistory: sanitizedHistory,
        tabHistoryIndex: sanitizedIndex,
        isHistoryNavigating: true,
      });
      try {
        get().setActiveTab(targetTabId);
        set({ tabHistoryIndex: targetIndex });
      } finally {
        set({ isHistoryNavigating: false });
      }
    },

    canGoBackTabHistory: () => {
      const { tabHistoryIndex } = get();
      return tabHistoryIndex > 0;
    },

    canGoForwardTabHistory: () => {
      const { tabHistory, tabHistoryIndex } = get();
      return tabHistoryIndex >= 0 && tabHistoryIndex < tabHistory.length - 1;
    },

    reorderTabs: (from: number, to: number) => {
      const { openTabs } = get();
      if (from < 0 || from >= openTabs.length) return;
      if (to < 0 || to >= openTabs.length) return;

      const nextTabs = [...openTabs];
      const [moved] = nextTabs.splice(from, 1);
      nextTabs.splice(to, 0, moved);
      set({ openTabs: nextTabs });
    },

    removeDeletedPage: (pageId: string) => {
      const { openTabs, activeTabId } = get();
      const deletedIndex = openTabs.findIndex((tab) => tab.pageId === pageId);
      const deletedPage = usePages.getState().getPage(pageId);
      const preferredPageId = usePages.getState().activePageId;
      const nextTabs = openTabs.filter((tab) => tab.pageId !== pageId);
      if (nextTabs.length === openTabs.length) return;

      let finalTabs = nextTabs;
      let nextActiveId = activeTabId;

      if (!nextActiveId || !nextTabs.some((tab) => tab.id === nextActiveId)) {
        if (preferredPageId) {
          const existingPreferredTab = nextTabs.find(
            (tab) => tab.pageId === preferredPageId,
          );

          if (existingPreferredTab) {
            nextActiveId = existingPreferredTab.id;
          } else {
            const insertionIndex =
              deletedIndex === -1
                ? nextTabs.length
                : Math.min(deletedIndex, nextTabs.length);
            const replacementTab: TabItem = {
              id: createTabId(preferredPageId),
              pageId: preferredPageId,
            };
            finalTabs = [
              ...nextTabs.slice(0, insertionIndex),
              replacementTab,
              ...nextTabs.slice(insertionIndex),
            ];
            nextActiveId = replacementTab.id;
          }
        } else {
          nextActiveId =
            nextTabs[Math.min(deletedIndex, nextTabs.length - 1)]?.id ?? null;
        }
      }

      const historyState = syncHistoryWithOpenTabs(finalTabs);
      const fallbackActiveId =
        resolveTabIdInHistory(nextActiveId, finalTabs) ??
        (historyState.tabHistoryIndex >= 0
          ? historyState.tabHistory[historyState.tabHistoryIndex]
          : null);

      set({
        openTabs: finalTabs,
        activeTabId: fallbackActiveId,
        ...historyState,
      });

      const nextActiveTab = finalTabs.find((tab) => tab.id === fallbackActiveId);
      if (deletedPage?.trashedAt) {
        if (nextActiveTab?.pageId && nextActiveTab.pageId !== preferredPageId) {
          get().syncNotebookForPage(nextActiveTab.pageId);
          void scheduleSetActivePage(nextActiveTab.pageId);
        }
        return;
      }

      get().syncNotebookForPage(nextActiveTab?.pageId ?? null);
      void scheduleSetActivePage(nextActiveTab?.pageId ?? null);
    },
  };
});
