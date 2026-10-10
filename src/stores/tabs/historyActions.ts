import type { TabSet, TabGet, TabsState } from "./types";
import type { TabsActionContext } from "./context";
import { useFileNavHistory } from "../useFileNavHistory";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { applyPinnedOrder, orderTabs } from "./helpers";

export function createHistoryTabActions(
  set: TabSet,
  get: TabGet,
  context: TabsActionContext,
): Pick<
  TabsState,
  | "goBackTabHistory"
  | "goForwardTabHistory"
  | "canGoBackTabHistory"
  | "canGoForwardTabHistory"
  | "reorderTabs"
  | "togglePinTab"
> {
  const { stepFileNavHistory } = context;
  return {
    goBackTabHistory: () => {
      set({ isHistoryNavigating: true });
      try {
        stepFileNavHistory("back");
      } finally {
        set({ isHistoryNavigating: false });
      }
    },

    goForwardTabHistory: () => {
      set({ isHistoryNavigating: true });
      try {
        stepFileNavHistory("forward");
      } finally {
        set({ isHistoryNavigating: false });
      }
    },

    canGoBackTabHistory: () => useFileNavHistory.getState().canBack(),

    canGoForwardTabHistory: () => useFileNavHistory.getState().canForward(),

    reorderTabs: (from: number, to: number) => {
      if (effectiveSingleTabMode()) return;
      const { openTabs } = get();
      if (from < 0 || from >= openTabs.length) return;
      if (to < 0 || to >= openTabs.length) return;

      const nextTabs = [...openTabs];
      const [moved] = nextTabs.splice(from, 1);
      nextTabs.splice(to, 0, moved);
      // 固定标签恒在前，拖拽后重新归位以维持不变式。
      set({ openTabs: applyPinnedOrder(nextTabs) });
    },

    togglePinTab: (tabId: string) => {
      if (effectiveSingleTabMode()) return;
      const { openTabs } = get();
      const exists = openTabs.some((tab) => tab.id === tabId);
      if (!exists) return;
      const nextTabs = orderTabs(
        openTabs.map((tab) => {
          if (tab.id !== tabId) return tab;
          const pinned = !tab.pinned;
          return {
            ...tab,
            pinned,
            preview: pinned ? false : tab.preview,
          };
        }),
      );
      set({ openTabs: nextTabs });
    },
  };
}
