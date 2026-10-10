import type { PagesState } from "../types";
import {
  loadLocalFolderPagesAction,
  reloadLocalPageFromDiskAction,
  removeSingleLocalPageAction,
  addSingleLocalPageAction,
  loadAllLocalFolderPagesAction,
  saveLocalPageContentAction,
  flushPendingLocalSavesAction,
  flushPendingLocalSaveByPageIdAction,
  isLocalPageDirtyAction,
  saveDirtyLocalPageAction,
  renameLocalPageFileAction,
  moveLocalPageAction,
  writePageContentAction,
  appendPageContentAction,
  replaceBlockRangeAction,
} from "../actions/localFolder";
import type { JSONContent } from "@/types";

export function createLocalFolderPageSlice(
  set: import("zustand").StoreApi<PagesState>["setState"],
  get: import("zustand").StoreApi<PagesState>["getState"],
): Pick<
  PagesState,
  | "loadLocalFolderPages"
  | "reloadLocalPageFromDisk"
  | "removeSingleLocalPage"
  | "addSingleLocalPage"
  | "loadAllLocalFolderPages"
  | "saveLocalPageContent"
  | "flushPendingLocalSaves"
  | "flushPendingLocalSaveByPageId"
  | "isLocalPageDirty"
  | "saveDirtyLocalPage"
  | "renameLocalPageFile"
  | "moveLocalPage"
  | "writePageContent"
  | "appendPageContent"
  | "replaceBlockRange"
> {
  return {
    loadLocalFolderPages: (notebookId, basePath, options) =>
      loadLocalFolderPagesAction(set, get, notebookId, basePath, options),

    reloadLocalPageFromDisk: (pageId) =>
      reloadLocalPageFromDiskAction(set, get, pageId),

    removeSingleLocalPage: (filePath) =>
      removeSingleLocalPageAction(set, get, filePath),

    addSingleLocalPage: (notebookId, basePath, filePath, options) =>
      addSingleLocalPageAction(
        set,
        get,
        notebookId,
        basePath,
        filePath,
        options,
      ),

    loadAllLocalFolderPages: () => loadAllLocalFolderPagesAction(set, get),

    saveLocalPageContent: (
      pageId: string,
      content: JSONContent,
      options?: { force?: boolean },
    ) => saveLocalPageContentAction(set, get, pageId, content, options),

    flushPendingLocalSaves: () => flushPendingLocalSavesAction(set, get),

    flushPendingLocalSaveByPageId: (pageId) =>
      flushPendingLocalSaveByPageIdAction(set, get, pageId),

    isLocalPageDirty: (pageId) => isLocalPageDirtyAction(get, pageId),

    saveDirtyLocalPage: (pageId) => saveDirtyLocalPageAction(set, get, pageId),

    renameLocalPageFile: (pageId, newBaseName) =>
      renameLocalPageFileAction(set, get, pageId, newBaseName),

    moveLocalPage: (pageId, targetFolderId) =>
      moveLocalPageAction(set, get, pageId, targetFolderId),

    writePageContent: (pageId, content, mode) =>
      writePageContentAction(set, get, pageId, content, mode),

    appendPageContent: (pageId, content) =>
      appendPageContentAction(set, get, pageId, content),

    replaceBlockRange: (pageId, startBlockId, endBlockId, newBlocks) =>
      replaceBlockRangeAction(
        set,
        get,
        pageId,
        startBlockId,
        endBlockId,
        newBlocks,
      ),
  };
}
