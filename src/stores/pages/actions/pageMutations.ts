import type { Page, JSONContent } from "@/types";
import { useNotebooks } from "../../useNotebooks";
import { getPageTitle } from "@/lib/page-title";

import type { PagesState } from "../types";
import {
  isLocalFolderPage,
  persistPageSnapshot,
  persistPageSnapshots,
  removePersistedPageSnapshot,
  removePersistedPageSnapshots,
} from "../persistence";
import type { StoreSet, StoreGet } from "./hydrate";
import { flushEditorContent } from "./flushEditor";

function compareSiblingPages(
  a: Page,
  b: Page,
  isLocalNotebook: boolean,
): number {
  if (isLocalNotebook) {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    const titleCompare = getPageTitle(a).localeCompare(getPageTitle(b), "zh-CN", {
      numeric: true,
    });
    if (titleCompare !== 0) return titleCompare;
    return a.id.localeCompare(b.id);
  }

  const orderA = a.order ?? a.createdAt;
  const orderB = b.order ?? b.createdAt;
  if (orderA !== orderB) return orderA - orderB;
  return a.id.localeCompare(b.id);
}

export { compareSiblingPages };

function resolveAdjacentPageAfterDeletion({
  pages,
  currentPage,
  removedIds,
  isLocalNotebook,
}: {
  pages: Record<string, Page>;
  currentPage: Page;
  removedIds: Set<string>;
  isLocalNotebook: boolean;
}): string | null {
  const siblingsBeforeDelete = Object.values(pages)
    .filter(
      (candidate) =>
        candidate.workspaceId === currentPage.workspaceId &&
        !candidate.trashedAt &&
        candidate.parentId === currentPage.parentId,
    )
    .sort((a, b) => compareSiblingPages(a, b, isLocalNotebook));

  const deletedPageIndex = siblingsBeforeDelete.findIndex(
    (candidate) => candidate.id === currentPage.id,
  );
  const siblingsAfterDelete = siblingsBeforeDelete.filter(
    (candidate) => !removedIds.has(candidate.id),
  );

  if (siblingsAfterDelete.length === 0) {
    return null;
  }

  const fallbackIndex =
    deletedPageIndex === -1
      ? siblingsAfterDelete.length - 1
      : Math.min(deletedPageIndex, siblingsAfterDelete.length - 1);

  return siblingsAfterDelete[fallbackIndex]?.id ?? null;
}

