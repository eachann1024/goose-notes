import type { Page } from "@/types";
import { useNotebooks } from "../../../useNotebooks";
import { useTabs } from "../../../useTabs";
import { buildLocalPageId } from "@/lib/local-folder-scanner";
import {
  extractFirstHeadingText,
  sanitizeFilenameSegment,
  splitFilePath,
} from "@/lib/local-title-binding";
import type { StoreSet, StoreGet } from "../hydrate";
import { clonePageContent } from "../pageCreate";

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
  const page = get().pages[pageId];
  if (!page) return false;
  if (page.localReadState === "error") return false;

  try {
    // 先让编辑器把最新内容刷进 store。
    window.dispatchEvent(
      new CustomEvent("goose-note:flush-editor", {
        detail: { immediate: true, pageId },
      }),
    );

    // 若首块 H1 文字被改动，先把本地文件 rename，再写新路径。
    // 注：内容已由自动保存落盘；显式保存的主要价值是应用「标题→文件名」重命名，
    // 并确保最新内容一定落盘。
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
