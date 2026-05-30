import { useNotebooks } from "../../../useNotebooks";
import type { StoreSet, StoreGet } from "../hydrate";
import { flushEditorContent } from "../flushEditor";
import { resolveAdjacentPageAfterDeletion } from "./helpers";
import {
  persistPageSnapshots,
  removePersistedPageSnapshots,
} from "../../persistence";

export const deletePageAction = async (
  set: StoreSet,
  get: StoreGet,
  id: string,
): Promise<boolean> => {
  flushEditorContent();
  const page = get().pages[id];
  if (!page) return false;

  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  const isLocalFolder = notebook?.source === "local-folder";
  if (isLocalFolder && notebook?.localPath) {
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
    if (!targetPath || !window.gooseFs) return false;

    const removedIds = new Set<string>();
    const stack = [id];
    const snapshotPages = get().pages;
    while (stack.length) {
      const currentId = stack.pop()!;
      removedIds.add(currentId);
      Object.values(snapshotPages).forEach((p) => {
        if (p.parentId === currentId) stack.push(p.id);
      });
    }

    const removeOk = page.isFolder
      ? await window.gooseFs.deleteDir(targetPath)
      : await window.gooseFs.deleteFile(targetPath);
    if (!removeOk) return false;

    set((state) => {
      const newPages = { ...state.pages };
      removedIds.forEach((pid) => delete newPages[pid]);

      let nextActivePageId = state.activePageId;
      if (removedIds.has(state.activePageId || "")) {
        nextActivePageId = resolveAdjacentPageAfterDeletion({
          pages: state.pages,
          currentPage: page,
          removedIds,
          isLocalNotebook: true,
        });
        useNotebooks.getState().setLastActivePage(
          page.workspaceId,
          nextActivePageId,
        );
      }

      return {
        pages: newPages,
        activePageId: nextActivePageId,
      };
    });

    removePersistedPageSnapshots(snapshotPages, removedIds);

    return true;
  }

  const workspaceId = page.workspaceId;
  const changedIds: string[] = [];

  set((state) => {
    const removedIds = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const currentId = stack.pop()!;
      removedIds.add(currentId);
      Object.values(state.pages).forEach((p) => {
        if (p.parentId === currentId && !p.trashedAt) stack.push(p.id);
      });
    }

    const newPages = { ...state.pages };
    const now = Date.now();
    const batchId = `b-${now}-${id}`;
    removedIds.forEach((pid) => {
      if (newPages[pid]) {
        newPages[pid] = {
          ...newPages[pid],
          trashedAt: now,
          trashBatchId: batchId,
          updatedAt: now,
          isFavorite: false,
          isPinned: false,
          pinnedAt: undefined,
        };
        changedIds.push(pid);
      }
    });

    let newActivePageId = state.activePageId;
    if (removedIds.has(state.activePageId || "")) {
      newActivePageId = resolveAdjacentPageAfterDeletion({
        pages: state.pages,
        currentPage: page,
        removedIds,
        isLocalNotebook: false,
      });
      useNotebooks.getState().setLastActivePage(
        workspaceId,
        newActivePageId,
      );
    }

    return {
      pages: newPages,
      activePageId: newActivePageId,
    };
  });

  persistPageSnapshots(get().pages, changedIds);

  return true;
};
