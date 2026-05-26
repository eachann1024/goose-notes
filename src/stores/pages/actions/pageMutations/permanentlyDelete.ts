import { useNotebooks } from "../../../useNotebooks";
import type { StoreSet, StoreGet } from "../hydrate";
import { getPageTitle } from "@/lib/page-title";
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

    const targetPath = page.localFilePath || resolvePathFromId(id);
    if (!targetPath) return;

    const confirmed = confirm(
      page.isFolder
        ? `确定要删除本地文件夹 "${getPageTitle(page)}" 及其内容吗？将移入系统回收站。`
        : `确定要删除本地文件 "${getPageTitle(page)}" 及其对应的文件吗？将移入系统回收站。`,
    );
    if (!confirmed) return;

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
