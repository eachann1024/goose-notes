import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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

export const useTabs = create<TabsState>()(
  persist(
    (set, get) => ({
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
          void usePages.getState().setActivePage(pageId);
          return;
        }

        const newTab: TabItem = {
          id: createTabId(pageId),
          pageId,
        };
        const nextTabs = [...openTabs, newTab];

        set({
          openTabs: nextTabs,
          activeTabId: newTab.id,
        });
        get().syncNotebookForPage(pageId);
        void usePages.getState().setActivePage(pageId);
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
        get().syncNotebookForPage(pageId);
        void usePages.getState().setActivePage(pageId);
      },

      closeTab: (tabId: string) => {
        const { openTabs, activeTabId } = get();
        const index = openTabs.findIndex((tab) => tab.id === tabId);
        if (index === -1) return;

        const nextTabs = openTabs.filter((tab) => tab.id !== tabId);

        let nextActiveId: string | null = null;
        if (activeTabId === tabId && nextTabs.length > 0) {
          // 优先激活右边的标签，如果没有则激活左边的
          nextActiveId = nextTabs[Math.min(index, nextTabs.length - 1)]?.id ?? null;
        } else if (activeTabId !== tabId) {
          nextActiveId = activeTabId;
        }

        set({ openTabs: nextTabs, activeTabId: nextActiveId });
        const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId);
        get().syncNotebookForPage(nextActiveTab?.pageId ?? null);
        void usePages.getState().setActivePage(nextActiveTab?.pageId ?? null);
      },

      closeOtherTabs: (tabId: string) => {
        const { openTabs } = get();
        const currentTab = openTabs.find((tab) => tab.id === tabId);
        if (!currentTab) return;
        set({ openTabs: [currentTab], activeTabId: currentTab.id });
        get().syncNotebookForPage(currentTab.pageId);
        void usePages.getState().setActivePage(currentTab.pageId);
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
        void usePages.getState().setActivePage(nextActiveTab?.pageId ?? null);
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
        void usePages.getState().setActivePage(nextActiveTab?.pageId ?? null);
      },

      setActiveTab: (tabId: string) => {
        const { openTabs } = get();
        const tab = openTabs.find((item) => item.id === tabId);
        if (!tab) return;
        set({ activeTabId: tab.id });
        get().syncNotebookForPage(tab.pageId);
        void usePages.getState().setActivePage(tab.pageId);
      },

      reorderTabs: (from: number, to: number) => {
        const { openTabs } = get();
        if (from < 0 || from >= openTabs.length) return;
        if (to < 0 || to >= openTabs.length) return;
        const next = [...openTabs];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        set({ openTabs: next });
      },

      removeDeletedPage: (pageId: string) => {
        const { openTabs, activeTabId } = get();
        const nextTabs = openTabs.filter((tab) => tab.pageId !== pageId);
        if (nextTabs.length === openTabs.length) return;

        let nextActiveId = activeTabId;
        if (!nextActiveId || !nextTabs.some((tab) => tab.id === nextActiveId)) {
          nextActiveId = nextTabs[0]?.id ?? null;
        }

        set({ openTabs: nextTabs, activeTabId: nextActiveId });
        const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId);
        get().syncNotebookForPage(nextActiveTab?.pageId ?? null);
        void usePages.getState().setActivePage(nextActiveTab?.pageId ?? null);
      },
    }),
    {
      name: "goose-note-tabs",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState || version >= 2) return persistedState as TabsState;
        const legacy = persistedState as {
          openTabs?: unknown;
          activeTabId?: unknown;
        };
        const legacyTabs = Array.isArray(legacy.openTabs) ? legacy.openTabs : [];
        if (legacyTabs.length === 0 || typeof legacyTabs[0] !== "string") {
          return persistedState as TabsState;
        }

        const migratedTabs = (legacyTabs as string[]).map((pageId, index) => ({
          id: `legacy-${index}-${pageId}`,
          pageId,
        }));
        const legacyActivePageId =
          typeof legacy.activeTabId === "string" ? legacy.activeTabId : null;
        const activeTabId =
          migratedTabs.find((tab) => tab.pageId === legacyActivePageId)?.id ??
          migratedTabs[0]?.id ??
          null;

        return {
          ...(persistedState as object),
          openTabs: migratedTabs,
          activeTabId,
        } as TabsState;
      },
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
      }),
    },
  ),
);
