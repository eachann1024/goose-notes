import { create } from "zustand";
import type { PagesState } from "./types";
import { createCreatePageSlice } from "./slices/createSlice";
import { createUpdatePageSlice } from "./slices/updateSlice";
import { createMutationsPageSlice } from "./slices/mutationsSlice";
import { createNavigationPageSlice } from "./slices/navigationSlice";
import { createSelectorsPageSlice } from "./slices/selectorsSlice";
import { createLocalFolderPageSlice } from "./slices/localFolderSlice";
import { useNotebooks } from "../useNotebooks";

// Re-export flushEditorContent for external consumers
export { flushEditorContent } from "./actions/flushEditor";
export { clearLocalPageMetadataCache } from "./clearCache";

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
  ...createCreatePageSlice(set, get),
  ...createUpdatePageSlice(set, get),
  ...createMutationsPageSlice(set, get),
  ...createNavigationPageSlice(set, get),
  ...createSelectorsPageSlice(set, get),
  ...createLocalFolderPageSlice(set, get),
}));

const setupImageStorageResolver = async () => {
  const { imageStorage } = await import("@/lib/imageStorage");
  imageStorage.setLocalFolderAccessResolver(() => {
    const activePageId = usePages.getState().activePageId;
    if (!activePageId) return null;

    const page = usePages.getState().pages[activePageId];
    if (!page) return null;

    const notebook = useNotebooks.getState().notebooks[page.workspaceId];
    return notebook?.source === "local-folder"
      ? (page.localFilePath ?? null)
      : null;
  });
};

void setupImageStorageResolver();
