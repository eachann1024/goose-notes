import type { NotebooksState, Notebook } from "./types";
import { isElectronHost, generateId, nextNotebookOrder } from "./types";
import { usePages } from "../usePages";
import { persistPageSnapshots } from "../pages/persistence";
import {
  localPathsAreCaseInsensitive,
  comparisonLocalPath,
} from "@/lib/canonicalLocalPath";

export function createCreateNotebookActions(
  set: import("zustand").StoreApi<NotebooksState>["setState"],
  get: import("zustand").StoreApi<NotebooksState>["getState"],
): Pick<NotebooksState, "createNotebook" | "createLocalFolderNotebook"> {
  return {
    createNotebook: (
      name = "Note",
      icon = "BookOpen",
      overrideIfExists = false,
      customId?: string,
    ) => {
      // Electron 仅本地文件夹模式：拒绝创建内置记事本
      if (isElectronHost) return "";
      const dupNotebook = overrideIfExists
        ? Object.values(get().notebooks).find(
            (n) => (customId && n.id === customId) || n.name === name,
          )
        : null;

      const finalId = customId ?? generateId();

      if (dupNotebook) {
        const now = Date.now();
        const batchId = `b-${now}-${dupNotebook.id}`;
        const pagesStore = usePages.getState();
        const notebookPages = Object.values(pagesStore.pages).filter(
          (p) => p.workspaceId === dupNotebook.id,
        );

        if (notebookPages.length > 0) {
          const nextPages = { ...pagesStore.pages };
          const changedIds: string[] = [];

          notebookPages.forEach((page) => {
            if (page.trashedAt) {
              nextPages[page.id] = {
                ...page,
                workspaceId: finalId,
              };
            } else {
              nextPages[page.id] = {
                ...page,
                workspaceId: finalId,
                trashedAt: now,
                trashBatchId: batchId,
                isFavorite: false,
                isPinned: false,
                pinnedAt: undefined,
              };
            }
            changedIds.push(page.id);
          });

          usePages.setState({ pages: nextPages });
          persistPageSnapshots(nextPages, changedIds);
        }

        const { [dupNotebook.id]: _, ...remainingNotebooks } = get().notebooks;
        const { [dupNotebook.id]: __, ...remainingLastActive } =
          get().lastActivePageByNotebook;
        const { [dupNotebook.id]: ___, ...remainingLoadStates } =
          get().localFolderLoadStates;

        const notebook: Notebook = {
          id: finalId,
          name,
          icon,
          order: dupNotebook.order ?? nextNotebookOrder(remainingNotebooks),
          createdAt: dupNotebook.createdAt,
          updatedAt: now,
        };

        set({
          notebooks: { ...remainingNotebooks, [finalId]: notebook },
          lastActivePageByNotebook: remainingLastActive,
          localFolderLoadStates: remainingLoadStates,
          activeNotebookId: finalId,
        });

        return finalId;
      }

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

      const currentNotebooks = get().notebooks;
      const notebook: Notebook = {
        id: finalId,
        name: finalName,
        icon,
        order: nextNotebookOrder(currentNotebooks),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const nextNotebooks = { ...currentNotebooks, [finalId]: notebook };
      set({
        notebooks: nextNotebooks,
        activeNotebookId: finalId,
      });
      return finalId;
    },

    createLocalFolderNotebook: (name, localPath) => {
      const pagesStore = usePages.getState();
      const caseInsensitive = localPathsAreCaseInsensitive();
      const targetPath = comparisonLocalPath(localPath, caseInsensitive);
      const existing = Object.values(get().notebooks).find(
        (notebook) =>
          notebook.source === "local-folder" &&
          typeof notebook.localPath === "string" &&
          comparisonLocalPath(notebook.localPath, caseInsensitive) ===
            targetPath,
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
        const lastActivePageId = get().lastActivePageByNotebook[existing.id];
        const lastActivePage = lastActivePageId
          ? pagesStore.pages[lastActivePageId]
          : undefined;
        void pagesStore.setActivePage(
          lastActivePage?.workspaceId === existing.id &&
            !lastActivePage.trashedAt
            ? lastActivePage.id
            : null,
        );
        return existing.id;
      }

      const id = generateId();
      const currentNotebooks = get().notebooks;
      const notebook: Notebook = {
        id,
        name,
        icon: "FolderOpen",
        source: "local-folder",
        localPath,
        localPathMissing: false,
        order: nextNotebookOrder(currentNotebooks),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const nextNotebooks = { ...currentNotebooks, [id]: notebook };
      set({
        notebooks: nextNotebooks,
        activeNotebookId: id,
      });
      // 新本尚没有可复用的页面缓存，必须立即离开旧本编辑器；不能等异步
      // scan 的 showWelcome 收尾才清空，否则新库加载期间会短暂显示旧库正文。
      void pagesStore.setActivePage(null);
      return id;
    },
  };
}
