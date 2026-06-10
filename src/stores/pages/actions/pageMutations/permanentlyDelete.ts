import { useNotebooks } from "../../../useNotebooks";
import type { StoreSet, StoreGet } from "../hydrate";
import {
  removePersistedPageSnapshot,
  removePersistedPageSnapshots,
} from "../../persistence";

export const permanentlyDeletePageAction = async (
  set: StoreSet,
  get: StoreGet,
  id: string,
): Promise<void> => {
  const page = get().pages[id];
  const notebook = page
    ? useNotebooks.getState().notebooks[page.workspaceId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";

  if (isLocalFolder && notebook?.localPath) {
    if (typeof window === "undefined" || !window.gooseFs) return;
    if (!page) return;
    const snapshotPages = get().pages;

    const resolvePathFromId = (pageId: string) => {
      // 兜底：从旧格式 id（local-{nb}-{encoded}）反解路径。
      // 稳定 id 后路径应始终来自 page.localFilePath，此分支仅用于极端兜底。
      const prefix = `local-${page.workspaceId}-`;
      if (!pageId.startsWith(prefix)) return null;
      const encoded = pageId.slice(prefix.length);
      try {
        const relativePath = decodeURIComponent(encoded);
        return `${notebook.localPath}/${relativePath}`;
      } catch {
        return null;
      }
    };

    // 路径优先从 page.localFilePath 取（稳定 id 后是主路径来源）。
    const targetPath = page.localFilePath || resolvePathFromId(id);
    if (!targetPath) return;

    const removedIds = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const currentId = stack.pop()!;
      removedIds.add(currentId);
      Object.values(get().pages).forEach((p) => {
        if (p.parentId === currentId) stack.push(p.id);
      });
    }

    const deleted = page.isFolder
      ? await window.gooseFs.deleteDir(targetPath)
      : await window.gooseFs.deleteFile(targetPath);
    if (!deleted) return;

    set((state) => {
      const newPages = { ...state.pages };
      removedIds.forEach((pid) => delete newPages[pid]);

      let nextActivePageId = state.activePageId;
      if (removedIds.has(state.activePageId || "")) {
        nextActivePageId = null;
        useNotebooks.getState().setLastActivePage(page.workspaceId, null);
      }

      return {
        pages: newPages,
        activePageId: nextActivePageId,
      };
    });
    removePersistedPageSnapshots(snapshotPages, removedIds);
    return;
  }

  const targetPage = get().pages[id];
  set((state) => {
    const page = state.pages[id];
    if (!page) return state;
    const workspaceId = page.workspaceId;
    const deletingTrashedPage = !!page.trashedAt;
    const newPages = { ...state.pages };
    delete newPages[id];

    let newActivePageId = state.activePageId;
    if (state.activePageId === id) {
      if (deletingTrashedPage) {
        const trashedPagesAfterDelete = Object.values(newPages)
          .filter((p) => p.workspaceId === workspaceId && !!p.trashedAt)
          .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));

        if (trashedPagesAfterDelete.length > 0) {
          const trashedPagesBeforeDelete = Object.values(state.pages)
            .filter((p) => p.workspaceId === workspaceId && !!p.trashedAt)
            .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));

          const deletedPageIndex = trashedPagesBeforeDelete.findIndex(
            (p) => p.id === id,
          );
          const safeCurrentIndex = Math.max(deletedPageIndex, 0);
          const nextIndex =
            safeCurrentIndex >= trashedPagesAfterDelete.length
              ? trashedPagesAfterDelete.length - 1
              : safeCurrentIndex;

          newActivePageId = trashedPagesAfterDelete[nextIndex].id;
        } else {
          newActivePageId = null;
        }
      } else {
        const siblings = Object.values(newPages)
          .filter(
            (p) =>
              p.workspaceId === workspaceId && !p.trashedAt && p.id !== id,
          )
          .sort(
            (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
          );

        if (siblings.length > 0) {
          const deletedPageIndex = Object.values(state.pages)
            .filter((p) => p.workspaceId === workspaceId && !p.trashedAt)
            .sort(
              (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
            )
            .findIndex((p) => p.id === id);

          const nextIndex =
            deletedPageIndex >= siblings.length
              ? siblings.length - 1
              : deletedPageIndex;
          newActivePageId = siblings[nextIndex].id;
        } else {
          newActivePageId = null;
        }
      }
    }

    return {
      pages: newPages,
      activePageId: newActivePageId,
    };
  });
  removePersistedPageSnapshot(targetPage, id);
};
