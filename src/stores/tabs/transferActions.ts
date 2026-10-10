import type { TabSet, TabGet, TabsState, TabItem } from "./types";
import type { TabsActionContext } from "./context";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import {
  findTabByPageId,
  stampTabAccess,
  commitActiveEditor,
  ensureSplitForWorkspaceTab,
  scheduleSetActivePage,
  applyPinnedOrder,
  flushClosedPageSaves,
  collectTabPageIds,
  workspaceTabPageId,
} from "./helpers";
import { useNotebooks } from "../useNotebooks";
import { isSpecialTab } from "./types";
import { useEditorSplit } from "../useEditorSplit";

export function createTransferTabActions(
  set: TabSet,
  get: TabGet,
  context: TabsActionContext,
): Pick<TabsState, "adoptTab" | "releaseTab"> {
  const { syncHistoryWithOpenTabs, pushTabHistory, resolveTabIdInHistory } =
    context;
  return {
    adoptTab: (incoming, insertIndex) => {
      if (effectiveSingleTabMode()) return;
      if (!incoming?.id || !incoming.pageId) return;
      const { openTabs, activeTabId } = get();
      const existingById = openTabs.find((tab) => tab.id === incoming.id);
      if (existingById) {
        get().setActiveTab(existingById.id);
        return;
      }
      if (incoming.type !== "welcome" && incoming.type !== "notebook-ai") {
        const existingByPage = findTabByPageId(openTabs, incoming.pageId);
        if (existingByPage) {
          get().setActiveTab(existingByPage.id);
          return;
        }
      }

      const adopted: TabItem = stampTabAccess({
        id: incoming.id,
        pageId: incoming.pageId,
        type: incoming.type,
        pinned: incoming.pinned,
        preview: incoming.preview,
        workspaceId: incoming.workspaceId,
      });

      const onlyWelcome =
        openTabs.length === 1 && openTabs[0]?.type === "welcome";
      if (onlyWelcome && adopted.type !== "welcome") {
        const historyState = syncHistoryWithOpenTabs([adopted]);
        if (activeTabId) commitActiveEditor();
        set({
          openTabs: [adopted],
          activeTabId: adopted.id,
          ...historyState,
        });
        ensureSplitForWorkspaceTab(adopted);
        pushTabHistory(adopted.id);
        get().syncNotebookForPage(adopted.pageId);
        void scheduleSetActivePage(adopted.pageId);
        return;
      }

      const nextTabs = [...openTabs];
      const maxIndex = nextTabs.length;
      const index =
        typeof insertIndex === "number" && Number.isFinite(insertIndex)
          ? Math.min(Math.max(0, Math.floor(insertIndex)), maxIndex)
          : maxIndex;
      nextTabs.splice(index, 0, adopted);
      const ordered = applyPinnedOrder(nextTabs);
      const orderedHistory = syncHistoryWithOpenTabs(ordered);
      if (activeTabId) commitActiveEditor();
      set({
        openTabs: ordered,
        activeTabId: adopted.id,
        ...orderedHistory,
      });
      ensureSplitForWorkspaceTab(adopted);
      pushTabHistory(adopted.id);
      if (adopted.type === "welcome") return;
      if (adopted.type === "notebook-ai") {
        if (adopted.workspaceId) {
          const notebookStore = useNotebooks.getState();
          if (notebookStore.activeNotebookId !== adopted.workspaceId) {
            notebookStore.setActiveNotebook(adopted.workspaceId);
          }
        }
        return;
      }
      get().syncNotebookForPage(adopted.pageId);
      void scheduleSetActivePage(adopted.pageId);
    },

    releaseTab: (tabId) => {
      if (effectiveSingleTabMode()) return { emptied: false };
      const { openTabs, activeTabId } = get();
      const index = openTabs.findIndex((tab) => tab.id === tabId);
      if (index === -1) return { emptied: false };

      const closedTab = openTabs[index];
      if (tabId === activeTabId) commitActiveEditor();
      if (!isSpecialTab(closedTab)) {
        flushClosedPageSaves(collectTabPageIds(closedTab));
      }

      const nextTabs = openTabs.filter((tab) => tab.id !== tabId);
      if (nextTabs.length === 0) {
        set({
          openTabs: [],
          activeTabId: null,
          ...syncHistoryWithOpenTabs([]),
        });
        useEditorSplit.getState().clearTab(tabId);
        return { emptied: true };
      }

      let nextActiveId: string | null;
      if (activeTabId === tabId) {
        nextActiveId =
          nextTabs[Math.min(index, nextTabs.length - 1)]?.id ?? null;
      } else {
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
      useEditorSplit.getState().clearTab(tabId);
      const nextActiveTab = nextTabs.find((tab) => tab.id === fallbackActiveId);
      if (nextActiveTab && !isSpecialTab(nextActiveTab)) {
        const pageId = workspaceTabPageId(nextActiveTab);
        get().syncNotebookForPage(pageId);
        void scheduleSetActivePage(pageId);
      } else if (
        nextActiveTab?.type === "notebook-ai" &&
        nextActiveTab.workspaceId
      ) {
        const notebookStore = useNotebooks.getState();
        if (notebookStore.activeNotebookId !== nextActiveTab.workspaceId) {
          notebookStore.setActiveNotebook(nextActiveTab.workspaceId);
        }
      }
      return { emptied: false };
    },
  };
}
