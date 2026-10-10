import type { StoreSet, StoreGet } from "../../hydrate";
import {
  deleteLocalMdSnapshot,
  setLocalMdSnapshot,
} from "@/lib/local-md-snapshot";
import { resolveHistoryBackend } from "@/lib/history/backend";
import { useTabs } from "../../../../useTabs";
import {
  localFileTitleFromPath,
  shouldIgnoreLocalRelativePath,
  parseLocalMarkdownContent,
} from "@/lib/local-folder-scanner";
import { canonicalRelativePath } from "@/lib/canonicalLocalPath";
import { useSettings } from "@/stores/useSettings";
import {
  readLocalPageIdMap,
  resolveOrCreateStableId,
  writeLocalPageIdMap,
} from "@/lib/local-page-idmap";
import { localPageMetadataCache } from "../../../persistence";
import type { Page } from "@/types";
import { appendLocalFolderOrderEntries } from "@/stores/localFolderOrder";

// ── 增量 watch 辅助：单页从 store 移除 ────────────────────────────────────────
/**
 * 文件被外部删除/移走时，从 store 中移除该页面并处理 activePage / tab 善后。
 * 不触发全量重扫。
 */
export const removeSingleLocalPageAction = (
  set: StoreSet,
  get: StoreGet,
  filePath: string,
): void => {
  const pages = get().pages;
  const target = Object.values(pages).find(
    (p) =>
      p.localFilePath === filePath ||
      p.localFilePath?.replace(/\\/g, "/") === filePath.replace(/\\/g, "/"),
  );
  if (!target) return;

  const pageId = target.id;

  // 清除快照
  deleteLocalMdSnapshot(filePath);

  // 清理历史快照（.goose/history/ 下的孤儿数据）：必须在 store 记录删除前
  // 调用，删后 resolveHistoryBackend 解析不到 notebook.localPath。
  void resolveHistoryBackend(pageId).dropAll(pageId);

  set((state) => {
    const newPages = { ...state.pages };
    delete newPages[pageId];

    const nextActivePageId =
      state.activePageId === pageId ? null : state.activePageId;

    const newDirty = { ...state.dirtyLocalPageIds };
    delete newDirty[pageId];

    return {
      pages: newPages,
      activePageId: nextActivePageId,
      dirtyLocalPageIds: newDirty,
    };
  });

  // 关闭指向该页面的标签
  useTabs.getState().removeDeletedPage(pageId);
};

// ── 增量 watch 辅助：单个新文件扫入 store ────────────────────────────────────
/**
 * 文件被外部新建/移入时，读取文件内容、构造 Page 对象并合并进 store。
 * 若该 pageId 已存在（例如 rename 后先 add 再 remove）则更新内容。
 * 不触发全量重扫，不触发 activePage 跳转。
 */
export const addSingleLocalPageAction = async (
  set: StoreSet,
  _get: StoreGet,
  notebookId: string,
  basePath: string,
  filePath: string,
  options?: { force?: boolean },
): Promise<void> => {
  if (typeof window === "undefined" || !window.gooseFs) return;

  const fs = window.gooseFs;

  // 只处理 markdown 文件（非目录）
  if (!/\.(md|markdown)$/i.test(filePath)) return;

  const fallbackTitle = localFileTitleFromPath(filePath);
  const relativePath = canonicalRelativePath(basePath, filePath);
  if (!relativePath) return;
  if (
    !options?.force &&
    shouldIgnoreLocalRelativePath(
      relativePath,
      useSettings.getState().localFolderHiddenFolders,
    )
  ) {
    return;
  }
  const idMap = readLocalPageIdMap(notebookId);
  const { id: pageId, dirty } = resolveOrCreateStableId(
    notebookId,
    relativePath,
    idMap,
  );
  if (dirty) {
    writeLocalPageIdMap(notebookId, idMap);
  }

  let markdown: string | null;
  let readError: string | undefined;
  try {
    if (fs.readFileStatAsync) {
      const result = await fs.readFileStatAsync(filePath);
      markdown = result.ok ? (result.content ?? "") : null;
      readError = result.error || undefined;
    } else if (fs.readFileStat) {
      const result = fs.readFileStat(filePath);
      markdown = result.ok ? (result.content ?? "") : null;
      readError = result.error || undefined;
    } else if (fs.readFileAsync) {
      markdown = await fs.readFileAsync(filePath);
    } else {
      markdown = fs.readFile(filePath);
    }
  } catch (err) {
    console.error("[local-folder] addSingleLocalPage read failed", err);
    return;
  }

  const parsed = await parseLocalMarkdownContent(
    markdown,
    fallbackTitle,
    readError,
  );

  // 记录快照
  if (typeof markdown === "string") {
    setLocalMdSnapshot(filePath, markdown);
  }

  // 恢复元数据缓存（如果有）
  const cachedMeta = localPageMetadataCache.get(pageId);

  const now = Date.now();
  const newPage: Page = {
    id: pageId,
    workspaceId: notebookId,
    content: parsed.content,
    isFolder: false,
    isLocked: parsed.isLocked,
    isPinned: parsed.isPinned || undefined,
    pinnedAt: parsed.isPinned ? (cachedMeta?.pinnedAt ?? now) : undefined,
    isFavorite: parsed.isFavorite || undefined,
    favoriteOrder: parsed.isFavorite ? cachedMeta?.favoriteOrder : undefined,
    fontSize: "default",
    fontFamily: parsed.fontFamily,
    pageLayout: parsed.pageLayout,
    localFilePath: filePath,
    localFrontmatter: parsed.frontmatter,
    localReadState: parsed.readState,
    localReadError: parsed.readError,
    createdAt: now,
    updatedAt: now,
    ...(cachedMeta?.icon && { icon: cachedMeta.icon }),
  };

  set((state) => ({
    pages: {
      ...state.pages,
      [pageId]: newPage,
    },
  }));

  // watch 增量新增（外部新建/移入）：进手动顺序目录末尾
  appendLocalFolderOrderEntries(notebookId, [newPage]);
};
