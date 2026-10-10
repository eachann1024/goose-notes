import type { TabSet, TabGet, TabsState, TabItem } from "./types";
import type { TabsActionContext } from "./context";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import {
  commitActiveEditor,
  createTabId,
  applyPinnedOrder,
  stampTabAccess,
  findNotebookAiTabInList,
} from "./helpers";
import { WELCOME_TAB_PAGE_ID, getNotebookAiTabPageId } from "./types";
import { isElectronRuntime } from "@/lib/electron/runtime";
import { useNotebooks } from "../useNotebooks";
import { usePages } from "../usePages";
import {
  isUnsavedLocalPage,
  localPageHasPersistableContent,
} from "@/lib/unsavedLocalPage";

export function createSpecialTabActions(
  set: TabSet,
  get: TabGet,
  context: TabsActionContext,
): Pick<
  TabsState,
  | "openWelcomeTab"
  | "openNewTab"
  | "findNotebookAiTab"
  | "openNotebookAiTab"
  | "closeNotebookAiTab"
> {
  const { pushTabHistory, replaceWithSingleWelcome } = context;
  return {
    openWelcomeTab: () => {
      if (effectiveSingleTabMode()) {
        void replaceWithSingleWelcome();
        return;
      }
      const { openTabs } = get();
      // 复用已有的欢迎 tab（同时只存在一个）
      const existingWelcome = openTabs.find((tab) => tab.type === "welcome");
      if (existingWelcome) {
        get().setActiveTab(existingWelcome.id);
        return;
      }

      commitActiveEditor();
      const now = Date.now();
      const newTab: TabItem = {
        id: createTabId(WELCOME_TAB_PAGE_ID),
        pageId: WELCOME_TAB_PAGE_ID,
        type: "welcome",
        lastAccessedAt: now,
      };
      const nextOpenTabs = applyPinnedOrder([
        ...openTabs.map((tab) =>
          tab.id === get().activeTabId ? stampTabAccess(tab, now) : tab,
        ),
        newTab,
      ]);
      set({
        openTabs: nextOpenTabs,
        activeTabId: newTab.id,
      });
      pushTabHistory(newTab.id);
      // 欢迎 tab 不关联真实页面，不调用 syncNotebookForPage / scheduleSetActivePage
    },

    openNewTab: () => {
      if (!isElectronRuntime()) {
        get().openWelcomeTab();
        return;
      }
      const notebooksStore = useNotebooks.getState();
      const workspaceId = notebooksStore.activeNotebookId;
      const notebook = workspaceId
        ? notebooksStore.notebooks[workspaceId]
        : undefined;
      if (!workspaceId || notebook?.source !== "local-folder") {
        get().openWelcomeTab();
        return;
      }
      const pages = usePages.getState().pages;
      const existingEmpty = Object.values(pages).find(
        (page) =>
          page.workspaceId === workspaceId &&
          isUnsavedLocalPage(page) &&
          !localPageHasPersistableContent(page.content),
      );
      if (existingEmpty) {
        get().openPermanentTab(existingEmpty.id, { reuseEmpty: false });
        return;
      }
      const pageId = usePages.getState().createUnsavedLocalPage(workspaceId);
      if (!pageId) {
        get().openWelcomeTab();
        return;
      }
      get().openPermanentTab(pageId, { reuseEmpty: false });
    },

    findNotebookAiTab: (notebookId: string) =>
      findNotebookAiTabInList(get().openTabs, notebookId),

    openNotebookAiTab: (notebookId: string) => {
      if (!notebookId) return;
      if (effectiveSingleTabMode()) return;
      const { openTabs, activeTabId } = get();
      const existing = findNotebookAiTabInList(openTabs, notebookId);
      if (existing) {
        if (existing.id !== activeTabId) {
          get().setActiveTab(existing.id);
        }
        return;
      }

      commitActiveEditor();
      const now = Date.now();
      const pageId = getNotebookAiTabPageId(notebookId);
      const newTab: TabItem = {
        id: createTabId(pageId),
        pageId,
        type: "notebook-ai",
        workspaceId: notebookId,
        lastAccessedAt: now,
      };
      // 独立 AI 标签默认插到固定标签之后、普通标签最前，贴近「标签栏最左入口」。
      const pinned = openTabs.filter((tab) => tab.pinned);
      const rest = openTabs.filter((tab) => !tab.pinned);
      const nextOpenTabs = [
        ...pinned.map((tab) =>
          tab.id === activeTabId ? stampTabAccess(tab, now) : tab,
        ),
        newTab,
        ...rest.map((tab) =>
          tab.id === activeTabId ? stampTabAccess(tab, now) : tab,
        ),
      ];
      set({
        openTabs: nextOpenTabs,
        activeTabId: newTab.id,
      });
      pushTabHistory(newTab.id);
      const notebookStore = useNotebooks.getState();
      if (notebookStore.activeNotebookId !== notebookId) {
        notebookStore.setActiveNotebook(notebookId);
      }
    },

    closeNotebookAiTab: (notebookId: string) => {
      if (!notebookId) return;
      const existing = findNotebookAiTabInList(get().openTabs, notebookId);
      if (existing) {
        get().closeTab(existing.id);
      }
    },
  };
}
