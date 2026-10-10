import type { TabSet, TabGet, TabsState } from "./types";
import type { TabsActionContext } from "./context";
import { usePages } from "../usePages";
import { isSpecialTab } from "./types";
import {
  closeSplitLeavesForDeletedPage,
  scheduleSetActivePage,
  tabShowsPageId,
  workspaceTabPageId,
} from "./helpers";
import { useEditorSplit } from "../useEditorSplit";
import { effectiveSingleTabMode } from "@/lib/tabMode";

export function createDeletedTabActions(
  set: TabSet,
  get: TabGet,
  context: TabsActionContext,
): Pick<TabsState, "removeDeletedPage"> {
  const { syncHistoryWithOpenTabs, resolveTabIdInHistory } = context;
  return {
    removeDeletedPage: (pageId: string) => {
      const { openTabs, activeTabId } = get();
      const deletedPage = usePages.getState().getPage(pageId);
      const preferredPageId = usePages.getState().activePageId;
      const closedPaneTabIds: string[] = [];
      const tabsToClose = new Set<string>();

      for (const tab of openTabs) {
        if (isSpecialTab(tab)) continue;
        const paneResult = closeSplitLeavesForDeletedPage(tab.id, pageId);
        if (paneResult === "closed-pane") {
          closedPaneTabIds.push(tab.id);
          const focusedPageId = useEditorSplit.getState().focusedPageId(tab.id);
          if (focusedPageId) get().syncTabPageId(tab.id, focusedPageId);
          continue;
        }
        if (paneResult === "close-tab" || tab.pageId === pageId) {
          tabsToClose.add(tab.id);
        }
      }

      if (closedPaneTabIds.length > 0 && tabsToClose.size === 0) {
        const activeTab = openTabs.find((tab) => tab.id === activeTabId);
        const focusedPageId = activeTab
          ? (useEditorSplit.getState().focusedPageId(activeTab.id) ??
            activeTab.pageId)
          : null;
        if (
          focusedPageId &&
          focusedPageId !== pageId &&
          (!preferredPageId || preferredPageId === pageId)
        ) {
          get().syncNotebookForPage(focusedPageId);
          void scheduleSetActivePage(focusedPageId);
        }
        return;
      }

      if (tabsToClose.size === 0) return;

      const deletedIndex = openTabs.findIndex((tab) => tabsToClose.has(tab.id));
      const nextTabs = openTabs.filter((tab) => !tabsToClose.has(tab.id));
      if (nextTabs.length === 0) {
        set({ openTabs: [], activeTabId: null });
        get().openWelcomeTab();
        return;
      }

      let finalTabs = nextTabs;
      let nextActiveId = activeTabId;

      if (!nextActiveId || tabsToClose.has(nextActiveId)) {
        const preferredPage =
          preferredPageId && preferredPageId !== pageId
            ? usePages.getState().getPage(preferredPageId)
            : undefined;
        const preferredStillOpen =
          preferredPage && !preferredPage.trashedAt
            ? nextTabs.find((tab) => tabShowsPageId(tab, preferredPage.id))
            : undefined;

        if (preferredStillOpen) {
          nextActiveId = preferredStillOpen.id;
        } else {
          nextActiveId =
            nextTabs[Math.min(Math.max(deletedIndex, 0), nextTabs.length - 1)]
              ?.id ?? null;
        }
      }

      if (effectiveSingleTabMode() && finalTabs.length > 1) {
        const preferred = finalTabs.find((tab) => tab.id === nextActiveId);
        const onlyTab = preferred ?? finalTabs[finalTabs.length - 1];
        finalTabs = onlyTab ? [onlyTab] : [];
        nextActiveId = onlyTab?.id ?? null;
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

      const nextActiveTab = finalTabs.find(
        (tab) => tab.id === fallbackActiveId,
      );
      if (nextActiveTab && !isSpecialTab(nextActiveTab)) {
        const nextPageId = workspaceTabPageId(nextActiveTab);
        if (nextPageId !== pageId) {
          get().syncNotebookForPage(nextPageId);
          void scheduleSetActivePage(nextPageId);
        }
      } else if (!deletedPage?.trashedAt) {
        get().syncNotebookForPage(null);
        void scheduleSetActivePage(null);
      }
    },
  };
}
