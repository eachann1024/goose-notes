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
  syncNotebookForPage: (pageId: string | null) => void;
  openTab: (pageId: string) => void;
  openInCurrentTab: (pageId: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToLeft: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
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

export const useTabs = create<TabsState>()((set, get) => ({
  openTabs: [],
  activeTabId: null,

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
      set({ activeTabId: existingTab.id });
      get().syncNotebookForPage(pageId);
      void scheduleSetActivePage(pageId);
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
      nextActiveId = activeTabId;
    }

    set({ openTabs: nextTabs, activeTabId: nextActiveId });
    const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId);
    get().syncNotebookForPage(nextActiveTab?.pageId ?? null);
    void scheduleSetActivePage(nextActiveTab?.pageId ?? null);
  },

  closeOtherTabs: (tabId: string) => {
    const { openTabs } = get();
    const currentTab = openTabs.find((tab) => tab.id === tabId);
    if (!currentTab) return;

    set({ openTabs: [currentTab], activeTabId: currentTab.id });
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

    set({ openTabs: nextTabs, activeTabId: nextActiveId });
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

    set({ openTabs: nextTabs, activeTabId: nextActiveId });
    const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId);
    get().syncNotebookForPage(nextActiveTab?.pageId ?? null);
    void scheduleSetActivePage(nextActiveTab?.pageId ?? null);
  },

  setActiveTab: (tabId: string) => {
    const { openTabs } = get();
    const tab = openTabs.find((item) => item.id === tabId);
    if (!tab) return;

    set({ activeTabId: tab.id });
    get().syncNotebookForPage(tab.pageId);
    void scheduleSetActivePage(tab.pageId);
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

    set({ openTabs: finalTabs, activeTabId: nextActiveId });

    const nextActiveTab = finalTabs.find((tab) => tab.id === nextActiveId);
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
}));
