import type { NotebooksState } from "./types";
import { isElectronHost } from "./types";
import { usePages } from "../usePages";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { removeLocalPageMetaByWorkspaceId } from "@/lib/storage/pageRepository";
import { removeLocalFolderOrders } from "../localFolderOrder";

export function createDeleteNotebookActions(
  set: import("zustand").StoreApi<NotebooksState>["setState"],
  get: import("zustand").StoreApi<NotebooksState>["getState"],
): Pick<NotebooksState, "deleteNotebook"> {
  return {
    deleteNotebook: (id) => {
      const state = get();
      const notebookCount = Object.keys(state.notebooks).length;
      // 桌面端允许移除最后一个文件夹（回到空态）；Electron 至少保留一本。
      if (!isElectronHost && notebookCount <= 1) return;
      const deletedNotebook = state.notebooks[id];

      const pagesStore = usePages.getState();
      const tabsStore = useTabs.getState();
      const deletedPageIds = new Set(
        Object.values(pagesStore.pages)
          .filter((page) => page.workspaceId === id)
          .map((page) => page.id),
      );
      const remainingPages = Object.values(pagesStore.pages).filter(
        (page) => page.workspaceId !== id && !page.trashedAt,
      );
      const remainingPageById = new Map(
        remainingPages.map((page) => [page.id, page]),
      );

      const { [id]: _deletedNotebook, ...remainingNotebooks } = state.notebooks;
      const { [id]: _deletedLastActive, ...remainingLastActive } =
        state.lastActivePageByNotebook;
      const { [id]: _deletedLoadState, ...remainingLoadStates } =
        state.localFolderLoadStates;

      let remainingTabs = tabsStore.openTabs.filter(
        (tab) => !deletedPageIds.has(tab.pageId),
      );
      if (effectiveSingleTabMode() && remainingTabs.length > 1) {
        const active = remainingTabs.find(
          (tab) => tab.id === tabsStore.activeTabId,
        );
        remainingTabs = active ? [active] : [remainingTabs[0]];
      }
      const nextActiveTabId =
        tabsStore.activeTabId &&
        remainingTabs.some((tab) => tab.id === tabsStore.activeTabId)
          ? tabsStore.activeTabId
          : (remainingTabs[0]?.id ?? null);
      const nextActiveTab = remainingTabs.find(
        (tab) => tab.id === nextActiveTabId,
      );
      const nextTabPage = nextActiveTab
        ? remainingPageById.get(nextActiveTab.pageId)
        : undefined;

      const remainingNotebookIds = Object.keys(remainingNotebooks);
      const nextActiveNotebookId =
        nextTabPage?.workspaceId ??
        (state.activeNotebookId === id
          ? remainingNotebookIds[0] || null
          : state.activeNotebookId);

      let nextActivePageId =
        nextTabPage?.id ??
        (pagesStore.activePageId && !deletedPageIds.has(pagesStore.activePageId)
          ? pagesStore.activePageId
          : null);

      if (!nextActivePageId && nextActiveNotebookId) {
        const nextLastPageId = remainingLastActive[nextActiveNotebookId];
        if (nextLastPageId && remainingPageById.has(nextLastPageId)) {
          nextActivePageId = nextLastPageId;
        } else {
          const firstValidPage = remainingPages
            .filter((page) => page.workspaceId === nextActiveNotebookId)
            .sort(
              (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
            )[0];
          nextActivePageId = firstValidPage?.id ?? null;
        }
      }

      pagesStore.removePagesByWorkspaceId(id, { purgePersistence: true });
      if (deletedNotebook?.source === "local-folder") {
        removeLocalPageMetaByWorkspaceId(id);
        removeLocalFolderOrders(id);
      }
      useTabs.setState({
        openTabs: remainingTabs,
        activeTabId: nextActiveTabId,
      });
      set({
        notebooks: remainingNotebooks,
        lastActivePageByNotebook: remainingLastActive,
        localFolderLoadStates: remainingLoadStates,
        activeNotebookId: nextActiveNotebookId,
      });

      if (
        state.activeNotebookId === id ||
        deletedPageIds.has(pagesStore.activePageId || "") ||
        nextActiveTabId !== tabsStore.activeTabId
      ) {
        void pagesStore.setActivePage(nextActivePageId);
      }
    },
  };
}
