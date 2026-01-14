import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uToolsStorage } from "@/lib/storage";

export interface Notebook {
  id: string;
  name: string;
  icon?: string; // emoji 或 Lucide 图标名
  createdAt: number;
  updatedAt: number;
  source?: "default" | "local-folder";
  localPath?: string; // 本地文件夹路径
  localPathMissing?: boolean;
}

interface NotebooksState {
  notebooks: Record<string, Notebook>;
  activeNotebookId: string | null;
  lastActivePageByNotebook: Record<string, string | null>;

  createNotebook: (name?: string, icon?: string) => string;
  createLocalFolderNotebook: (name: string, localPath: string) => string;
  updateNotebook: (
    id: string,
    updates: Partial<Omit<Notebook, "id" | "createdAt">>,
  ) => void;
  deleteNotebook: (id: string) => void;
  setActiveNotebook: (id: string) => void;
  getNotebook: (id: string) => Notebook | undefined;
  setLastActivePage: (notebookId: string, pageId: string | null) => void;
  getLastActivePage: (notebookId: string) => string | null;
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 默认记事本
const DEFAULT_NOTEBOOK_ID = "default-notebook";

export const useNotebooks = create<NotebooksState>()(
  persist(
    (set, get) => ({
      notebooks: {
        [DEFAULT_NOTEBOOK_ID]: {
          id: DEFAULT_NOTEBOOK_ID,
          name: "Note",
          icon: "📓",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      activeNotebookId: DEFAULT_NOTEBOOK_ID,
      lastActivePageByNotebook: {},

      createNotebook: (name = "Note", icon = "📓") => {
        // 检查是否存在同名笔记本，生成唯一名称
        const existingNames = new Set(
          Object.values(get().notebooks).map((n) => n.name),
        );

        let finalName = name;
        let suffix = 2;
        const baseName = name;
        while (existingNames.has(finalName)) {
          finalName = `${baseName}(${suffix})`;
          suffix++;
        }

        const id = generateId();
        const notebook: Notebook = {
          id,
          name: finalName,
          icon,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          notebooks: { ...state.notebooks, [id]: notebook },
          activeNotebookId: id,
        }));
        return id;
      },

      createLocalFolderNotebook: (name, localPath) => {
        const existing = Object.values(get().notebooks).find(
          (notebook) =>
            notebook.source === "local-folder" &&
            notebook.localPath === localPath,
        );
        if (existing) {
          set((state) => ({
            notebooks: {
              ...state.notebooks,
              [existing.id]: {
                ...existing,
                name,
                localPathMissing: false,
                updatedAt: Date.now(),
              },
            },
            activeNotebookId: existing.id,
          }));
          return existing.id;
        }

        const id = generateId();
        const notebook: Notebook = {
          id,
          name,
          icon: "📁", // 使用文件夹图标
          source: "local-folder",
          localPath,
          localPathMissing: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          notebooks: { ...state.notebooks, [id]: notebook },
          activeNotebookId: id,
        }));
        return id;
      },

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

      deleteNotebook: (id) => {
        const notebookCount = Object.keys(get().notebooks).length;
        if (notebookCount <= 1) return;

        const notebook = get().notebooks[id];
        const pagesStore = usePages.getState();
        if (notebook?.source === "local-folder") {
          pagesStore.removePagesByWorkspaceId(id);
        } else {
          const pagesInNotebook = Object.values(pagesStore.pages).filter(
            (p) => p.workspaceId === id,
          );
          pagesInNotebook.forEach((p) =>
            pagesStore.permanentlyDeletePage(p.id),
          );
        }

        set((state) => {
          const { [id]: _, ...rest } = state.notebooks;
          const { [id]: __, ...restLastActive } =
            state.lastActivePageByNotebook;

          const remainingIds = Object.keys(rest);
          const nextActiveNotebookId =
            state.activeNotebookId === id
              ? remainingIds[0] || null
              : state.activeNotebookId;

          if (state.activeNotebookId === id && nextActiveNotebookId) {
            const nextLastPageId =
              state.lastActivePageByNotebook[nextActiveNotebookId] || null;
            pagesStore.setActivePage(nextLastPageId);
          }

          return {
            notebooks: rest,
            lastActivePageByNotebook: restLastActive,
            activeNotebookId: nextActiveNotebookId,
          };
        });
      },

      setActiveNotebook: (id) => {
        set({ activeNotebookId: id });
        const notebook = get().notebooks[id];
        if (
          notebook?.source === "local-folder" &&
          notebook.localPath &&
          typeof window !== "undefined" &&
          (window as any).gooseFs
        ) {
          const exists = (window as any).gooseFs.exists(notebook.localPath);
          if (exists) {
            if (notebook.localPathMissing) {
              get().updateNotebook(id, { localPathMissing: false });
            }
            usePages.getState().loadLocalFolderPages(id, notebook.localPath);
          } else {
            if (!notebook.localPathMissing) {
              get().updateNotebook(id, { localPathMissing: true });
            }
            usePages.getState().removePagesByWorkspaceId(id);
          }
        }
      },

      getNotebook: (id) => {
        return get().notebooks[id];
      },

      setLastActivePage: (notebookId, pageId) => {
        set((state) => ({
          lastActivePageByNotebook: {
            ...state.lastActivePageByNotebook,
            [notebookId]: pageId,
          },
        }));
      },

      getLastActivePage: (notebookId) => {
        return get().lastActivePageByNotebook[notebookId] || null;
      },
    }),
    {
      name: "goose-note-notebooks",
      storage: createJSONStorage(() => uToolsStorage),
      partialize: (state) => ({
        notebooks: state.notebooks,
        activeNotebookId: state.activeNotebookId,
        lastActivePageByNotebook: state.lastActivePageByNotebook,
      }),
    },
  ),
);

export const DEFAULT_NOTEBOOK = DEFAULT_NOTEBOOK_ID;
