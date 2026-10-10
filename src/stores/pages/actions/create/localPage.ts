import type { StoreSet, StoreGet } from "../hydrate";
import { UNTITLED_PAGE_TITLE } from "@/components/editor/utils/page-title";
import { createEmptyLocalPageContent } from "@/components/editor/utils/blocknote-content";
import { useNotebooks } from "../../../useNotebooks";
import { focusNewPage, cloneLocalPageContent } from "./content";
import type { JSONContent, Page } from "@/types";
import { useSettings } from "@/stores/useSettings";
import { pickRandomPageIcon } from "@/lib/randomPageIcon";
import { generateLocalPageId } from "./localPaths";
import {
  syncLocalPageMetadataCache,
  persistPageSnapshot,
} from "../../persistence";
import { markSelfWrite } from "@/lib/local-md-snapshot";
import { appendLocalFolderOrderEntries } from "@/stores/localFolderOrder";

export const createLocalPageAction = async (
  set: StoreSet,
  get: StoreGet,
  parentId?: string,
  workspaceId?: string,
): Promise<string | null> => {
  if (!workspaceId) return null;
  const id = await get().createLocalPageRecord({
    workspaceId,
    parentId,
    title: UNTITLED_PAGE_TITLE,
    content: createEmptyLocalPageContent(),
  });
  if (!id) return null;
  set({ activePageId: id });
  useNotebooks.getState().setLastActivePage(workspaceId, id);
  focusNewPage(id);

  return id;
};

export const createLocalPageRecordAction = async (
  set: StoreSet,
  get: StoreGet,
  {
    workspaceId,
    parentId,
    title,
    content,
    filePath: requestedFilePath,
  }: {
    workspaceId: string;
    parentId?: string;
    title?: string;
    content?: JSONContent;
    filePath?: string;
  },
): Promise<string | null> => {
  const notebook = useNotebooks.getState().notebooks[workspaceId];
  if (
    !notebook?.localPath ||
    typeof window === "undefined" ||
    !window.gooseFs
  ) {
    return null;
  }

  const randomIcon = useSettings.getState().randomIconOnCreate
    ? pickRandomPageIcon()
    : undefined;

  const resolveParentPath = () => {
    if (!parentId) return null;
    const parentPage = get().pages[parentId];
    // 优先从 page.localFilePath 取路径（稳定 id 后，路径永远在 localFilePath 字段）。
    if (parentPage?.localFilePath) return parentPage.localFilePath;
    // 兜底：页面不在 store 时，尝试从旧格式 id（local-{nb}-{encoded}）反解。
    // 注意：稳定 id 后 id 不再必然等于路径编码，此兜底仅供迁移过渡期使用。
    const prefix = `local-${workspaceId}-`;
    if (!parentId.startsWith(prefix)) return null;
    const encoded = parentId.slice(prefix.length);
    try {
      const relativePath = decodeURIComponent(encoded);
      return `${notebook.localPath}/${relativePath}`;
    } catch {
      return null;
    }
  };

  const now = Date.now();
  const localPath = notebook.localPath;
  const normalizedTitle = (
    (title || UNTITLED_PAGE_TITLE).trim() || UNTITLED_PAGE_TITLE
  ).replace(/[\\/:*?"<>|]/g, "_");
  const parentPath = resolveParentPath();
  const parentPage = parentId ? get().pages[parentId] : undefined;
  const storedParentId =
    parentPage?.localFilePath && !parentPage.isFolder
      ? parentPage.parentId
      : parentId;
  const baseDir = parentPath
    ? parentPage?.isFolder
      ? parentPath
      : parentPath.replace(/[^\/\\]+$/, "")
    : localPath;
  const normalizedBaseDir = baseDir.replace(/[\/\\]$/, "");

  const checkExists = async (path: string) => {
    if (window.gooseFs?.existsAsync) {
      return await window.gooseFs.existsAsync(path);
    }
    return window.gooseFs?.exists(path) ?? false;
  };

  const isPathInsideNotebookRoot = (candidate: string) => {
    const root = localPath.replace(/\\/g, "/").replace(/\/$/, "");
    const normalized = candidate.replace(/\\/g, "/");
    return normalized === root || normalized.startsWith(`${root}/`);
  };

  let filePath: string;
  if (requestedFilePath) {
    if (!isPathInsideNotebookRoot(requestedFilePath)) return null;
    if (await checkExists(requestedFilePath)) return null;
    filePath = requestedFilePath;
  } else {
    filePath = `${normalizedBaseDir}/${normalizedTitle}.md`;
    if (await checkExists(filePath)) {
      let suffix = 1;
      while (
        await checkExists(
          `${normalizedBaseDir}/${normalizedTitle} (${suffix}).md`,
        )
      ) {
        suffix++;
      }
      filePath = `${normalizedBaseDir}/${normalizedTitle} (${suffix}).md`;
    }
  }

  // 不要先写空文件再保存：空文件没有快照/自写标记，写盘前冲突检查会把
  // 「磁盘空文件 ≠ 陈旧快照」误判成外部修改，AI 新建会失败并弹出冲突 toast。
  const id = generateLocalPageId(workspaceId, filePath);
  const newPage: Page = {
    id,
    workspaceId,
    parentId: storedParentId,
    content: cloneLocalPageContent(content),
    isFolder: false,
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    localFilePath: filePath,
    createdAt: now,
    updatedAt: now,
    order: now,
    ...(randomIcon ? { icon: randomIcon } : {}),
  };

  set((state) => ({
    pages: { ...state.pages, [id]: newPage },
  }));

  syncLocalPageMetadataCache(id, newPage);
  markSelfWrite(filePath);
  let saved: boolean;
  try {
    saved = await get().saveLocalPageContent(
      id,
      cloneLocalPageContent(newPage.content),
      { force: true },
    );
  } catch {
    saved = false;
  }
  if (!saved) {
    set((state) => {
      const nextPages = { ...state.pages };
      delete nextPages[id];
      return { pages: nextPages };
    });
    return null;
  }

  persistPageSnapshot(get().pages[id]);
  // 手动顺序目录：新建条目追加到末尾，位置从此稳定
  appendLocalFolderOrderEntries(workspaceId, [get().pages[id]]);
  return id;
};
