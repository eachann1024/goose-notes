import type { TabSet, TabGet, TabsState, TabItem } from "./types";
import type { TabsActionContext } from "./context";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import {
  findTabByPageId,
  commitActiveEditor,
  focusTabLeafForPage,
  createTabId,
  getWorkspaceIdForPage,
  orderTabs,
  stampTabAccess,
  ensureSplitForWorkspaceTab,
  scheduleSetActivePage,
  tabShowsPageId,
} from "./helpers";

export function createOpeningTabActions(
  set: TabSet,
  get: TabGet,
  context: TabsActionContext,
): Pick<
  TabsState,
  | "openTab"
  | "openPermanentTab"
  | "openPreviewTab"
  | "promotePreviewTab"
  | "openInCurrentTab"
> {
  const {
    pushTabHistory,
    adoptActiveEmptyWorkspaceTab,
    replaceWithSinglePage,
    invalidateSingleTabSwitch,
  } = context;
  return {
    openTab: (pageId: string) => {
      get().openInCurrentTab(pageId);
    },

    openPermanentTab: (
      pageId: string,
      options?: { pin?: boolean; reuseEmpty?: boolean },
    ) => {
      if (effectiveSingleTabMode()) {
        void replaceWithSinglePage(pageId);
        return;
      }
      const { openTabs, activeTabId } = get();
      const existingTab = findTabByPageId(openTabs, pageId);
      if (existingTab) {
        if (existingTab.id !== activeTabId) commitActiveEditor();
        if (existingTab.preview) {
          get().promotePreviewTab(existingTab.id);
        }
        if (options?.pin && !existingTab.pinned) {
          get().togglePinTab(existingTab.id);
        }
        focusTabLeafForPage(existingTab.id, pageId);
        get().setActiveTab(existingTab.id);
        return;
      }

      if (
        options?.reuseEmpty !== false &&
        adoptActiveEmptyWorkspaceTab(pageId, false)
      ) {
        if (options?.pin) {
          const adoptedId = get().activeTabId;
          if (adoptedId) get().togglePinTab(adoptedId);
        }
        return;
      }

      commitActiveEditor();
      const now = Date.now();
      const newTab: TabItem = {
        id: createTabId(pageId),
        pageId,
        workspaceId: getWorkspaceIdForPage(pageId),
        pinned: options?.pin ? true : undefined,
        preview: false,
        lastAccessedAt: now,
      };
      const nextOpenTabs = orderTabs([
        ...openTabs.map((tab) =>
          tab.id === activeTabId ? stampTabAccess(tab, now) : tab,
        ),
        newTab,
      ]);
      set({
        openTabs: nextOpenTabs,
        activeTabId: newTab.id,
      });
      ensureSplitForWorkspaceTab(newTab);
      pushTabHistory(newTab.id);
      get().syncNotebookForPage(pageId);
      void scheduleSetActivePage(pageId);
    },

    openPreviewTab: (pageId: string) => {
      get().openInCurrentTab(pageId);
    },

    promotePreviewTab: (tabId?: string) => {
      const { openTabs, activeTabId } = get();
      const targetId = tabId ?? activeTabId;
      if (!targetId) return;
      const target = openTabs.find((tab) => tab.id === targetId);
      if (!target?.preview) return;
      const nextTabs = orderTabs(
        openTabs.map((tab) =>
          tab.id === targetId ? { ...tab, preview: false } : tab,
        ),
      );
      set({ openTabs: nextTabs });
    },

    openInCurrentTab: (pageId: string) => {
      invalidateSingleTabSwitch();
      if (effectiveSingleTabMode()) {
        void replaceWithSinglePage(pageId);
        return;
      }
      const { openTabs, activeTabId } = get();
      const activeTab = openTabs.find((tab) => tab.id === activeTabId);
      if (activeTab && tabShowsPageId(activeTab, pageId)) {
        focusTabLeafForPage(activeTab.id, pageId);
        get().setActiveTab(activeTab.id);
        return;
      }
      const existing = findTabByPageId(openTabs, pageId);
      if (existing) {
        // ponytail: 已打开的目标只切回既有标签，不复制页面；若必须留在当前槽位，再实现标签内容交换。
        focusTabLeafForPage(existing.id, pageId);
        get().setActiveTab(existing.id);
        return;
      }
      void replaceWithSinglePage(pageId, true);
    },
  };
}
