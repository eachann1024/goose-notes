import type { PagesState } from "../types";

export function createSelectorsPageSlice(
  set: import("zustand").StoreApi<PagesState>["setState"],
  get: import("zustand").StoreApi<PagesState>["getState"],
): Pick<
  PagesState,
  | "getAncestorIds"
  | "getPage"
  | "getChildren"
  | "getTrashedPages"
  | "getFavorites"
  | "getPinnedPages"
  | "getLocalFilePath"
> {
  return {
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

    getLocalFilePath: (pageId) => {
      const page = get().pages[pageId];
      return page?.localFilePath || null;
    },
  };
}
