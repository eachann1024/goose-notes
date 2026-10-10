import type { StoreSet, StoreGet } from "../hydrate";
import { isElectronHostTarget } from "./onboarding";
import { useNotebooks } from "../../../useNotebooks";
import { flushEditorContent } from "../flushEditor";
import { useSettings } from "@/stores/useSettings";
import { pickRandomPageIcon } from "@/lib/randomPageIcon";
import { v4 as uuidv4 } from "uuid";
import type { Page } from "@/types";
import { cloneLocalPageContent, focusNewPage } from "./content";
import { isUnsavedLocalPage } from "@/lib/unsavedLocalPage";

export const createUnsavedLocalPageAction = (
  set: StoreSet,
  get: StoreGet,
  workspaceId: string,
  parentId?: string,
): string => {
  if (isElectronHostTarget()) {
    const target = useNotebooks.getState().notebooks[workspaceId];
    if (target?.source !== "local-folder") return "";
  } else {
    return "";
  }
  flushEditorContent();

  const icon = useSettings.getState().randomIconOnCreate
    ? pickRandomPageIcon()
    : undefined;
  const finalId = uuidv4();
  const now = Date.now();
  const newPage: Page = {
    id: finalId,
    workspaceId,
    parentId,
    content: cloneLocalPageContent(),
    isFolder: false,
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    localUnsaved: true,
    createdAt: now,
    updatedAt: now,
    order: now,
    ...(icon ? { icon } : {}),
  };

  set((state) => ({
    pages: { ...state.pages, [finalId]: newPage },
    activePageId: finalId,
  }));
  useNotebooks.getState().setLastActivePage(workspaceId, finalId);
  focusNewPage(finalId);
  return finalId;
};

export const discardUnsavedLocalPageAction = (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
): void => {
  const page = get().pages[pageId];
  if (!isUnsavedLocalPage(page)) return;
  set((state) => {
    const nextPages = { ...state.pages };
    delete nextPages[pageId];
    const nextDirty = { ...state.dirtyLocalPageIds };
    delete nextDirty[pageId];
    return {
      pages: nextPages,
      dirtyLocalPageIds: nextDirty,
      activePageId: state.activePageId === pageId ? null : state.activePageId,
    };
  });
};
