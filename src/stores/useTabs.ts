import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { usePages } from "./usePages";

interface TabsState {
  openTabs: string[];
  activeTabId: string | null;

  openTab: (pageId: string) => void;
  closeTab: (pageId: string) => void;
  closeOtherTabs: (pageId: string) => void;
  setActiveTab: (pageId: string) => void;
  reorderTabs: (from: number, to: number) => void;
  removeDeletedPage: (pageId: string) => void;
}

export const useTabs = create<TabsState>()(
  persist(
    (set, get) => ({
      openTabs: [],
      activeTabId: null,

      openTab: (pageId: string) => {
        const { openTabs } = get();
        if (openTabs.includes(pageId)) {
          set({ activeTabId: pageId });
        } else {
          set({
            openTabs: [...openTabs, pageId],
            activeTabId: pageId,
          });
        }
        void usePages.getState().setActivePage(pageId);
      },

      closeTab: (pageId: string) => {
        const { openTabs, activeTabId } = get();
        const index = openTabs.indexOf(pageId);
        if (index === -1) return;

        const nextTabs = openTabs.filter((id) => id !== pageId);

        let nextActiveId: string | null = null;
        if (activeTabId === pageId && nextTabs.length > 0) {
          // 优先激活右边的标签，如果没有则激活左边的
          nextActiveId =
            nextTabs[Math.min(index, nextTabs.length - 1)] ?? null;
        } else if (activeTabId !== pageId) {
          nextActiveId = activeTabId;
        }

        set({ openTabs: nextTabs, activeTabId: nextActiveId });
        void usePages.getState().setActivePage(nextActiveId);
      },

      closeOtherTabs: (pageId: string) => {
        const { openTabs } = get();
        if (!openTabs.includes(pageId)) return;
        set({ openTabs: [pageId], activeTabId: pageId });
        void usePages.getState().setActivePage(pageId);
      },

      setActiveTab: (pageId: string) => {
        const { openTabs } = get();
        if (!openTabs.includes(pageId)) return;
        set({ activeTabId: pageId });
        void usePages.getState().setActivePage(pageId);
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
        const { openTabs } = get();
        if (!openTabs.includes(pageId)) return;
        get().closeTab(pageId);
      },
    }),
    {
      name: "goose-note-tabs",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
      }),
    },
  ),
);
