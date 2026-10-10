import type { StoreSet, StoreGet } from "../../hydrate";
import { useNotebooks } from "../../../../useNotebooks";
import {
  flushPendingLocalSaveByPageIdInternal,
  acquireLocalPageFileOperation,
} from "../../../folderSync";
import { markSelfMoved } from "../move";
import {
  migrateLocalPageIdMapEntry,
  toRelativePath,
} from "@/lib/local-page-idmap";

export async function renameLocalDirectory(
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  name: string,
): Promise<string> {
  const page = get().pages[pageId];
  const fs = window.gooseFs;
  const basePath =
    useNotebooks.getState().notebooks[page.workspaceId]?.localPath;
  if (!fs || !basePath || !page.localFilePath)
    throw new Error("文件系统不可用");
  const oldPath = page.localFilePath.replace(/\\/g, "/");
  const nextPath = oldPath.slice(0, oldPath.lastIndexOf("/") + 1) + name;
  if (oldPath === nextPath) return pageId;
  const affected = Object.values(get().pages)
    .filter(
      (p) =>
        p.workspaceId === page.workspaceId &&
        p.localFilePath &&
        (p.localFilePath.replace(/\\/g, "/") === oldPath ||
          p.localFilePath.replace(/\\/g, "/").startsWith(oldPath + "/")),
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  // 先提交编辑器和子文件防抖，再锁住写盘；后续保存只能读到改名后的路径。
  window.dispatchEvent(
    new CustomEvent("goose-note:flush-editor", {
      detail: { immediate: true },
    }),
  );
  for (const p of affected) {
    if (!p.isFolder) await flushPendingLocalSaveByPageIdInternal(p.id, get);
  }
  const releases: Array<() => void> = [];
  try {
    for (const p of affected)
      releases.push(await acquireLocalPageFileOperation(p.id));
    if (
      affected.some((p) => get().pages[p.id]?.localFilePath !== p.localFilePath)
    ) {
      throw new Error("路径已发生变化，请重新重命名");
    }
    const exists = fs.existsAsync
      ? await fs.existsAsync(nextPath)
      : await fs.exists(nextPath);
    if (exists) throw new Error("重命名失败：目标名称已存在");
    if (!(await fs.rename(page.localFilePath, nextPath)))
      throw new Error("重命名操作未成功");
    markSelfMoved(oldPath);
    markSelfMoved(nextPath);
    // 磁盘成功后先更新全部路径，保持页面 ID、收藏、标签页与手动顺序不变。
    set((state) => {
      const pages = { ...state.pages };
      for (const p of affected) {
        if (!pages[p.id]) continue;
        pages[p.id] = {
          ...pages[p.id],
          localFilePath:
            nextPath +
            p.localFilePath!.replace(/\\/g, "/").slice(oldPath.length),
        };
      }
      return { pages };
    });
    const { getLocalMdSnapshot, setLocalMdSnapshot, deleteLocalMdSnapshot } =
      await import("@/lib/local-md-snapshot");
    for (const p of affected) {
      const previous = p.localFilePath!;
      const next =
        nextPath + previous.replace(/\\/g, "/").slice(oldPath.length);
      const snapshot = getLocalMdSnapshot(previous);
      if (snapshot !== undefined) {
        setLocalMdSnapshot(next, snapshot);
        deleteLocalMdSnapshot(previous);
      }
      migrateLocalPageIdMapEntry(
        page.workspaceId,
        toRelativePath(basePath, previous),
        toRelativePath(basePath, next),
        p.id,
      );
    }
    return pageId;
  } finally {
    releases.reverse().forEach((release) => release());
  }
}
