import { useEffect } from "react";
import { UToolsAdapter } from "@/lib/utools";
import { useSettings } from "@/stores/useSettings";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { useStickyNote } from "@/stores/useStickyNote";
import { fs } from "@/lib/utools/fs";
import { handleClip } from "@/lib/clipper/handleClip";
import type { PluginEnterOptional } from "@/lib/utools/lifecycle";

type UToolsPluginEnterDetail = {
  code?: string;
  type?: string;
  payload?: unknown;
  optional?: PluginEnterOptional;
  from?: string;
};

const applyUToolsWindowHeight = () => {
  const state = useSettings.getState();
  if (state.utools.windowHeight) {
    UToolsAdapter.setExpendHeight(state.utools.windowHeight);
  }
};

const resolveRestorablePageId = () => {
  const notebooksStore = useNotebooks.getState();
  const pagesStore = usePages.getState();
  const activeNotebookId = notebooksStore.activeNotebookId;
  if (!activeNotebookId) return null;

  const pages = pagesStore.pages;
  const lastPageId = notebooksStore.getLastActivePage(activeNotebookId);
  const lastPage = lastPageId ? pages[lastPageId] : null;
  if (
    lastPage &&
    lastPage.workspaceId === activeNotebookId &&
    !lastPage.trashedAt
  ) {
    return lastPageId;
  }

  const activeNotebook = notebooksStore.notebooks[activeNotebookId];
  if (activeNotebook?.source === "local-folder") {
    return null;
  }

  const firstValidPage = Object.values(pages)
    .filter((page) => page.workspaceId === activeNotebookId && !page.trashedAt)
    .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))[0];

  return firstValidPage?.id ?? null;
};

const restoreLastNoteIfNeeded = () => {
  const pagesStore = usePages.getState();
  if (pagesStore.activePageId) return;

  const targetPageId = resolveRestorablePageId();
  if (!targetPageId) return;

  useTabs.getState().openTab(targetPageId);
};

const clearActivePageForBlankEntry = () => {
  useTabs.setState({ activeTabId: null });
  const pagesStore = usePages.getState();
  if (!pagesStore.activePageId) return;

  void pagesStore.setActivePage(null);
};

