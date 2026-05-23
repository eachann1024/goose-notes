import { create } from "zustand";
import { useNotebooks, DEFAULT_NOTEBOOK } from "../useNotebooks";

import type { PagesState } from "./types";
import {
  isLocalFolderPage,
  persistPageSnapshot,
  persistPageSnapshots,
  removePersistedPageSnapshots,
  shouldPersistLocalPageMetaUpdate,
} from "./persistence";

// Re-export flushEditorContent for external consumers
export { flushEditorContent } from "./actions/flushEditor";
export { clearLocalPageMetadataCache } from "./clearCache";

import { flushEditorContent } from "./actions/flushEditor";
import { hydrateFromStorageAction } from "./actions/hydrate";
import {
  createOnboardingPagesAction,
  createPageAction,
  createPageRecordAction,
  createLocalPageAction,
  createLocalPageRecordAction,
  duplicatePageAction,
} from "./actions/pageCreate";
import {
  loadLocalFolderPagesAction,
  writePageContentAction,
  appendPageContentAction,
  replaceBlockRangeAction,
  saveLocalPageContentAction,
  flushPendingLocalSaveByPageIdAction,
  flushPendingLocalSavesAction,
  isLocalPageDirtyAction,
  saveDirtyLocalPageAction,
} from "./actions/localFolder";
import {
  deletePageAction,
  restorePageAction,
  permanentlyDeletePageAction,
  movePageTreeToNotebookAction,
  setActivePageAction,
} from "./actions/pageMutations";

