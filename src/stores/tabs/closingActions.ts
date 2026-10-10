import type { TabSet, TabGet, TabsState } from "./types";
import type { TabsActionContext } from "./context";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { isSpecialTab } from "./types";
import {
  commitActiveEditor,
  collectTabPageIds,
  flushClosedPageSaves,
  workspaceTabPageId,
  scheduleSetActivePage,
  applyPinnedOrder,
  collectTabsPageIds,
} from "./helpers";
import { usePages } from "../usePages";
import {
  isUnsavedLocalPage,
  localPageHasPersistableContent,
} from "@/lib/unsavedLocalPage";
import { useNotebooks } from "../useNotebooks";

export function createClosingTabActions(
  set: TabSet,
  get: TabGet,
  context: TabsActionContext,
): Pick<
  TabsState,
  "closeTab" | "closeOtherTabs" | "closeTabsToLeft" | "closeTabsToRight"
> {
  const { syncHistoryWithOpenTabs, resolveTabIdInHistory } = context;
  return {
    closeTab: (tabId: string) => {
      if (effectiveSingleTabMode()) return;
      const { openTabs, activeTabId, recentlyClosedPageIds } = get();
      const index = openTabs.findIndex((tab) => tab.id === tabId);
      if (index === -1) return;

      const closedTab = openTabs[index];
      const special = isSpecialTab(closedTab);
      // 关闭前确保该页的编辑已落盘（本地文件夹页面采用自动保存队列）。
      if (tabId === activeTabId) commitActiveEditor();
      if (!special) {
        const closedPageIds = collectTabPageIds(closedTab);
        const toFlush: string[] = [];
        for (const pageId of closedPageIds) {
          const closedPage = usePages.getState().getPage(pageId);
          if (
            isUnsavedLocalPage(closedPage) &&
            !localPageHasPersistableContent(closedPage.content)
          ) {
            usePages.getState().discardUnsavedLocalPage(pageId);
          } else {
            toFlush.push(pageId);
          }
        }
        flushClosedPageSaves(toFlush);
        if (toFlush.length > 0) {
          const nextClosed = [
            ...toFlush,
            ...recentlyClosedPageIds.filter((id) => !toFlush.includes(id)),
          ].slice(0, 10);
          set({ recentlyClosedPageIds: nextClosed });
        }
      }

      const nextTabs = openTabs.filter((tab) => tab.id !== tabId);

      // 关闭最后一个标签后，自动补一个 welcome 占位标签，保持标签栏不消失（对齐浏览器/VSCode）。
      if (nextTabs.length === 0) {
        set({ openTabs: [], activeTabId: null });
        get().openWelcomeTab();
        return;
      }

      let nextActiveId: string | null = null;
      if (activeTabId === tabId && nextTabs.length > 0) {
        nextActiveId =
          nextTabs[Math.min(index, nextTabs.length - 1)]?.id ?? null;
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
    },

    closeOtherTabs: (tabId: string) => {
      if (effectiveSingleTabMode()) return;
      const { openTabs, activeTabId } = get();
      const currentTab = openTabs.find((tab) => tab.id === tabId);
      if (!currentTab) return;

      // 固定标签不被「关闭其他」关掉。
      const nextTabs = applyPinnedOrder([
        ...openTabs.filter((tab) => tab.pinned && tab.id !== tabId),
        currentTab,
      ]);

      // 计算被关闭的 tab 集合，flush 落盘并在失败时 toast 警告。
      const nextTabIds = new Set(nextTabs.map((t) => t.id));
      const closedTabs = openTabs.filter((t) => !nextTabIds.has(t.id));
      if (closedTabs.some((t) => t.id === activeTabId)) commitActiveEditor();
      flushClosedPageSaves(collectTabsPageIds(closedTabs));

      const historyState = syncHistoryWithOpenTabs(nextTabs);
      set({
        openTabs: nextTabs,
        activeTabId: currentTab.id,
        ...historyState,
      });
      get().syncNotebookForPage(workspaceTabPageId(currentTab));
      void scheduleSetActivePage(workspaceTabPageId(currentTab));
    },

    closeTabsToLeft: (tabId: string) => {
      if (effectiveSingleTabMode()) return;
      const { openTabs, activeTabId } = get();
      const currentIndex = openTabs.findIndex((tab) => tab.id === tabId);
      if (currentIndex <= 0) return;

      // 保留固定标签 + 当前标签及其右侧。
      const keep = openTabs.slice(currentIndex);
      const pinnedLeft = openTabs
        .slice(0, currentIndex)
        .filter((tab) => tab.pinned);
      const nextTabs = applyPinnedOrder([...pinnedLeft, ...keep]);
      const nextActiveId = nextTabs.some((tab) => tab.id === activeTabId)
        ? activeTabId
        : tabId;

      // 计算被关闭的 tab 集合，flush 落盘并在失败时 toast 警告。
      const nextTabIds = new Set(nextTabs.map((t) => t.id));
      const closedTabs = openTabs.filter((t) => !nextTabIds.has(t.id));
      if (closedTabs.some((t) => t.id === activeTabId)) commitActiveEditor();
      flushClosedPageSaves(collectTabsPageIds(closedTabs));

      const historyState = syncHistoryWithOpenTabs(nextTabs);

      set({
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        ...historyState,
      });
      const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId);
      const nextPageId = nextActiveTab
        ? isSpecialTab(nextActiveTab)
          ? null
          : workspaceTabPageId(nextActiveTab)
        : null;
      get().syncNotebookForPage(nextPageId);
      void scheduleSetActivePage(nextPageId);
    },

    closeTabsToRight: (tabId: string) => {
      if (effectiveSingleTabMode()) return;
      const { openTabs, activeTabId } = get();
      const currentIndex = openTabs.findIndex((tab) => tab.id === tabId);
      if (currentIndex === -1 || currentIndex >= openTabs.length - 1) return;

      // 保留固定标签 + 当前标签及其左侧。
      const keep = openTabs.slice(0, currentIndex + 1);
      const pinnedRight = openTabs
        .slice(currentIndex + 1)
        .filter((tab) => tab.pinned);
      const nextTabs = applyPinnedOrder([...keep, ...pinnedRight]);
      const nextActiveId = nextTabs.some((tab) => tab.id === activeTabId)
        ? activeTabId
        : tabId;

      // 计算被关闭的 tab 集合，flush 落盘并在失败时 toast 警告。
      const nextTabIds = new Set(nextTabs.map((t) => t.id));
      const closedTabs = openTabs.filter((t) => !nextTabIds.has(t.id));
      if (closedTabs.some((t) => t.id === activeTabId)) commitActiveEditor();
      flushClosedPageSaves(collectTabsPageIds(closedTabs));

      const historyState = syncHistoryWithOpenTabs(nextTabs);

      set({
        openTabs: nextTabs,
        activeTabId: nextActiveId,
        ...historyState,
      });
      const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId);
      const nextPageId = nextActiveTab
        ? isSpecialTab(nextActiveTab)
          ? null
          : workspaceTabPageId(nextActiveTab)
        : null;
      get().syncNotebookForPage(nextPageId);
      void scheduleSetActivePage(nextPageId);
    },
  };
}