export function usePluginEvents() {
  const { open: openStickyNote } = useStickyNote();

  // 仅首次挂载时应用一次窗口高度
  useEffect(() => {
    applyUToolsWindowHeight();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePluginEnter = (event: Event) => {
      const customEvent = event as CustomEvent<UToolsPluginEnterDetail>;
      const detail = customEvent.detail || {};
      const { code } = detail;

      // 剪藏入口直接交给 clipper，跳过自动恢复笔记，避免抢路由
      if (typeof code === "string" && code.startsWith("clip_")) {
        if (!usePages.getState().hydrated) return;
        void handleClip({
          code,
          type: detail.type ?? "",
          payload: detail.payload,
          optional: detail.optional,
          from:
            detail.from === "main" ||
            detail.from === "panel" ||
            detail.from === "redirect" ||
            detail.from === "hotkey"
              ? detail.from
              : undefined,
        });
        return;
      }

      applyUToolsWindowHeight();

      if (!usePages.getState().hydrated) return;
      if (!useSettings.getState().privacy.autoOpenLastNote) return;
      if (code === "open_folder" || code === "new_page") return;

      restoreLastNoteIfNeeded();
    };

    const handlePluginOut = () => {
      if (!useSettings.getState().privacy.autoOpenLastNote) {
        clearActivePageForBlankEntry();
      }
    };

    const handleOpenStickyNote = () => {
      if (!usePages.getState().hydrated) return;
      openStickyNote();
    };

    window.addEventListener(
      "goose-note:plugin-enter",
      handlePluginEnter as EventListener,
    );
    window.addEventListener(
      "goose-note:plugin-out",
      handlePluginOut as EventListener,
    );
    window.addEventListener(
      "goose-note:open-sticky-note",
      handleOpenStickyNote as EventListener,
    );

    return () => {
      window.removeEventListener(
        "goose-note:plugin-enter",
        handlePluginEnter as EventListener,
      );
      window.removeEventListener(
        "goose-note:plugin-out",
        handlePluginOut as EventListener,
      );
      window.removeEventListener(
        "goose-note:open-sticky-note",
        handleOpenStickyNote as EventListener,
      );
    };
  }, [openStickyNote]);

  // 打开外部文件夹关联监听
  useEffect(() => {
    const openFolder = async (folderPath: string) => {
      const folderName = folderPath.split(/[\\/]/).pop() || "Unknown";
      const notebookId = useNotebooks
        .getState()
        .createLocalFolderNotebook(folderName, folderPath);
      await usePages
        .getState()
        .loadLocalFolderPages(notebookId, folderPath, { showWelcome: true });
    };

    const handleOpenFolder = (event: Event & { detail?: { path: string } }) => {
      const customEvent = event as Event & { detail?: { path: string } };
      const { path: folderPath } = customEvent.detail || {};
      if (typeof folderPath === "string" && folderPath.length > 0) {
        void openFolder(folderPath);
      }
    };

    window.addEventListener(
      "goose-note:open-folder",
      handleOpenFolder as EventListener,
    );

    const pending = (window as { __gooseNotePendingOpenFolder?: string })
      .__gooseNotePendingOpenFolder;
    if (typeof pending === "string" && pending.length > 0) {
      (
        window as Window & { __gooseNotePendingOpenFolder?: string | null }
      ).__gooseNotePendingOpenFolder = null;
      void openFolder(pending);
    }

    return () => {
      window.removeEventListener(
        "goose-note:open-folder",
        handleOpenFolder as EventListener,
      );
    };
  }, []);

  // 监控本地文件夹的变更和存活状态
  useEffect(() => {
    if (!fs.isAvailable()) return;
    const notebooksStore = useNotebooks.getState();
    const pagesStore = usePages.getState();
    const notebooks = Object.values(notebooksStore.notebooks).sort(
      (a, b) => a.createdAt - b.createdAt,
    );

    const localNotebooks = notebooks.filter(
      (notebook) => notebook.source === "local-folder",
    );

    void (async () => {
      for (const notebook of localNotebooks) {
        const localPath = notebook.localPath;
        const exists =
          typeof localPath === "string" &&
          localPath.length > 0 &&
          (await fs.existsAsync(localPath));

        if (exists) {
          if (notebook.localPathMissing) {
            notebooksStore.updateNotebook(notebook.id, {
              localPathMissing: false,
            });
          }
          await pagesStore.loadLocalFolderPages(notebook.id, localPath!);
        } else {
          if (!notebook.localPathMissing) {
            notebooksStore.updateNotebook(notebook.id, {
              localPathMissing: true,
            });
          }
          pagesStore.removePagesByWorkspaceId(notebook.id);
        }
      }

      const activeNotebookId = notebooksStore.activeNotebookId;
      const activeNotebook = activeNotebookId
        ? notebooksStore.notebooks[activeNotebookId]
        : null;
      const activeInvalid =
        activeNotebook?.source === "local-folder" &&
        activeNotebook.localPathMissing;

      if (activeInvalid) {
        const nextNotebook =
          notebooks.find((notebook) => !notebook.localPathMissing) ||
          notebooks[0];
        if (nextNotebook && nextNotebook.id !== activeNotebookId) {
          notebooksStore.setActiveNotebook(nextNotebook.id);
          const lastPageId = notebooksStore.getLastActivePage(nextNotebook.id);
          const { pages } = pagesStore;
          const lastPage = lastPageId ? pages[lastPageId] : null;
          if (lastPage && !lastPage.trashedAt) {
            pagesStore.setActivePage(lastPageId);
          } else {
            const firstValidPage = Object.values(pages)
              .filter((p) => p.workspaceId === nextNotebook.id && !p.trashedAt)
              .sort(
                (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
              )[0];
            pagesStore.setActivePage(firstValidPage?.id ?? null);
          }
        }
      }
    })();
  }, []);

  return {
    restoreLastNoteIfNeeded,
    clearActivePageForBlankEntry,
  };
}
