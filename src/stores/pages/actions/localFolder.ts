import type { Page, JSONContent } from "@/types";
import { useNotebooks } from "../../useNotebooks";
import { useTabs } from "../../useTabs";
import { jsonContentToMarkdown } from "@/lib/export";
import { scanLocalFolderPages, buildLocalPageId } from "@/lib/local-folder-scanner";
import { normalizePageContent } from "@/lib/blocknote-content";
import {
  extractFirstHeadingText,
  sanitizeFilenameSegment,
  splitFilePath,
} from "@/lib/local-title-binding";
import type { PagesState } from "../types";
import { localPageMetadataCache, isLocalFolderPage } from "../persistence";
import { flushPendingLocalSaveByPageIdInternal, flushAllPendingLocalSavesInternal } from "../folderSync";
import type { StoreSet, StoreGet } from "./hydrate";
import { clonePageContent } from "./pageCreate";

function mergePageContent(base: JSONContent, addition: JSONContent): JSONContent {
  const baseBlocks = normalizePageContent(base);
  const additionBlocks = normalizePageContent(addition);
  if (!additionBlocks.length) {
    return baseBlocks;
  }

  const lastBlock = baseBlocks.at(-1);
  const firstAdditionBlock = additionBlocks[0];
  const needsSpacer =
    baseBlocks.length > 0 &&
    lastBlock?.type !== "paragraph" &&
    firstAdditionBlock?.type !== "paragraph";

  return [
    ...baseBlocks,
    ...(needsSpacer ? ([{ type: "paragraph", content: "" }] as JSONContent) : []),
    ...additionBlocks,
  ];
}

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
  }
};

export const writePageContentAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  content: JSONContent,
  _mode: "replace" = "replace",
): Promise<boolean> => {
  const page = get().pages[pageId];
  if (!page || page.isFolder) return false;

  get().updatePage(pageId, {
    content: clonePageContent(content),
  });

  if (isLocalFolderPage(page)) {
    // 程序化写入（AI 等）不走 dirty 队列：直接落盘并清掉 dirty 标记。
    const saved = await get().saveLocalPageContent(
      pageId,
      clonePageContent(content),
    );
    if (saved) {
      set((s) => ({
        dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
      }));
    }
    return saved;
  }

  return true;
};

export const appendPageContentAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  content: JSONContent,
): Promise<boolean> => {
  const page = get().pages[pageId];
  if (!page || page.isFolder) return false;

  const mergedContent = mergePageContent(
    clonePageContent(page.content),
    clonePageContent(content),
  );

  return await get().writePageContent(pageId, mergedContent);
};

export const replaceBlockRangeAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  startBlockId: string,
  endBlockId: string,
  newBlocks: JSONContent,
): Promise<boolean> => {
  const page = get().pages[pageId];
  if (!page || page.isFolder) return false;

  const sourceContent = page.content as unknown;
  const sourceBlocks = Array.isArray(sourceContent)
    ? (sourceContent as any[])
    : Array.isArray((sourceContent as any)?.content)
      ? ((sourceContent as any).content as any[])
      : null;
  if (!sourceBlocks) return false;

  const startIdx = sourceBlocks.findIndex(
    (block) => block?.id === startBlockId,
  );
  const endIdx = sourceBlocks.findIndex(
    (block) => block?.id === endBlockId,
  );
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return false;

  const replacementBlocks = Array.isArray(newBlocks)
    ? (newBlocks as any[])
    : Array.isArray((newBlocks as any)?.content)
      ? ((newBlocks as any).content as any[])
      : [];
  if (!replacementBlocks.length) return false;

  const clonedSource = clonePageContent(sourceContent as JSONContent) as any[];
  const cloneArr = Array.isArray(clonedSource) ? clonedSource : [];
  const head = cloneArr.slice(0, startIdx);
  const tail = cloneArr.slice(endIdx + 1);
  const replacement = JSON.parse(JSON.stringify(replacementBlocks)).map(
    (block: any) => {
      if (block && typeof block === "object" && "id" in block) {
        const { id: _omit, ...rest } = block;
        void _omit;
        return rest;
      }
      return block;
    },
  );

  const nextContent = [...head, ...replacement, ...tail] as JSONContent;
  return await get().writePageContent(pageId, nextContent);
};

