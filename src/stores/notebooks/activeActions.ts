import type { NotebooksState } from "./types";
import { usePages } from "../usePages";
import { fs } from "@/lib/electron-platform/fs";
import { IDLE_LOCAL_FOLDER_LOAD_STATE } from "./types";

export function createActiveNotebookActions(
  set: import("zustand").StoreApi<NotebooksState>["setState"],
  get: import("zustand").StoreApi<NotebooksState>["getState"],
): Pick<
  NotebooksState,
  | "setActiveNotebook"
  | "getNotebook"
  | "setLastActivePage"
  | "getLastActivePage"
  | "setLocalFolderLoadState"
  | "getLocalFolderLoadState"
> {
  return {
    setActiveNotebook: (id) => {
      const pagesStore = usePages.getState();
      const pendingId = pagesStore.pendingNavigatePageId;
      const pendingPage = pendingId ? pagesStore.pages[pendingId] : undefined;
      const notebook = get().notebooks[id];
      const lastActivePageId = get().lastActivePageByNotebook[id];
      const lastActivePage = lastActivePageId
        ? pagesStore.pages[lastActivePageId]
        : undefined;
      // 已经打开过的本地库可立即回到其缓存的上次页面，再在后台重扫。
      // 这条普通的侧栏切库路径没有 pending target，不能因此回退到空白页。
      const cachedLocalLandingPageId =
        notebook?.source === "local-folder" &&
        lastActivePage?.workspaceId === id &&
        !lastActivePage.trashedAt
          ? lastActivePage.id
          : null;
      // 分屏/搜索的跨本导航已明确目标页时，目标页本来就在内存树中。
      // 不能先清 activePage 再在同一链路写回，否则主区会短暂卸载为
      // 空白页；真实重扫若发现目标不存在，loader 仍会在完成时清理它。
      const keepsPendingTarget = pendingPage?.workspaceId === id;
      set({ activeNotebookId: id });
      if (notebook?.source === "local-folder" && !keepsPendingTarget) {
        void pagesStore.setActivePage(cachedLocalLandingPageId);
      }
      if (
        notebook?.source === "local-folder" &&
        notebook.localPath &&
        typeof window !== "undefined" &&
        fs.isAvailable()
      ) {
        void (async () => {
          const exists = await fs.existsAsync(notebook.localPath!);

          if (get().activeNotebookId !== id) return;

          if (exists) {
            if (notebook.localPathMissing) {
              get().updateNotebook(id, { localPathMissing: false });
            }
            await usePages
              .getState()
              .loadLocalFolderPages(id, notebook.localPath!);
          } else {
            if (!notebook.localPathMissing) {
              get().updateNotebook(id, { localPathMissing: true });
            }
            usePages.getState().removePagesByWorkspaceId(id);
          }
        })().catch((error) => {
          console.error("[local-folder] 切换记事本时加载失败", error);
        });
      }

      if (pendingId) {
        if (pendingPage && pendingPage.workspaceId === id) {
          pagesStore.setActivePage(pendingId);
          pagesStore.setExpandPageId(pendingId);

          // 如果是本地文件夹笔记本，且正在重新加载页面，暂不清除 pendingNavigatePageId
          // 让 loadLocalFolderPages 在加载完成后处理（能够确保页面存在且触发展开）
          const isLoadingLocal =
            notebook?.source === "local-folder" &&
            notebook.localPath &&
            typeof window !== "undefined" &&
            fs.isAvailable();

          if (!isLoadingLocal) {
            pagesStore.setPendingNavigatePageId(null);
          }
        }
      }
    },

    getNotebook: (id) => {
      return get().notebooks[id];
    },

    setLastActivePage: (notebookId, pageId) => {
      set((state) => ({
        lastActivePageByNotebook: {
          ...state.lastActivePageByNotebook,
          [notebookId]: pageId,
        },
      }));
    },

    getLastActivePage: (notebookId) => {
      return get().lastActivePageByNotebook[notebookId] || null;
    },

    setLocalFolderLoadState: (notebookId, loadState) => {
      set((state) => ({
        localFolderLoadStates: {
          ...state.localFolderLoadStates,
          [notebookId]: loadState,
        },
      }));
    },

    getLocalFolderLoadState: (notebookId) => {
      return (
        get().localFolderLoadStates[notebookId] ?? IDLE_LOCAL_FOLDER_LOAD_STATE
      );
    },
  };
}
