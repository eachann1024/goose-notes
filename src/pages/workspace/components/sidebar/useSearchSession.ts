import { create } from "zustand";

export type SearchScope = { kind: "current"; notebookId: string | null } | { kind: "all" } | { kind: "notebook"; notebookId: string };
type SearchSession = {
  open: boolean;
  query: string;
  scope: SearchScope;
  startingNotebookId: string | null;
  initialized: boolean;
  originPageId: string | null;
  originScrollTop: number;
  targetPageId: string | null;
  selectedPageId: string | null;
  requestNonce: number;
  focusNonce: number;
  enterReader: boolean;
  restoreTop: number | null;
  listScrollTop: number;
  memories: Record<string, number>;
  openSearch: (notebookId: string | null, pageId: string | null, scrollTop: number) => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  setScope: (scope: SearchScope) => void;
  selectResult: (pageId: string | null) => void;
  targetPage: (pageId: string, enter?: boolean, restoreTop?: number | null) => void;
  rememberMatch: (key: string, index: number) => void;
};
export function searchMemoryKey(pageId: string, query: string, scope: SearchScope) {
  return JSON.stringify([pageId, query.trim().toLowerCase(), scope]);
}
export const useSearchSession = create<SearchSession>((set) => ({
  open: false, query: "", scope: { kind: "current", notebookId: null },
  initialized: false, startingNotebookId: null, originPageId: null, originScrollTop: 0,
  targetPageId: null, selectedPageId: null, requestNonce: 0, focusNonce: 0,
  enterReader: false, restoreTop: null, listScrollTop: 0, memories: {},
  openSearch: (notebookId, pageId, scrollTop) => set(s => ({
    open: true, initialized: true, focusNonce: s.focusNonce + 1,
    scope: s.initialized ? s.scope : { kind: "current", notebookId },
    startingNotebookId: s.open ? s.startingNotebookId : notebookId,
    originPageId: s.open ? s.originPageId : pageId,
    originScrollTop: s.open ? s.originScrollTop : scrollTop,
  })),
  closeSearch: () => set({ open: false, enterReader: false }),
  setQuery: query => set({ query, selectedPageId: null, listScrollTop: 0 }),
  setScope: scope => set({ scope, selectedPageId: null, listScrollTop: 0 }),
  selectResult: selectedPageId => set({ selectedPageId }),
  targetPage: (targetPageId, enterReader = false, restoreTop = null) => set(s => ({
    targetPageId, selectedPageId: targetPageId, enterReader, restoreTop,
    requestNonce: s.requestNonce + 1,
  })),
  rememberMatch: (key, index) => set(s => s.memories[key] === index ? s : ({
    memories: { ...s.memories, [key]: index },
  })),
}));
