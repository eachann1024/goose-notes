import type { NotebooksState } from "./types";

export function createMetadataNotebookActions(
  set: import("zustand").StoreApi<NotebooksState>["setState"],
  get: import("zustand").StoreApi<NotebooksState>["getState"],
): Pick<NotebooksState, "updateNotebook" | "reorderNotebooks"> {
  return {
    updateNotebook: (id, updates) => {
      set((state) => {
        const notebook = state.notebooks[id];
        if (!notebook) return state;
        return {
          notebooks: {
            ...state.notebooks,
            [id]: { ...notebook, ...updates, updatedAt: Date.now() },
          },
        };
      });
    },

    reorderNotebooks: (orderedIds) => {
      set((state) => {
        const nextNotebooks = { ...state.notebooks };
        let changed = false;
        orderedIds.forEach((id, index) => {
          const notebook = nextNotebooks[id];
          if (!notebook || notebook.order === index) return;
          nextNotebooks[id] = { ...notebook, order: index };
          changed = true;
        });
        return changed ? { notebooks: nextNotebooks } : state;
      });
    },
  };
}
