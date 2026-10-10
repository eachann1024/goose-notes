import type { PagesState } from "../types";
import { setActivePageAction } from "../actions/pageMutations";

export function createNavigationPageSlice(
  set: import("zustand").StoreApi<PagesState>["setState"],
  get: import("zustand").StoreApi<PagesState>["getState"],
): Pick<
  PagesState,
  | "setActivePage"
  | "setPendingNavigatePageId"
  | "setExpandPageId"
  | "setSearchHighlightQuery"
  | "setSearchHighlightPageId"
  | "setSearchHighlightNonce"
  | "setHandledSearchHighlightNonce"
  | "setLastSavedAt"
  | "setHydrated"
> {
  return {
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

    setHydrated: (hydrated) => {
      set({ hydrated });
    },
  };
}