export const usePages = create<PagesState>()((set, get) => ({
  pages: {},
  activePageId: null,
  pendingNavigatePageId: null,
  expandPageId: null,
  searchHighlightQuery: null,
  searchHighlightPageId: null,
  searchHighlightNonce: 0,
  handledSearchHighlightNonce: 0,
  hydrated: false,
  lastSavedAt: null,
  onboardingCompleted: false,
  dirtyLocalPageIds: {},

  hydrateFromStorage: () => hydrateFromStorageAction(set),

  createOnboardingPages: () => createOnboardingPagesAction(set, get),

  createPage: (parentId, workspaceId = DEFAULT_NOTEBOOK) =>
    createPageAction(set, get, parentId, workspaceId),

  createPageRecord: (options) => createPageRecordAction(set, get, options),

  createLocalPage: (parentId, workspaceId) =>
    createLocalPageAction(set, get, parentId, workspaceId),

  createLocalPageRecord: (options) =>
    createLocalPageRecordAction(set, get, options),

  updatePage: (id, updates) => {
    const page = get().pages[id];
    const shouldPersistLocalMeta =
      isLocalFolderPage(page) && shouldPersistLocalPageMetaUpdate(updates);

    set((state) => {
      const page = state.pages[id];
      if (!page) return state;
      const now = Date.now();

      let favoriteOrder = updates.favoriteOrder ?? page.favoriteOrder;
      if (
        updates.isFavorite === true &&
        !page.isFavorite &&
        favoriteOrder === undefined
      ) {
        const maxFavoriteOrder = Object.values(state.pages)
          .filter((p) => p.workspaceId === page.workspaceId && p.isFavorite)
          .reduce((max, p) => {
            const candidate = p.favoriteOrder ?? p.order ?? p.createdAt;
            return Math.max(max, candidate);
          }, -1);
        favoriteOrder = maxFavoriteOrder + 1;
      }

      let pinnedAt = updates.pinnedAt ?? page.pinnedAt;
      if (updates.isPinned === true) {
        pinnedAt = now;
      }
      if (updates.isPinned === false) {
        pinnedAt = undefined;
      }

      const updatedPage = {
        ...page,
        ...updates,
        ...(favoriteOrder !== undefined ? { favoriteOrder } : {}),
        pinnedAt,
        updatedAt: now,
      };

      if (
        updates.content &&
        useNotebooks.getState().notebooks[page.workspaceId]?.source ===
          "local-folder" &&
        page.localReadState !== "error"
      ) {
        // 本地文件夹采用手动保存（VSCode 风格）：编辑只标脏，不写盘；
        // 用户按 Cmd/Ctrl+S 时由 saveDirtyLocalPage 显式落盘。
        set((s) => ({ dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [id]: true } }));
      }

      return {
        pages: {
          ...state.pages,
          [id]: updatedPage,
        },
      };
    });

    const updatedPage = get().pages[id];
    if (!updatedPage) return;

    if (isLocalFolderPage(updatedPage)) {
      if (shouldPersistLocalMeta) {
        persistPageSnapshot(updatedPage);
      }
      return;
    }

    persistPageSnapshot(updatedPage);
  },

  deletePage: (id) => deletePageAction(set, get, id),

  restorePage: (id) => restorePageAction(set, get, id),

  duplicatePage: (id) => duplicatePageAction(set, get, id),

  permanentlyDeletePage: (id) => permanentlyDeletePageAction(set, get, id),

  reorderPages: (ids, parentId) => {
    set((state) => {
      const newPages = { ...state.pages };

      ids.forEach((id, index) => {
        if (newPages[id]) {
          newPages[id] = {
            ...newPages[id],
            parentId: parentId,
            order: index,
            updatedAt: Date.now(),
          };
        }
      });

      return { pages: newPages };
    });
    persistPageSnapshots(get().pages, ids);
  },

  reorderFavorites: (ids) => {
    set((state) => {
      const newPages = { ...state.pages };
      const now = Date.now();

      ids.forEach((id, index) => {
        if (!newPages[id]) return;
        newPages[id] = {
          ...newPages[id],
          favoriteOrder: index,
          updatedAt: now,
        };
      });

      return { pages: newPages };
    });
    persistPageSnapshots(get().pages, ids);
  },

  movePageTreeToNotebook: (pageId, targetNotebookId) =>
    movePageTreeToNotebookAction(set, get, pageId, targetNotebookId),

  setActivePage: (id) => setActivePageAction(set, get, id),

  setPendingNavigatePageId: (id) => {
    set({ pendingNavigatePageId: id });
  },

  setExpandPageId: (id) => {
    set({ expandPageId: id });
  },

  setSearchHighlightQuery: (query) => {
    set({ searchHighlightQuery: query });
  },
  setSearchHighlightPageId: (id) => {
    set({ searchHighlightPageId: id });
  },
  setSearchHighlightNonce: (nonce) => {
    set({ searchHighlightNonce: nonce });
  },
  setHandledSearchHighlightNonce: (nonce) => {
    set({ handledSearchHighlightNonce: nonce });
  },

  setLastSavedAt: (timestamp) => {
    set({ lastSavedAt: timestamp });
  },

  getAncestorIds: (pageId) => {
    const pages = get().pages;
    const ancestorIds: string[] = [];
    let current = pages[pageId];
    while (current && current.parentId && pages[current.parentId]) {
      ancestorIds.push(current.parentId);
      current = pages[current.parentId];
    }
    return ancestorIds;
  },

  setHydrated: (hydrated) => {
    set({ hydrated });
  },

  getPage: (id) => get().pages[id],

  getChildren: (parentId, workspaceId) => {
    const pages = get().pages;
    return Object.values(pages)
      .filter((p) => {
        const matchParent = p.parentId === parentId && !p.trashedAt;
        const matchWorkspace = workspaceId
          ? p.workspaceId === workspaceId
          : true;
        return matchParent && matchWorkspace;
      })
      .sort((a, b) => {
        const valA = a.order ?? a.createdAt;
        const valB = b.order ?? b.createdAt;
        if (valA !== valB) return valA - valB;
        return a.id.localeCompare(b.id);
      });
  },

  getTrashedPages: (workspaceId) => {
    const pages = get().pages;
    return Object.values(pages)
      .filter((p) => {
        const isTrashed = !!p.trashedAt;
        const matchWorkspace = workspaceId
          ? p.workspaceId === workspaceId
          : true;
        return isTrashed && matchWorkspace;
      })
      .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
  },

  getFavorites: (workspaceId) => {
    const pages = get().pages;
    return Object.values(pages)
      .filter((p) => {
        const isFavorite = p.isFavorite;
        const matchWorkspace = workspaceId
          ? p.workspaceId === workspaceId
          : true;
        return isFavorite && matchWorkspace;
      })
      .sort((a, b) => {
        const orderA = a.favoriteOrder ?? a.order ?? a.createdAt;
        const orderB = b.favoriteOrder ?? b.order ?? b.createdAt;
        if (orderA !== orderB) return orderA - orderB;
        return a.id.localeCompare(b.id);
      });
  },

  getPinnedPages: () => {
    const pages = get().pages;
    return Object.values(pages)
      .filter((p) => !p.trashedAt && p.isPinned)
      .sort((a, b) => {
        const pinA = a.pinnedAt ?? 0;
        const pinB = b.pinnedAt ?? 0;
        if (pinA !== pinB) return pinB - pinA;
        return b.updatedAt - a.updatedAt;
      });
  },

  removePagesByWorkspaceId: (workspaceId, options) => {
    const snapshotPages = get().pages;
    const removedIds = Object.values(snapshotPages)
      .filter((page) => page.workspaceId === workspaceId)
      .map((page) => page.id);

    set((state) => {
      const newPages = { ...state.pages };
      Object.values(state.pages).forEach((page) => {
        if (page.workspaceId === workspaceId) {
          delete newPages[page.id];
        }
      });

      const activePage = state.activePageId
        ? state.pages[state.activePageId]
        : null;
      const nextActivePageId =
        activePage?.workspaceId === workspaceId ? null : state.activePageId;

      return {
        pages: newPages,
        activePageId: nextActivePageId,
      };
    });

    if (options?.purgePersistence) {
      removePersistedPageSnapshots(snapshotPages, removedIds);
    }
  },

  loadLocalFolderPages: (notebookId, basePath, options) =>
    loadLocalFolderPagesAction(set, get, notebookId, basePath, options),

  saveLocalPageContent: (pageId, content) =>
    saveLocalPageContentAction(set, get, pageId, content),

  flushPendingLocalSaves: () => flushPendingLocalSavesAction(set, get),

  flushPendingLocalSaveByPageId: (pageId) =>
    flushPendingLocalSaveByPageIdAction(set, get, pageId),

  isLocalPageDirty: (pageId) => isLocalPageDirtyAction(get, pageId),

  saveDirtyLocalPage: (pageId) => saveDirtyLocalPageAction(set, get, pageId),

  getLocalFilePath: (pageId) => {
    const page = get().pages[pageId];
    return page?.localFilePath || null;
  },

  writePageContent: (pageId, content, mode) =>
    writePageContentAction(set, get, pageId, content, mode),

  appendPageContent: (pageId, content) =>
    appendPageContentAction(set, get, pageId, content),

  replaceBlockRange: (pageId, startBlockId, endBlockId, newBlocks) =>
    replaceBlockRangeAction(set, get, pageId, startBlockId, endBlockId, newBlocks),
}));

const setupImageStorageResolver = async () => {
  const { imageStorage } = await import("@/lib/imageStorage");
  imageStorage.setLocalFolderAccessResolver(() => {
    const activePageId = usePages.getState().activePageId;
    if (!activePageId) return null;

    const page = usePages.getState().pages[activePageId];
    if (!page) return null;

    const notebook = useNotebooks.getState().notebooks[page.workspaceId];
    return notebook?.source === "local-folder" ? notebook.localPath : null;
  });
};

void setupImageStorageResolver();