export const saveLocalPageContentAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  content: JSONContent,
): Promise<boolean> => {
  if (typeof window === "undefined" || !window.gooseFs)
    return false;

  const page = get().pages[pageId];
  if (!page) return false;

  const filePath = get().getLocalFilePath(pageId);
  if (!filePath) return false;

  const processedContent = content;

  const assetsDir = filePath.replace(/[^\/\\]+$/, "") + "assets";
  try {
    if (window.gooseFs.mkdir) {
      await window.gooseFs.mkdir(assetsDir);
    }
  } catch {}

  const writePromises: Promise<any>[] = [];

  const processImages = (nodes: any[]) => {
    nodes.forEach((node) => {
      if (
        (node.type === "image" || node.type === "imageResize") &&
        node.attrs?.src?.startsWith("data:image")
      ) {
        const match = node.attrs.src.match(
          /^data:(image\/([a-zA-Z+]+));base64,(.+)$/,
        );
        if (match) {
          const ext = match[2] === "jpeg" ? "jpg" : match[2];
          const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
          const imagePath = `${assetsDir}/${filename}`;

          if (window.gooseFs?.writeFileAsync) {
            writePromises.push(window.gooseFs.writeFileAsync(imagePath, match[3], "base64"));
          } else {
            window.gooseFs?.writeFile(imagePath, match[3]);
          }

          node.attrs.src = `./assets/${filename}`;
        }
      }
      if (node.content) {
        processImages(node.content);
      }
    });
  };

  if (processedContent.content) {
    processImages(processedContent.content);
  }

  if (writePromises.length > 0) {
    await Promise.all(writePromises);
  }

  const markdownContent = jsonContentToMarkdown(processedContent);

  if (!markdownContent.trim()) {
    let exists = false;
    try { exists = window.gooseFs?.exists(filePath) ?? false; } catch {}

    if (exists) {
      let oldContent = "";
      if (window.gooseFs?.readFileAsync) {
        oldContent = await window.gooseFs.readFileAsync(filePath) || "";
      } else {
        oldContent = window.gooseFs?.readFile(filePath) || "";
      }

      if (oldContent && oldContent.trim().length > 10) {
        console.error("[Data Integrity] Refusing to save empty content.");
        return false;
      }
    }
  }

  let result: boolean;
  if (window.gooseFs?.writeFileAsync) {
    result = await window.gooseFs.writeFileAsync(filePath, markdownContent);
  } else {
    result = window.gooseFs?.writeFile(filePath, markdownContent) ?? false;
  }

  if (result) {
    set({ lastSavedAt: Date.now() });
  }
  return result;
};

export const flushPendingLocalSaveByPageIdAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
) => {
  await flushPendingLocalSaveByPageIdInternal(pageId, get);
  set((s) => ({ dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false } }));
};

export const flushPendingLocalSavesAction = async (
  set: StoreSet,
  get: StoreGet,
) => {
  await flushAllPendingLocalSavesInternal(get);
};

export const isLocalPageDirtyAction = (
  get: StoreGet,
  pageId: string,
): boolean => {
  return Boolean(get().dirtyLocalPageIds[pageId]);
};

/**
 * 把本地页面在 store 里从旧 id 切换到新 id（保留所有字段），同时联动 useTabs /
 * useNotebooks 中的引用。返回新 id。
 */
