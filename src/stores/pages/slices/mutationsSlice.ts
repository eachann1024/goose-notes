import type { PagesState } from "../types";
import {
  deletePageAction,
  restorePageAction,
  permanentlyDeletePageAction,
  movePageTreeToNotebookAction,
  undoMovePageTreeAction,
} from "../actions/pageMutations";
import { duplicatePageAction } from "../actions/pageCreate";
import {
  persistPageSnapshots,
  removePersistedPageSnapshots,
} from "../persistence";

export function createMutationsPageSlice(
  set: import("zustand").StoreApi<PagesState>["setState"],
  get: import("zustand").StoreApi<PagesState>["getState"],
): Pick<
  PagesState,
  | "deletePage"
  | "restorePage"
  | "duplicatePage"
  | "permanentlyDeletePage"
  | "reorderPages"
  | "reorderFavorites"
  | "movePageTreeToNotebook"
  | "undoMovePageTree"
  | "removePagesByWorkspaceId"
> {
  return {
    deletePage: (id, options) => deletePageAction(set, get, id, options),

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

        ids.forEach((id, index) => {
          if (!newPages[id]) return;
          newPages[id] = {
            ...newPages[id],
            favoriteOrder: index,
          };
        });

        return { pages: newPages };
      });
      persistPageSnapshots(get().pages, ids);
    },

    movePageTreeToNotebook: (pageId, targetNotebookId) =>
      movePageTreeToNotebookAction(set, get, pageId, targetNotebookId),

    undoMovePageTree: (undoSnapshots, sourceNotebookId, prevActivePageId) =>
      undoMovePageTreeAction(
        set,
        get,
        undoSnapshots,
        sourceNotebookId,
        prevActivePageId,
      ),

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
  };
}
