import type { TabSet, TabGet, TabItem } from "./types";
import { usePages } from "../usePages";
import {
  isUnsavedLocalPage,
  localPageHasPersistableContent,
} from "@/lib/unsavedLocalPage";
import { useEditorSplit } from "../useEditorSplit";
import { isReusableEmptyWorkspaceTab } from "@/pages/workspace/components/page/visibleTabs";
import {
  commitActiveEditor,
  getWorkspaceIdForPage,
  ensureSplitForWorkspaceTab,
  scheduleSetActivePage,
  workspaceTabPageId,
  createTabId,
} from "./helpers";
import {
  useFileNavHistory,
  pageFileNavKey,
  FILE_NAV_WELCOME,
} from "../useFileNavHistory";
import { isSpecialTab, WELCOME_TAB_PAGE_ID } from "./types";
import { toast } from "@/components/ui/sonner";
import { describeDiskWriteError } from "@/lib/diskWriteError";
import { isRecoveredLocalSaveConfirmationRequired } from "../pages/folderSync";

export function createTabReplacementContext(
  set: TabSet,
  get: TabGet,
  pushTabHistory: (tabId: string) => void,
) {
  let singleTabSwitchToken = 0;
  const invalidateSingleTabSwitch = () => {
    ++singleTabSwitchToken;
  };

  const discardReplacedEmptyPage = (
    previousPageId: string,
    nextPageId: string,
  ) => {
    if (!previousPageId || previousPageId === nextPageId) return;
    const previousPage = usePages.getState().getPage(previousPageId);
    if (
      isUnsavedLocalPage(previousPage) &&
      !localPageHasPersistableContent(previousPage.content)
    ) {
      usePages.getState().discardUnsavedLocalPage(previousPageId);
    }
  };

  /** 当前标签是加号新建的空编辑器时，打开其他页面填入该标签，而不是再开一个。 */
  const adoptActiveEmptyWorkspaceTab = (
    pageId: string,
    preview: boolean,
  ): boolean => {
    const { openTabs, activeTabId } = get();
    if (!activeTabId) return false;
    const activeTab = openTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return false;
    if (useEditorSplit.getState().isSplit(activeTab.id)) return false;
    if (
      !isReusableEmptyWorkspaceTab(activeTab, (id) =>
        usePages.getState().getPage(id),
      )
    ) {
      return false;
    }

    commitActiveEditor();
    const previousPageId = activeTab.pageId;
    const now = Date.now();
    const nextTab: TabItem = {
      id: activeTab.id,
      pageId,
      workspaceId: getWorkspaceIdForPage(pageId),
      pinned: activeTab.pinned,
      preview,
      lastAccessedAt: now,
    };
    set({
      openTabs: openTabs.map((tab) =>
        tab.id === activeTab.id ? nextTab : tab,
      ),
      activeTabId: nextTab.id,
    });
    ensureSplitForWorkspaceTab(nextTab);
    pushTabHistory(nextTab.id);
    get().syncNotebookForPage(pageId);
    void scheduleSetActivePage(pageId);
    discardReplacedEmptyPage(previousPageId, pageId);
    return true;
  };

  const replaceWithSinglePage = async (
    pageId: string,
    preserveOtherTabs = false,
  ) => {
    const targetPage = usePages.getState().getPage(pageId);
    if (!targetPage || targetPage.trashedAt) return;

    const { openTabs, activeTabId } = get();
    const activeTab = openTabs.find((tab) => tab.id === activeTabId);
    if (activeTab?.pageId === pageId) {
      if (!preserveOtherTabs && openTabs.length > 1) {
        set({
          openTabs: [activeTab],
          activeTabId: activeTab.id,
          tabHistory: [activeTab.id],
          tabHistoryIndex: 0,
          isHistoryNavigating: false,
        });
      }
      useFileNavHistory.getState().push(pageFileNavKey(pageId));
      get().syncNotebookForPage(pageId);
      void scheduleSetActivePage(pageId);
      return;
    }

    const token = ++singleTabSwitchToken;
    commitActiveEditor();

    const currentPageId =
      activeTab && !isSpecialTab(activeTab)
        ? workspaceTabPageId(activeTab)
        : null;
    if (currentPageId) {
      try {
        await usePages.getState().flushPendingLocalSaveByPageId(currentPageId);
      } catch (error) {
        toast.error("当前笔记保存失败，未切换", {
          description: describeDiskWriteError(error),
        });
        return;
      }
      if (token !== singleTabSwitchToken) return;
      if (
        usePages.getState().dirtyLocalPageIds[currentPageId] &&
        !isRecoveredLocalSaveConfirmationRequired(currentPageId)
      ) {
        const currentPage = usePages.getState().getPage(currentPageId);
        toast.error("当前笔记保存失败，未切换", {
          description: currentPage
            ? describeDiskWriteError(
                new Error(`本地页面保存未完成：${currentPageId}`),
              )
            : "请先处理当前文件的保存状态。",
        });
        return;
      }
    }

    if (
      token !== singleTabSwitchToken ||
      (preserveOtherTabs && get().activeTabId !== activeTabId)
    )
      return;
    const now = Date.now();
    const newTab: TabItem = {
      id: preserveOtherTabs && activeTab ? activeTab.id : createTabId(pageId),
      pageId,
      workspaceId: getWorkspaceIdForPage(pageId),
      pinned: preserveOtherTabs ? activeTab?.pinned : undefined,
      preview: false,
      lastAccessedAt: now,
    };
    if (preserveOtherTabs) {
      const split =
        activeTab && useEditorSplit.getState().getStateForTab(activeTab.id);
      if (
        split &&
        activeTab &&
        useEditorSplit.getState().isSplit(activeTab.id)
      ) {
        useEditorSplit
          .getState()
          .setPanePage(activeTab.id, split.focusedLeafId, pageId);
      }
      set({
        openTabs: activeTab
          ? get().openTabs.map((tab) =>
              tab.id === activeTab.id ? newTab : tab,
            )
          : [...get().openTabs, newTab],
        activeTabId: newTab.id,
      });
      ensureSplitForWorkspaceTab(newTab);
      pushTabHistory(newTab.id);
      if (currentPageId) discardReplacedEmptyPage(currentPageId, pageId);
    } else {
      set({
        openTabs: [newTab],
        activeTabId: newTab.id,
        tabHistory: [newTab.id],
        tabHistoryIndex: 0,
        isHistoryNavigating: false,
      });
      useFileNavHistory.getState().push(pageFileNavKey(pageId));
      ensureSplitForWorkspaceTab(newTab);
    }
    get().syncNotebookForPage(pageId);
    await scheduleSetActivePage(pageId);
  };

  const replaceWithSingleWelcome = async () => {
    const { openTabs, activeTabId } = get();
    const activeTab = openTabs.find((tab) => tab.id === activeTabId);
    if (activeTab?.type === "welcome" && openTabs.length === 1) return;

    const token = ++singleTabSwitchToken;
    commitActiveEditor();
    const currentPageId =
      activeTab && !isSpecialTab(activeTab) ? activeTab.pageId : null;
    if (currentPageId) {
      try {
        await usePages.getState().flushPendingLocalSaveByPageId(currentPageId);
      } catch (error) {
        toast.error("当前笔记保存失败，未切换", {
          description: describeDiskWriteError(error),
        });
        return;
      }
      if (token !== singleTabSwitchToken) return;
      if (
        usePages.getState().dirtyLocalPageIds[currentPageId] &&
        !isRecoveredLocalSaveConfirmationRequired(currentPageId)
      ) {
        toast.error("当前笔记保存失败，未切换", {
          description: describeDiskWriteError(
            new Error(`本地页面保存未完成：${currentPageId}`),
          ),
        });
        return;
      }
    }

    const welcomeTab: TabItem = {
      id: createTabId(WELCOME_TAB_PAGE_ID),
      pageId: WELCOME_TAB_PAGE_ID,
      type: "welcome",
      lastAccessedAt: Date.now(),
    };
    set({
      openTabs: [welcomeTab],
      activeTabId: welcomeTab.id,
      tabHistory: [welcomeTab.id],
      tabHistoryIndex: 0,
      isHistoryNavigating: false,
    });
    useFileNavHistory.getState().push(FILE_NAV_WELCOME);
    await scheduleSetActivePage(null);
  };
  return {
    invalidateSingleTabSwitch,
    discardReplacedEmptyPage,
    adoptActiveEmptyWorkspaceTab,
    replaceWithSinglePage,
    replaceWithSingleWelcome,
  };
}