function renameLocalPageInStore(
  set: StoreSet,
  get: StoreGet,
  oldPageId: string,
  newPageId: string,
  nextFilePath: string,
): string {
  if (oldPageId === newPageId) {
    set((state) => {
      const page = state.pages[oldPageId];
      if (!page) return state;
      return {
        pages: {
          ...state.pages,
          [oldPageId]: { ...page, localFilePath: nextFilePath },
        },
      };
    });
    return oldPageId;
  }

  set((state) => {
    const page = state.pages[oldPageId];
    if (!page) return state;
    const nextPages = { ...state.pages };
    delete nextPages[oldPageId];
    nextPages[newPageId] = {
      ...page,
      id: newPageId,
      localFilePath: nextFilePath,
      updatedAt: Date.now(),
    };

    const nextDirty = { ...state.dirtyLocalPageIds };
    if (oldPageId in nextDirty) {
      delete nextDirty[oldPageId];
      nextDirty[newPageId] = true;
    }

    return {
      pages: nextPages,
      dirtyLocalPageIds: nextDirty,
      activePageId:
        state.activePageId === oldPageId ? newPageId : state.activePageId,
    };
  });

  // tabs 引用同步
  useTabs.setState((state) => ({
    openTabs: state.openTabs.map((tab) =>
      tab.pageId === oldPageId ? { ...tab, pageId: newPageId } : tab,
    ),
  }));

  // notebooks 的 lastActivePage 同步
  const notebooksState = useNotebooks.getState();
  const nextLastActive = { ...notebooksState.lastActivePageByNotebook };
  let changed = false;
  for (const key of Object.keys(nextLastActive)) {
    if (nextLastActive[key] === oldPageId) {
      nextLastActive[key] = newPageId;
      changed = true;
    }
  }
  if (changed) {
    useNotebooks.setState({ lastActivePageByNotebook: nextLastActive });
  }

  return newPageId;
}

async function maybeRenameLocalFileForTitle(
  set: StoreSet,
  get: StoreGet,
  pageId: string,
): Promise<{ pageId: string; collision: boolean }> {
  const page = get().pages[pageId];
  if (!page || !page.localFilePath) return { pageId, collision: false };

  const newTitle = extractFirstHeadingText(page.content);
  if (!newTitle) return { pageId, collision: false };

  const sanitized = sanitizeFilenameSegment(newTitle);
  if (!sanitized) return { pageId, collision: false };

  const { dir, base, ext } = splitFilePath(page.localFilePath);
  if (sanitized === base) return { pageId, collision: false };

  const nextFilePath = `${dir}/${sanitized}${ext}`;

  if (typeof window === "undefined" || !window.gooseFs) {
    return { pageId, collision: false };
  }

  const fs = window.gooseFs;
  const exists = (() => {
    try {
      return fs.exists?.(nextFilePath) ?? false;
    } catch {
      return false;
    }
  })();
  if (exists) {
    console.warn(
      "[local-title] rename skipped, target exists:",
      nextFilePath,
    );
    return { pageId, collision: true };
  }

  let renamed = false;
  try {
    renamed = Boolean(
      await Promise.resolve(fs.rename(page.localFilePath, nextFilePath)),
    );
  } catch (err) {
    console.error("[local-title] rename failed:", err);
    return { pageId, collision: false };
  }

  if (!renamed) return { pageId, collision: false };

  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  const basePath = notebook?.localPath || "";
  const newPageId = buildLocalPageId(page.workspaceId, basePath, nextFilePath);
  const nextPageId = renameLocalPageInStore(
    set,
    get,
    pageId,
    newPageId,
    nextFilePath,
  );

  return { pageId: nextPageId, collision: false };
}

export const saveDirtyLocalPageAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
): Promise<boolean> => {
  if (!get().dirtyLocalPageIds[pageId]) return false;
  const page = get().pages[pageId];
  if (!page) return false;

  try {
    // 先让编辑器把最新内容刷进 store。
    window.dispatchEvent(
      new CustomEvent("goose-note:flush-editor", {
        detail: { immediate: true, pageId },
      }),
    );

    // 若首块 H1 文字被改动，先把本地文件 rename，再写新路径。
    const { pageId: effectivePageId, collision } =
      await maybeRenameLocalFileForTitle(set, get, pageId);
    if (collision) {
      return false;
    }

    const latest = get().pages[effectivePageId];
    if (!latest) return false;

    const ok = await get().saveLocalPageContent(
      effectivePageId,
      clonePageContent(latest.content),
    );
    if (ok) {
      set((s) => ({
        dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [effectivePageId]: false },
      }));
    }
    return ok;
  } catch {
    return false;
  }
};
