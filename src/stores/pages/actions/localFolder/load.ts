import type { Page } from "@/types";
import { useNotebooks } from "../../../useNotebooks";
import { useTabs } from "../../../useTabs";
import { useSettings } from "@/stores/useSettings";
import {
  scanLocalFolderPages,
  parseLocalMarkdownContent,
  localFileTitleFromPath,
  shouldIgnoreLocalRelativePath,
} from "@/lib/local-folder-scanner";
import {
  setLocalMdSnapshot,
  updateSnapshotStat,
  deleteLocalMdSnapshot,
} from "@/lib/local-md-snapshot";
import { canonicalRelativePath } from "@/lib/canonicalLocalPath";
import {
  readLocalPageIdMap,
  resolveOrCreateStableId,
  writeLocalPageIdMap,
} from "@/lib/local-page-idmap";
import { resolveHistoryBackend } from "@/lib/history/backend";
import { localPageMetadataCache } from "../../persistence";
import {
  acknowledgeRecoveryEntry,
  canApplyRecoveryEntry,
  listRecoveryEntries,
} from "@/lib/storage/recoveryJournal";
import { restorePendingLocalSave } from "../../folderSync";
import {
  appendLocalFolderOrderEntries,
  ensureLocalFolderOrdersLoaded,
} from "@/stores/localFolderOrder";
import { toast } from "@/components/ui/sonner";
import { getContentSignature } from "@/components/editor/utils/blocknote-content";
import type { StoreSet, StoreGet } from "../hydrate";

interface LocalFolderLoadTask {
  fingerprint: string;
  requestId: number;
  promise: Promise<void>;
}

const localFolderLoadTasks = new Map<string, LocalFolderLoadTask>();
const latestLocalFolderLoadRequest = new Map<string, number>();
let localFolderLoadRequestSequence = 0;

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
  } catch (error) {
    console.error("[local-folder] reload read failed", error);
    return;
  }

  const parsed = await parseLocalMarkdownContent(
    markdown,
    localFileTitleFromPath(filePath),
    readError,
  );

  // 外部变更后更新快照，保证下次写盘前 diff 与磁盘最新状态比较。
  if (typeof markdown === "string") {
    setLocalMdSnapshot(filePath, markdown);
    try {
      const stat = await window.gooseFs.statAsync?.(filePath);
      if (stat) updateSnapshotStat(filePath, stat);
    } catch {
      // 指纹失败不影响重载，下次 watch 退回读全文
    }
  }

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
          fontFamily: parsed.fontFamily,
          pageLayout: parsed.pageLayout,
          isLocked: parsed.isLocked,
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

