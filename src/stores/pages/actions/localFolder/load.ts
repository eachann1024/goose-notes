import type { Page } from "@/types";
import { useNotebooks } from "../../../useNotebooks";
import {
  scanLocalFolderPages,
  parseLocalMarkdownContent,
  localFileTitleFromPath,
} from "@/lib/local-folder-scanner";
import { localPageMetadataCache } from "../../persistence";
import type { StoreSet, StoreGet } from "../hydrate";

// 外部进程修改了文件后，把磁盘内容重新读入 store（不触发脏标记 / 自动保存）。
// 若该文件有未保存的本地编辑（dirty）则跳过，避免覆盖用户输入。
export const reloadLocalPageFromDiskAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
): Promise<void> => {
  if (typeof window === "undefined" || !window.gooseFs) return;

  const page = get().pages[pageId];
  if (!page || page.isFolder || !page.localFilePath) return;
  if (get().dirtyLocalPageIds[pageId]) return;

  const fs = window.gooseFs;
  const filePath = page.localFilePath;

  let markdown: string | null = null;
  let readError: string | undefined;
  try {
    if (fs.readFileStatAsync) {
      const result = await fs.readFileStatAsync(filePath);
      markdown = result.ok ? result.content ?? "" : null;
      readError = result.error || undefined;
    } else if (fs.readFileStat) {
      const result = fs.readFileStat(filePath);
      markdown = result.ok ? result.content ?? "" : null;
      readError = result.error || undefined;
    } else if (fs.readFileAsync) {
      markdown = await fs.readFileAsync(filePath);
    } else {
      markdown = fs.readFile(filePath);
    }
  } catch (error) {
    console.error("[local-folder] reload read failed", error);
    return;
  }

  const parsed = parseLocalMarkdownContent(
    markdown,
    localFileTitleFromPath(filePath),
    readError,
  );

  set((state) => {
    const current = state.pages[pageId];
    if (!current) return state;
    return {
      pages: {
        ...state.pages,
        [pageId]: {
          ...current,
          content: parsed.content,
          localFrontmatter: parsed.frontmatter,
          localReadState: parsed.readState,
          localReadError: parsed.readError,
          updatedAt: Date.now(),
        },
      },
    };
  });

  // 当前正在编辑的文件被外部修改 → 通知编辑器重载内容。
  if (get().activePageId === pageId) {
    window.dispatchEvent(
      new CustomEvent("goose-note:reload-active-editor", {
        detail: { pageId },
      }),
    );
  }
};

export const loadLocalFolderPagesAction = async (
  set: StoreSet,
  get: StoreGet,
  notebookId: string,
  basePath: string,
  options?: { showWelcome?: boolean },
) => {
  if (typeof window === "undefined" || !window.gooseFs) return;

  const previousActivePageId = get().activePageId;
  const previousActivePage = previousActivePageId
    ? get().pages[previousActivePageId]
    : undefined;
  const previousActiveInNotebook =
    previousActivePage?.workspaceId === notebookId
      ? previousActivePageId
      : null;
  useNotebooks.getState().setLocalFolderLoadState(notebookId, {
    status: "loading",
    startedAt: Date.now(),
  });

  const currentPages = get().pages;
  const hasExistingPages = Object.values(currentPages).some(
    (p) => p.workspaceId === notebookId,
  );

  if (hasExistingPages) {
    Object.values(currentPages).forEach((p) => {
      if (p.workspaceId === notebookId) {
        localPageMetadataCache.set(p.id, {
          isFavorite: p.isFavorite,
          favoriteOrder: p.favoriteOrder,
          icon: p.icon,
          isPinned: p.isPinned,
          pinnedAt: p.pinnedAt,
        });
      }
    });
  }

  get().removePagesByWorkspaceId(notebookId);
  try {
    const localPages = await scanLocalFolderPages({
      notebookId,
      basePath,
      gooseFs: window.gooseFs,
    });

    set((state) => {
      const updated = {
        ...state.pages,
        ...localPages.reduce(
          (acc, page) => {
            const existing = localPageMetadataCache.get(page.id);
            if (existing) {
              if (existing.isFavorite !== undefined) {
                page.isFavorite = existing.isFavorite;
              }
              if (existing.favoriteOrder !== undefined) {
                page.favoriteOrder = existing.favoriteOrder;
              }
              if (existing.icon) {
                page.icon = existing.icon;
              }
              if (existing.isPinned !== undefined) {
                page.isPinned = existing.isPinned;
              }
              if (existing.pinnedAt !== undefined) {
                page.pinnedAt = existing.pinnedAt;
              }
            }

            acc[page.id] = page;
            return acc;
          },
          {} as Record<string, Page>,
        ),
      };

      const { pendingNavigatePageId } = state;
      const result: any = { pages: updated };
      let nextActivePageId = state.activePageId;
      let handledNavigation = false;

      if (pendingNavigatePageId && updated[pendingNavigatePageId]) {
        nextActivePageId = pendingNavigatePageId;
        result.activePageId = nextActivePageId;
        result.expandPageId = nextActivePageId;
        result.pendingNavigatePageId = null;
        handledNavigation = true;
      }

      if (!handledNavigation) {
        const activeNotebookId = useNotebooks.getState().activeNotebookId;
        if (activeNotebookId === notebookId) {
          const autoOpenLastNote =
            typeof window !== "undefined"
              ? (window as any).__gooseNoteAutoOpenLastNote !== false
              : true;
          const allowAutoRestore = autoOpenLastNote === true;
          const notebook = useNotebooks.getState().notebooks[notebookId];
          const isLocalFolder = notebook?.source === "local-folder";

          if (allowAutoRestore || !isLocalFolder) {
            const lastActivePageId = useNotebooks
              .getState()
              .getLastActivePage(notebookId);
            const pageIdSet = new Set(localPages.map((p) => p.id));

            if (lastActivePageId && pageIdSet.has(lastActivePageId)) {
              nextActivePageId = lastActivePageId;
            } else if (
              previousActiveInNotebook &&
              pageIdSet.has(previousActiveInNotebook)
            ) {
              nextActivePageId = previousActiveInNotebook;
            } else if (!isLocalFolder) {
              const firstPage = localPages
                .filter((p) => !p.trashedAt)
                .sort(
                  (a, b) =>
                    (a.order ?? a.createdAt) -
                    (b.order ?? b.createdAt),
                )[0];
              if (firstPage) {
                nextActivePageId = firstPage.id;
              }
            }

            if (nextActivePageId !== state.activePageId) {
              result.activePageId = nextActivePageId;
            }
          }
        }
      }

      if (options?.showWelcome) {
        result.activePageId = null;
        result.expandPageId = null;
        result.pendingNavigatePageId = null;
      }

      const hasActivePageUpdate = Object.prototype.hasOwnProperty.call(
        result,
        "activePageId",
      );
      const currentActive = hasActivePageUpdate
        ? result.activePageId
        : state.activePageId;
      const activeNotebookId = useNotebooks.getState().activeNotebookId;
      if (activeNotebookId === notebookId && currentActive) {
        useNotebooks.getState().setLastActivePage(notebookId, currentActive);
      }

      return result;
    });
  } finally {
    useNotebooks.getState().setLocalFolderLoadState(notebookId, {
      status: "ready",
      finishedAt: Date.now(),
    });
    // 该笔记本页面已就绪：清理指向已不存在文件的持久化标签。
    try {
      const { useTabs } = await import("../../../useTabs");
      useTabs.getState().reconcileTabs();
    } catch {
      // 忽略
    }
  }
};
