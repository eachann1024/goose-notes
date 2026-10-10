import type { PagesState } from "../types";
import { hydrateFromStorageAction } from "../actions/hydrate";
import { loadInternalPage } from "@/lib/storage/pageRepository";
import {
  createOnboardingPagesAction,
  createPageAction,
  createPageRecordAction,
  createLocalPageAction,
  createLocalPageRecordAction,
  createLocalFolderRecordAction,
  createUnsavedLocalPageAction,
  discardUnsavedLocalPageAction,
  materializeUnsavedLocalPageAction,
} from "../actions/pageCreate";
import { DEFAULT_NOTEBOOK } from "../../useNotebooks";

export function createCreatePageSlice(
  set: import("zustand").StoreApi<PagesState>["setState"],
  get: import("zustand").StoreApi<PagesState>["getState"],
): Pick<
  PagesState,
  | "hydrateFromStorage"
  | "reloadPageFromStorage"
  | "createOnboardingPages"
  | "createPage"
  | "createPageRecord"
  | "createLocalPage"
  | "createLocalPageRecord"
  | "createLocalFolderRecord"
  | "createUnsavedLocalPage"
  | "discardUnsavedLocalPage"
  | "materializeUnsavedLocalPage"
> {
  return {
    hydrateFromStorage: () => hydrateFromStorageAction(set),

    reloadPageFromStorage: (pageId) => {
      const current = get().pages[pageId];
      const fresh = loadInternalPage(pageId);
      if (!fresh) return false;
      // 仅当 db 版本更新时才覆盖，避免回退本进程尚未落盘的较新编辑。
      if (current && fresh.updatedAt <= current.updatedAt) return false;
      set((state) => ({
        pages: { ...state.pages, [pageId]: fresh },
      }));
      return true;
    },

    createOnboardingPages: () => createOnboardingPagesAction(set, get),

    createPage: (parentId, workspaceId = DEFAULT_NOTEBOOK) =>
      createPageAction(set, get, parentId, workspaceId),

    createPageRecord: (options) => createPageRecordAction(set, get, options),

    createLocalPage: (parentId, workspaceId) =>
      createLocalPageAction(set, get, parentId, workspaceId),

    createLocalPageRecord: (options) =>
      createLocalPageRecordAction(set, get, options),

    createLocalFolderRecord: (options) =>
      createLocalFolderRecordAction(set, get, options),

    createUnsavedLocalPage: (workspaceId, parentId) =>
      createUnsavedLocalPageAction(set, get, workspaceId, parentId),

    discardUnsavedLocalPage: (pageId) =>
      discardUnsavedLocalPageAction(set, get, pageId),

    materializeUnsavedLocalPage: (pageId, options) =>
      materializeUnsavedLocalPageAction(set, get, pageId, options),
  };
}
