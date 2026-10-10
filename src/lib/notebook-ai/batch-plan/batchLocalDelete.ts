import type { BatchPlanJournal, FrozenPageSnapshot } from "./types";
import { recordHistorySnapshot } from "@/lib/history/snapshot";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { clone } from "./batchShared";
import { dirname, pathExists } from "./batchPaths";

export async function rememberBefore(
  pageId: string,
  journal: BatchPlanJournal,
) {
  const snapshot = journal.before[pageId];
  if (!snapshot) return;
  await recordHistorySnapshot({
    pageId,
    workspaceId: journal.notebookId,
    content: clone(snapshot.page.content),
    trigger: "pre-op",
    isMilestone: true,
    label: `AI 批量计划 ${journal.input.title} 前`,
  });
}

export async function renameLocalPath(
  oldPath: string,
  newPath: string,
): Promise<void> {
  const fs = typeof window !== "undefined" ? window.gooseFs : undefined;
  if (!fs) throw new Error("本地文件系统不可用");
  const created = await Promise.resolve(fs.mkdir(dirname(newPath)));
  if (!created) throw new Error("无法创建本地文件暂存目录");
  const renamed = await Promise.resolve(fs.rename(oldPath, newPath));
  if (!renamed) throw new Error("本地文件移动失败");
}

export function removeLocalSnapshotsFromStore(
  snapshots: FrozenPageSnapshot[],
): void {
  const ids = new Set(snapshots.map((snapshot) => snapshot.pageId));
  usePages.setState((state) => {
    const pages = { ...state.pages };
    const dirtyLocalPageIds = { ...state.dirtyLocalPageIds };
    ids.forEach((pageId) => {
      delete pages[pageId];
      delete dirtyLocalPageIds[pageId];
    });
    return {
      pages,
      dirtyLocalPageIds,
      activePageId:
        state.activePageId && ids.has(state.activePageId)
          ? null
          : state.activePageId,
    };
  });
  ids.forEach((pageId) => useTabs.getState().removeDeletedPage(pageId));
}

export function restoreLocalSnapshotsToStore(
  snapshots: FrozenPageSnapshot[],
): void {
  usePages.setState((state) => ({
    pages: {
      ...state.pages,
      ...Object.fromEntries(
        snapshots.map((snapshot) => [snapshot.pageId, clone(snapshot.page)]),
      ),
    },
  }));
}

export async function stageLocalDelete(
  snapshots: FrozenPageSnapshot[],
  journal: BatchPlanJournal,
): Promise<void> {
  const staged: FrozenPageSnapshot[] = [];
  try {
    for (const snapshot of snapshots) {
      const originalPath = snapshot.page.localFilePath;
      const trashPath = journal.localTrashPathsByPageId[snapshot.pageId];
      if (!originalPath || !trashPath) {
        throw new Error("本地删除计划缺少可恢复路径");
      }
      await renameLocalPath(originalPath, trashPath);
      staged.push(snapshot);
    }
    removeLocalSnapshotsFromStore(snapshots);
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const snapshot of [...staged].reverse()) {
      const originalPath = snapshot.page.localFilePath!;
      const trashPath = journal.localTrashPathsByPageId[snapshot.pageId];
      try {
        await renameLocalPath(trashPath, originalPath);
      } catch {
        rollbackErrors.push(originalPath);
      }
    }
    throw new Error(
      rollbackErrors.length
        ? `本地删除失败，且 ${rollbackErrors.length} 个文件未能恢复`
        : error instanceof Error
          ? error.message
          : "本地删除失败",
      { cause: error },
    );
  }
}

export async function restoreLocalDelete(
  snapshots: FrozenPageSnapshot[],
  journal: BatchPlanJournal,
): Promise<string[]> {
  const errors: string[] = [];
  const restored: FrozenPageSnapshot[] = [];
  for (const snapshot of snapshots) {
    const originalPath = snapshot.page.localFilePath;
    const trashPath = journal.localTrashPathsByPageId[snapshot.pageId];
    if (!originalPath || !trashPath) {
      errors.push(`页面 ${snapshot.pageId} 缺少本地恢复路径`);
      continue;
    }
    if (await pathExists(originalPath)) {
      errors.push(`原路径 ${originalPath} 已被占用`);
      continue;
    }
    if (!(await pathExists(trashPath))) {
      errors.push(`暂存文件 ${trashPath} 不存在`);
      continue;
    }
    try {
      await renameLocalPath(trashPath, originalPath);
      restored.push(snapshot);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : `无法恢复 ${originalPath}`,
      );
    }
  }
  if (restored.length) restoreLocalSnapshotsToStore(restored);
  return errors;
}
