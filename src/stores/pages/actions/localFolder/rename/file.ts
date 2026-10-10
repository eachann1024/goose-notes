import type { StoreSet, StoreGet } from "../../hydrate";
import {
  sanitizeFilenameSegment,
  splitFilePath,
} from "@/lib/local-title-binding";
import { renameLocalDirectory } from "./directory";
import { allocateUniqueLocalBaseName } from "../pathGuards";
import {
  flushPendingLocalSaveByPageIdInternal,
  acquireLocalPageFileOperation,
} from "../../../folderSync";
import { markSelfMoved } from "../move";
import { useNotebooks } from "../../../../useNotebooks";
import {
  toRelativePath,
  migrateLocalPageIdMapEntry,
} from "@/lib/local-page-idmap";

/**
 * 显式重命名 local-folder 页面文件。
 * 由虚拟标题组件在用户提交新名称时调用。
 *
 * @param newBaseName  新文件名（不含扩展名，已由调用方 sanitize）
 * @returns            成功时返回新 pageId；失败时 throw
 */
export async function renameLocalPageFileAction(
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  newBaseName: string,
): Promise<string> {
  const page = get().pages[pageId];
  if (!page || !page.localFilePath) {
    throw new Error("页面不存在或非本地文件夹页面");
  }

  // 文件名必须拒绝控制字符，范围匹配是这里的业务约束。
  if (
    // eslint-disable-next-line no-control-regex
    /[\\/:*?"<>|\x00-\x1f\x7f]/.test(newBaseName) ||
    /^\.+$/.test(newBaseName.trim())
  ) {
    throw new Error("名称不能包含路径分隔符或非法字符");
  }
  const sanitized = sanitizeFilenameSegment(newBaseName);
  if (!sanitized) {
    throw new Error("文件名不能为空");
  }

  if (page.isFolder) return renameLocalDirectory(set, get, pageId, sanitized);

  const { dir, base, ext } = splitFilePath(page.localFilePath);
  if (sanitized === base) {
    // 名称未变，无需操作
    return pageId;
  }

  if (typeof window === "undefined" || !window.gooseFs) {
    throw new Error("文件系统不可用");
  }

  const fs = window.gooseFs;
  // 与新建页一致：撞名时自动 `名称 (1)` / `名称 (2)`，不抛错打断用户
  const uniqueBase = await allocateUniqueLocalBaseName(
    fs,
    get().pages,
    pageId,
    dir,
    sanitized,
    ext,
    page.localFilePath,
  );
  const nextFilePath = `${dir}/${uniqueBase}${ext}`;
  // 解析后仍与当前基名相同（例如「foo (1)」→「foo」但「foo」已被占，落回自身）
  if (uniqueBase === base) {
    return pageId;
  }

  // 先让编辑器的 800ms 防抖立即提交到 store，再写完已经排队的旧路径内容。
  // 标题输入与编辑器同属同步事件链，dispatch 返回时 updatePage 已完成入队。
  window.dispatchEvent(
    new CustomEvent("goose-note:flush-editor", {
      detail: { immediate: true, pageId },
    }),
  );
  await flushPendingLocalSaveByPageIdInternal(pageId, get);

  // 与所有正文写盘共用页面级串行锁：等待在途的直接保存结束，并阻止后续保存
  // 在 localFilePath 切换前读取旧路径。同页并发 rename 也会自然串行。
  const releaseFileOperation = await acquireLocalPageFileOperation(pageId);
  try {
    if (get().pages[pageId]?.localFilePath !== page.localFilePath) {
      throw new Error("路径已发生变化，请重新重命名");
    }
    const renamed = Boolean(
      await Promise.resolve(fs.rename(page.localFilePath, nextFilePath)),
    );
    if (!renamed) {
      throw new Error("重命名操作未成功");
    }

    // 成功后才登记自移路径；失败时不应误吞接下来 5 秒的真实文件事件。
    markSelfMoved(page.localFilePath.replace(/\\/g, "/"));
    markSelfMoved(nextFilePath.replace(/\\/g, "/"));

    // 磁盘已改名后先同步 store。后面的快照/idMap 属于附属元数据，即使迁移异常，
    // 等待锁的保存也会读取新路径，不会把旧文件重新创建出来。
    set((state) => {
      const current = state.pages[pageId];
      if (!current) return state;
      return {
        pages: {
          ...state.pages,
          [pageId]: { ...current, localFilePath: nextFilePath },
        },
      };
    });

    // 迁移快照 Map：旧路径 → 新路径（保持保存前 diff 有效）
    const { getLocalMdSnapshot, setLocalMdSnapshot, deleteLocalMdSnapshot } =
      await import("@/lib/local-md-snapshot");
    const oldSnapshot = getLocalMdSnapshot(page.localFilePath);
    if (oldSnapshot !== undefined) {
      setLocalMdSnapshot(nextFilePath, oldSnapshot);
      deleteLocalMdSnapshot(page.localFilePath);
    }

    // 稳定 id：更新映射表（旧 relativePath → 新 relativePath，stableId 不变），
    // 然后只更新 page 的 localFilePath 字段，id 保持不变。
    const notebook = useNotebooks.getState().notebooks[page.workspaceId];
    const basePath = notebook?.localPath || "";
    const oldRelativePath = toRelativePath(basePath, page.localFilePath);
    const newRelativePath = toRelativePath(basePath, nextFilePath);
    migrateLocalPageIdMapEntry(
      page.workspaceId,
      oldRelativePath,
      newRelativePath,
      pageId,
    );

    return pageId;
  } catch (error) {
    if (error instanceof Error && error.message === "重命名操作未成功") {
      throw error;
    }
    throw new Error(
      `重命名失败：${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  } finally {
    releaseFileOperation();
  }
}