const loadLocalFolderPagesOnce = async (
  set: StoreSet,
  get: StoreGet,
  notebookId: string,
  basePath: string,
  options: { showWelcome?: boolean } | undefined,
  hiddenFolders: string[],
  requestId: number,
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
  const dirtyPageIdsAtLoadStart = new Set(
    Object.entries(get().dirtyLocalPageIds)
      .filter(([, dirty]) => dirty)
      .map(([pageId]) => pageId),
  );
  const contentSignaturesAtLoadStart = new Map(
    Object.values(get().pages)
      .filter((page) => page.workspaceId === notebookId)
      .map((page) => [page.id, getContentSignature(page.content)]),
  );
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
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        });
      }
    });
  }

  try {
    const localPages = await scanLocalFolderPages({
      notebookId,
      basePath,
      gooseFs: window.gooseFs,
      hiddenFolders,
    });

    // 同一记事本可能在启动恢复、点击切换和 watch 兜底中同时发起刷新。
    // 只允许最新请求提交，避免较慢的旧扫描反向覆盖新目录状态。
    if (latestLocalFolderLoadRequest.get(notebookId) !== requestId) return;

    set((state) => {
      const pagesOutsideNotebook = Object.fromEntries(
        Object.entries(state.pages).filter(
          ([, page]) => page.workspaceId !== notebookId,
        ),
      );
      const unsavedInNotebook = Object.fromEntries(
        Object.entries(state.pages).filter(
          ([, page]) =>
            page.workspaceId === notebookId &&
            page.localUnsaved &&
            !page.localFilePath,
        ),
      );
      const updated = {
        ...pagesOutsideNotebook,
        ...localPages.reduce(
          (acc, page) => {
            const existing = localPageMetadataCache.get(page.id);
            const current = state.pages[page.id];
            if (existing) {
              // icon 等非 frontmatter 属性保留
              if (existing.icon) {
                page.icon = existing.icon;
              }
              // isPinned / isFavorite 以 frontmatter 为准；若 frontmatter 标为 pinned/favorite，可沿用现有时间戳或排序
              if (page.isPinned && existing.pinnedAt !== undefined) {
                page.pinnedAt = existing.pinnedAt;
              }
              if (page.isFavorite && existing.favoriteOrder !== undefined) {
                page.favoriteOrder = existing.favoriteOrder;
              }
              if (existing.createdAt !== undefined) {
                page.createdAt = existing.createdAt;
              }
              if (existing.updatedAt !== undefined) {
                page.updatedAt = existing.updatedAt;
              }
            }

            // 重扫不能覆盖仍在内存/写盘队列中的本地编辑。既保护扫描开始时
            // 已 dirty 的页，也保护扫描期间内容发生过变化、但写盘刚成功清掉
            // dirty 标记的页；同时采纳扫描得到的路径与父级元数据。
            const contentChangedDuringScan =
              current &&
              contentSignaturesAtLoadStart.get(page.id) !==
                getContentSignature(current.content);
            const preserveCurrent =
              current &&
              (dirtyPageIdsAtLoadStart.has(page.id) || contentChangedDuringScan);
            acc[page.id] = preserveCurrent
              ? {
                  ...page,
                  ...current,
                  workspaceId: page.workspaceId,
                  parentId: page.parentId,
                  localFilePath: page.localFilePath,
                  localReadState: page.localReadState,
                  localReadError: page.localReadError,
                }
              : page;
            return acc;
          },
          {} as Record<string, Page>,
        ),
        ...unsavedInNotebook,
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
          const notebook = useNotebooks.getState().notebooks[notebookId];
          const isLocalFolder = notebook?.source === "local-folder";

          if (isLocalFolder) {
            // 隐藏目录设置变化后，当前页可能已不在重扫结果里；不能保留悬空 activePageId。
            if (nextActivePageId && !updated[nextActivePageId]) {
              result.activePageId = null;
              result.expandPageId = null;
            }
          } else {
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
            } else {
              const firstPage = localPages
                .filter((p) => !p.trashedAt)
                .sort(
                  (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
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

      if (options?.showWelcome && !hasExistingPages) {
        // 打开/切换到本地文件夹时保持空白入口，不自动打开首篇。
        // 已缓存的文件夹复用上次活动页并后台刷新，不能在扫描完成后再把它
        // 清回空白，否则会重现一次完整界面闪烁。
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

    // 扫描发现的条目（外部新增 / 移入）追加到所属手动顺序目录末尾。
    // 只追加不清理：隐藏目录 / 暂时读不到的文件不在 localPages 里，
    // 按扫描结果清扫会误删合法槽位（应用内移动的旧槽位由 move 路径清）。
    appendLocalFolderOrderEntries(notebookId, localPages);

    let recoveredCount = 0;
    let conflictCount = 0;
    for (const entry of listRecoveryEntries("local-file")) {
      const current = get().pages[entry.id];
      if (!current || current.workspaceId !== notebookId || current.isFolder)
        continue;
      const currentSignature = getContentSignature(current.content);
      if (
        currentSignature ===
        getContentSignature(entry.content)
      ) {
        acknowledgeRecoveryEntry("local-file", entry.id, entry.revision);
        continue;
      }
      if (!canApplyRecoveryEntry(entry, current.content, undefined, currentSignature)) {
        conflictCount += 1;
        continue;
      }
      if (entry.content) {
        restorePendingLocalSave(entry.id, entry.content, entry.revision);
        set((state) => ({
          pages: {
            ...state.pages,
            [entry.id]: { ...state.pages[entry.id], content: entry.content! },
          },
          dirtyLocalPageIds: {
            ...state.dirtyLocalPageIds,
            [entry.id]: true,
          },
        }));
        recoveredCount += 1;
      }
    }
    if (recoveredCount > 0) {
      toast.warning(`已找回 ${recoveredCount} 篇未写盘的本地笔记`, {
        id: `goose-recovered-local-pages:${notebookId}`,
        description: "尚未覆盖磁盘文件，请确认内容后按保存。",
      });
    }
    if (conflictCount > 0) {
      toast.warning("本地文件已有外部更新", {
        id: `goose-local-recovery-conflicts:${notebookId}`,
        description: "恢复稿已保留，未自动覆盖磁盘新版本。",
      });
    }
    useNotebooks.getState().setLocalFolderLoadState(notebookId, {
      status: "ready",
      finishedAt: Date.now(),
    });
    // 该笔记本页面已就绪：清理指向已不存在文件的持久化标签。
    try {
      const { useTabs } = await import("../../../useTabs");
      useTabs.getState().reconcileTabs();
    } catch {
      // ignore tabs reconcile error
    }
  } catch (error) {
    if (latestLocalFolderLoadRequest.get(notebookId) !== requestId) return;
    const message =
      error instanceof Error && error.message
        ? error.message
        : "无法读取本地文件夹";
    useNotebooks.getState().setLocalFolderLoadState(notebookId, {
      status: "error",
      finishedAt: Date.now(),
      error: message,
    });
    throw error;
  }
};

export const loadLocalFolderPagesAction = (
  set: StoreSet,
  get: StoreGet,
  notebookId: string,
  basePath: string,
  options?: { showWelcome?: boolean },
): Promise<void> => {
  if (typeof window === "undefined" || !window.gooseFs) {
    return Promise.resolve();
  }

  // 手动排序只存在内存 store 里，进该本地文件夹时读进来，树才能直接按手动顺序渲染
  ensureLocalFolderOrdersLoaded(notebookId);

  const hiddenFolders = [...useSettings.getState().localFolderHiddenFolders];
  const fingerprint = JSON.stringify({
    basePath,
    hiddenFolders,
    showWelcome: Boolean(options?.showWelcome),
  });
  const existing = localFolderLoadTasks.get(notebookId);
  if (existing?.fingerprint === fingerprint) return existing.promise;

  const requestId = ++localFolderLoadRequestSequence;
  latestLocalFolderLoadRequest.set(notebookId, requestId);
  const promise = loadLocalFolderPagesOnce(
    set,
    get,
    notebookId,
    basePath,
    options,
    hiddenFolders,
    requestId,
  ).finally(() => {
    const current = localFolderLoadTasks.get(notebookId);
    if (current?.requestId === requestId) {
      localFolderLoadTasks.delete(notebookId);
    }
  });

  localFolderLoadTasks.set(notebookId, {
    fingerprint,
    requestId,
    promise,
  });
  return promise;
};

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