export { resolveAdjacentPageAfterDeletion };

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

    const confirmed = confirm(
      page.isFolder
        ? `确定要删除本地文件夹 "${getPageTitle(page)}" 及其内容吗？将移入系统回收站。`
        : `确定要删除本地文件 "${getPageTitle(page)}" 吗？将移入系统回收站。`,
    );
    if (!confirmed) return false;

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
    removedIds.forEach((pid) => {
      if (newPages[pid]) {
        newPages[pid] = {
          ...newPages[pid],
          trashedAt: now,
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

export const restorePageAction = (
  set: StoreSet,
  get: StoreGet,
  id: string,
): {
  ok: boolean;
  pageTitle?: string;
  notebookName?: string;
  parentTitles?: string[];
  restoredCount?: number;
  itemLabel?: string;
} => {
  const snapshotPages = get().pages;
  const page = snapshotPages[id];
  if (!page || !page.trashedAt) {
    return { ok: false };
  }

  const notebookName =
    useNotebooks.getState().notebooks[page.workspaceId]?.name ||
    "未命名记事本";
  const pageTitle = getPageTitle(page) || "无标题";
  const itemLabel = page.isFolder
    ? "文件夹"
    : page.localFilePath
      ? "文件"
      : "页面";

  const parentTitles: string[] = [];
  const parentVisited = new Set<string>();
  let currentParentId = page.parentId;
  while (currentParentId && !parentVisited.has(currentParentId)) {
    parentVisited.add(currentParentId);
    const parentPage = snapshotPages[currentParentId];
    if (!parentPage) break;
    parentTitles.unshift(getPageTitle(parentPage) || "无标题");
    currentParentId = parentPage.parentId;
  }

  let restoredCount = 0;
  const restoredIds: string[] = [];
  set((state) => {
    const currentPage = state.pages[id];
    if (!currentPage || !currentPage.trashedAt) return state;

    const trashStamp = currentPage.trashedAt;
    const now = Date.now();
    const restoredPages = { ...state.pages };

    const stack = [id];
    const visited = new Set<string>();
    while (stack.length) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const current = restoredPages[currentId];
      if (current?.trashedAt === trashStamp) {
        const { trashedAt, ...rest } = current;
        restoredPages[currentId] = {
          ...rest,
          updatedAt: now,
        } as Page;
        restoredCount += 1;
        restoredIds.push(currentId);
      }
      Object.values(restoredPages).forEach((p) => {
        if (p.parentId === currentId && !visited.has(p.id)) {
          stack.push(p.id);
        }
      });
    }

    return {
      pages: restoredPages,
    };
  });

  persistPageSnapshots(get().pages, restoredIds);

  return {
    ok: true,
    pageTitle,
    notebookName,
    parentTitles,
    restoredCount,
    itemLabel,
  };
};

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

export const movePageTreeToNotebookAction = (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  targetNotebookId: string,
): {
  ok: boolean;
  movedCount: number;
  sourceNotebookId?: string;
  targetNotebookId?: string;
  reason?: string;
} => {
  flushEditorContent(true);

  const snapshotPages = get().pages;
  const sourcePage = snapshotPages[pageId];
  if (!sourcePage || sourcePage.trashedAt) {
    return {
      ok: false,
      movedCount: 0,
      reason: "page-not-found",
    };
  }

  const sourceNotebookId = sourcePage.workspaceId;
  const notebooksStore = useNotebooks.getState();
  const sourceNotebook = notebooksStore.notebooks[sourceNotebookId];
  const targetNotebook = notebooksStore.notebooks[targetNotebookId];

  if (!sourceNotebook || sourceNotebook.source === "local-folder") {
    return {
      ok: false,
      movedCount: 0,
      reason: "source-not-supported",
    };
  }

  if (!targetNotebook || targetNotebook.source === "local-folder") {
    return {
      ok: false,
      movedCount: 0,
      reason: "target-not-supported",
    };
  }

  if (sourceNotebookId === targetNotebookId) {
    return {
      ok: false,
      movedCount: 0,
      reason: "same-notebook",
    };
  }

  const movedIds: string[] = [];
  const movedIdSet = new Set<string>();
  const stack = [pageId];

  while (stack.length) {
    const currentId = stack.pop()!;
    if (movedIdSet.has(currentId)) continue;
    const currentPage = snapshotPages[currentId];
    if (!currentPage || currentPage.trashedAt) continue;
    movedIdSet.add(currentId);
    movedIds.push(currentId);

    Object.values(snapshotPages).forEach((p) => {
      if (!p.trashedAt && p.parentId === currentId && !movedIdSet.has(p.id)) {
        stack.push(p.id);
      }
    });
  }

  if (movedIds.length === 0) {
    return {
      ok: false,
      movedCount: 0,
      reason: "empty-tree",
    };
  }

  const now = Date.now();
  const targetTopLevelOrders = Object.values(snapshotPages)
    .filter(
      (p) =>
        !p.trashedAt &&
        p.workspaceId === targetNotebookId &&
        p.parentId === undefined,
    )
    .map((p) => p.order ?? p.createdAt);
  const maxTopLevelOrder =
    targetTopLevelOrders.length > 0
      ? Math.max(...targetTopLevelOrders)
      : now - 1;
  const rootOrder = maxTopLevelOrder + 1;

  const activeNotebookId = notebooksStore.activeNotebookId;
  const activePageId = get().activePageId;
  const shouldFallbackActive =
    !!activePageId &&
    movedIdSet.has(activePageId) &&
    activeNotebookId === sourceNotebookId;

  let nextActivePageId: string | null = activePageId;
  if (shouldFallbackActive) {
    const remainingPages = Object.values(snapshotPages)
      .filter(
        (p) =>
          !p.trashedAt &&
          p.workspaceId === sourceNotebookId &&
          !movedIdSet.has(p.id),
      )
      .sort((a, b) => {
        const valA = a.order ?? a.createdAt;
        const valB = b.order ?? b.createdAt;
        if (valA !== valB) return valA - valB;
        return a.id.localeCompare(b.id);
      });
    nextActivePageId = remainingPages[0]?.id ?? null;
  }

  set((state) => {
    const newPages = { ...state.pages };

    movedIds.forEach((id) => {
      const current = newPages[id];
      if (!current || current.trashedAt) return;

      newPages[id] = {
        ...current,
        workspaceId: targetNotebookId,
        parentId: id === pageId ? undefined : current.parentId,
        order: id === pageId ? rootOrder : current.order,
        updatedAt: now,
      };
    });

    return {
      pages: newPages,
      activePageId: shouldFallbackActive ? nextActivePageId : state.activePageId,
    };
  });

  persistPageSnapshots(get().pages, movedIds);

  if (shouldFallbackActive) {
    notebooksStore.setLastActivePage(sourceNotebookId, nextActivePageId);
  }

  return {
    ok: true,
    movedCount: movedIds.length,
    sourceNotebookId,
    targetNotebookId,
  };
};

export const setActivePageAction = async (
  set: StoreSet,
  get: StoreGet,
  id: string | null,
): Promise<void> => {
  const previousActivePageId = get().activePageId;
  flushEditorContent(true);
  if (previousActivePageId) {
    await get().flushPendingLocalSaveByPageId(previousActivePageId);
  }

  if (!id) {
    set({ activePageId: null });
    return;
  }

  // 本地文件夹的内容由 scanner 一次性加载，并保留内存中的任何脏改动；
  // 切换标签页时直接用 store 里的 page.content，不再重读原文件。
  // 重读会绕过 frontmatter/raw-guard 流水线，并覆盖用户未保存的编辑。
  set({ activePageId: id });

  const notebookId = useNotebooks.getState().activeNotebookId;
  if (notebookId) {
    useNotebooks.getState().setLastActivePage(notebookId, id);
  }
};
