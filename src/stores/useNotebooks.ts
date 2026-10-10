import { create } from "zustand";
import type { NotebooksState, Notebook } from "./notebooks/types";
import { persist, createJSONStorage } from "zustand/middleware";
import { isElectronHost, DEFAULT_NOTEBOOK_ID } from "./notebooks/types";
import { createCreateNotebookActions } from "./notebooks/createActions";
import { createDeleteNotebookActions } from "./notebooks/deleteActions";
import { createActiveNotebookActions } from "./notebooks/activeActions";
import { createMetadataNotebookActions } from "./notebooks/metadataActions";
import { localStorageAdapter } from "@/lib/storage";

export const useNotebooks = create<NotebooksState>()(
  persist(
    (set, get) => ({
      notebooks: isElectronHost
        ? ({} as Record<string, Notebook>)
        : {
            [DEFAULT_NOTEBOOK_ID]: {
              id: DEFAULT_NOTEBOOK_ID,
              name: "Note",
              icon: "BookOpen",
              order: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
      activeNotebookId: isElectronHost ? null : DEFAULT_NOTEBOOK_ID,
      lastActivePageByNotebook: {},
      localFolderLoadStates: {},
      ...createCreateNotebookActions(set, get),
      ...createDeleteNotebookActions(set, get),
      ...createActiveNotebookActions(set, get),
      ...createMetadataNotebookActions(set, get),
    }),
    {
      name: "goose-note-notebooks",
      version: 4,
      storage: createJSONStorage(() => localStorageAdapter),
      partialize: (state) => ({
        notebooks: state.notebooks,
        activeNotebookId: state.activeNotebookId,
        lastActivePageByNotebook: state.lastActivePageByNotebook,
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        // Electron 仅本地文件夹模式：水合后立刻丢掉内置本（含历史 default-notebook），
        // 绝不回种；activeNotebookId 失效时回空态。
        if (!isElectronHost || !state) return;
        const localOnly = Object.fromEntries(
          Object.entries(state.notebooks).filter(
            ([, notebook]) => notebook.source === "local-folder",
          ),
        );
        const activeValid =
          state.activeNotebookId && localOnly[state.activeNotebookId]
            ? state.activeNotebookId
            : null;
        useNotebooks.setState({
          notebooks: localOnly,
          activeNotebookId: activeValid,
        });
      },
      migrate: (persistedState: unknown) => {
        const safeState = persistedState as
          | {
              notebooks?: Record<string, Notebook>;
              activeNotebookId?: string | null;
              lastActivePageByNotebook?: Record<string, string | null>;
            }
          | undefined;
        if (!safeState?.notebooks) return persistedState;

        const migratedNotebooks = Object.fromEntries(
          Object.entries(safeState.notebooks).map(([id, notebook]) => [
            id,
            (() => {
              const {
                editorFullWidth: _legacyEditorFullWidth,
                ...persistedNotebook
              } = notebook as Notebook & { editorFullWidth?: boolean };
              return {
                ...persistedNotebook,
                icon:
                  id === DEFAULT_NOTEBOOK_ID && notebook.icon === "📓"
                    ? "BookOpen"
                    : notebook.source === "local-folder" &&
                        notebook.icon === "📁"
                      ? "FolderOpen"
                      : notebook.icon,
              };
            })(),
          ]),
        );

        // v4：缺 order 的本按 createdAt 升序补 0..n-1
        const sortedForOrder = Object.values(migratedNotebooks).sort(
          (a, b) => a.createdAt - b.createdAt,
        );
        sortedForOrder.forEach((notebook, index) => {
          if (notebook.order === undefined) {
            migratedNotebooks[notebook.id] = { ...notebook, order: index };
          }
        });

        return {
          ...safeState,
          notebooks: migratedNotebooks,
        };
      },
    },
  ),
);

export {
  type Notebook,
  sortNotebooksByOrder,
  type LocalFolderLoadStatus,
  type LocalFolderLoadState,
  DEFAULT_NOTEBOOK,
} from "./notebooks/types";
