import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

const EMPTY_ARRAY: string[] = [];
const SIDEBAR_VIEW_PERSIST_DEBOUNCE_MS = 80;

const persistWriteQueue = new Map<string, string>();
let persistFlushTimer: ReturnType<typeof setTimeout> | null = null;

function readQueuedOrStored(name: string): string | null {
  const queued = persistWriteQueue.get(name);
  if (queued !== undefined) return queued;
  try {
    return globalThis.localStorage?.getItem(name) ?? null;
  } catch {
    return null;
  }
}

function writeStored(name: string, value: string) {
  try {
    globalThis.localStorage?.setItem(name, value);
  } catch {
    // ignore quota / missing storage
  }
}

function flushSidebarViewPersistWrites() {
  if (persistFlushTimer != null) {
    clearTimeout(persistFlushTimer);
    persistFlushTimer = null;
  }
  if (persistWriteQueue.size === 0) return;
  const entries = [...persistWriteQueue.entries()];
  persistWriteQueue.clear();
  for (const [name, value] of entries) {
    writeStored(name, value);
  }
}

function scheduleSidebarViewPersistFlush() {
  if (persistFlushTimer != null) return;
  persistFlushTimer = setTimeout(() => {
    persistFlushTimer = null;
    flushSidebarViewPersistWrites();
  }, SIDEBAR_VIEW_PERSIST_DEBOUNCE_MS);
}

/** 测试或卸载前把尚未落盘的展开态写出去。 */
export function flushSidebarViewPersist(): void {
  flushSidebarViewPersistWrites();
}

const idleLocalStorage: StateStorage = {
  getItem: (name) => readQueuedOrStored(name),
  setItem: (name, value) => {
    persistWriteQueue.set(name, value);
    scheduleSidebarViewPersistFlush();
  },
  removeItem: (name) => {
    persistWriteQueue.delete(name);
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // ignore
    }
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSidebarViewPersistWrites);
}

type State = {
  expandedByNotebook: Record<string, string[]>;
  focusedByNotebook: Record<string, string | null>;
  selectedByNotebook: Record<string, string | null>;
  favoritesCollapsed: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setExpanded: (notebookId: string, ids: string[]) => void;
  expand: (notebookId: string, id: string) => void;
  collapse: (notebookId: string, id: string) => void;
  toggle: (notebookId: string, id: string) => void;
  setFocused: (notebookId: string, id: string | null) => void;
  setSelected: (notebookId: string, id: string | null) => void;
  setFavoritesCollapsed: (collapsed: boolean) => void;
};

export const useSidebarView = create<State>()(
  persist(
    (set, get) => ({
      expandedByNotebook: {},
      focusedByNotebook: {},
      selectedByNotebook: {},
      favoritesCollapsed: false,
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => {
        if (get().sidebarCollapsed === collapsed) return;
        set({ sidebarCollapsed: collapsed });
      },
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setExpanded: (notebookId, ids) => {
        const current = get().expandedByNotebook[notebookId];
        if (current && current.length === ids.length && current.every((v, i) => v === ids[i])) {
          return;
        }
        set((state) => ({
          expandedByNotebook: { ...state.expandedByNotebook, [notebookId]: ids },
        }));
      },
      expand: (notebookId, id) => {
        const list = get().expandedByNotebook[notebookId] ?? EMPTY_ARRAY;
        if (list.includes(id)) return;
        set((state) => ({
          expandedByNotebook: {
            ...state.expandedByNotebook,
            [notebookId]: [...list, id],
          },
        }));
      },
      collapse: (notebookId, id) => {
        const list = get().expandedByNotebook[notebookId];
        if (!list || !list.includes(id)) return;
        set((state) => ({
          expandedByNotebook: {
            ...state.expandedByNotebook,
            [notebookId]: list.filter((x) => x !== id),
          },
        }));
      },
      toggle: (notebookId, id) => {
        set((state) => {
          const list = state.expandedByNotebook[notebookId] ?? EMPTY_ARRAY;
          return {
            expandedByNotebook: {
              ...state.expandedByNotebook,
              [notebookId]: list.includes(id)
                ? list.filter((x) => x !== id)
                : [...list, id],
            },
          };
        });
      },
      setFocused: (notebookId, id) => {
        if (get().focusedByNotebook[notebookId] === id) return;
        set((state) => ({
          focusedByNotebook: { ...state.focusedByNotebook, [notebookId]: id },
        }));
      },
      setSelected: (notebookId, id) => {
        if (get().selectedByNotebook[notebookId] === id) return;
        set((state) => ({
          selectedByNotebook: { ...state.selectedByNotebook, [notebookId]: id },
        }));
      },
      setFavoritesCollapsed: (collapsed) => {
        if (get().favoritesCollapsed === collapsed) return;
        set({ favoritesCollapsed: collapsed });
      },
    }),
    {
      name: "goose-sidebar-view",
      version: 1,
      storage: createJSONStorage(() => idleLocalStorage),
      partialize: (state) => ({
        expandedByNotebook: state.expandedByNotebook,
        favoritesCollapsed: state.favoritesCollapsed,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);

export function toggleSidebarFolder(workspaceId: string | undefined, pageId: string) {
  if (!workspaceId) return;
  useSidebarView.getState().toggle(workspaceId, pageId);
}

export const selectExpandedIds = (notebookId: string | null) => (state: State) =>
  notebookId ? state.expandedByNotebook[notebookId] ?? EMPTY_ARRAY : EMPTY_ARRAY;

export const selectFocusedId = (notebookId: string | null) => (state: State) =>
  notebookId ? state.focusedByNotebook[notebookId] ?? null : null;

export const selectSelectedId = (notebookId: string | null) => (state: State) =>
  notebookId ? state.selectedByNotebook[notebookId] ?? null : null;

export const selectFavoritesCollapsed = (state: State) => state.favoritesCollapsed;
