import type { BatchPlanInput, BatchPlanJournal } from "./types";
import { writeBatchPlanJournal } from "./journal";
import { usePages } from "@/stores/usePages";
import { pathExists } from "./batchPaths";
import {
  removeLocalSnapshotsFromStore,
  restoreLocalDelete,
} from "./batchLocalDelete";
import {
  appendRecoveredSuccess,
  revisionOf,
  sameRevision,
} from "./batchShared";

export async function recoverDeletedOperation(
  operation: Extract<BatchPlanInput["operations"][number], { type: "delete" }>,
  journal: BatchPlanJournal,
): Promise<BatchPlanJournal> {
  const operationId = operation.operationId;

  const affected =
    journal.affectedPageIdsByOperationId[operationId] ?? operation.pageIds;
  const localSnapshots = affected.flatMap((pageId) => {
    const snapshot = journal.before[pageId];
    return snapshot?.page.localFilePath ? [snapshot] : [];
  });
  if (localSnapshots.length > 0) {
    const allStaged = (
      await Promise.all(
        localSnapshots.map(async (snapshot) => {
          const originalPath = snapshot.page.localFilePath!;
          const trashPath = journal.localTrashPathsByPageId[snapshot.pageId];
          return (
            Boolean(trashPath) &&
            !(await pathExists(originalPath)) &&
            (await pathExists(trashPath))
          );
        }),
      )
    ).every(Boolean);
    if (allStaged) {
      removeLocalSnapshotsFromStore(localSnapshots);
      return appendRecoveredSuccess(
        journal,
        { operationId, type: "delete", ok: true, pageIds: affected },
        {},
      );
    }
    const allBefore = (
      await Promise.all(
        localSnapshots.map(async (snapshot) => {
          const trashPath = journal.localTrashPathsByPageId[snapshot.pageId];
          return (
            (await pathExists(snapshot.page.localFilePath!)) &&
            (!trashPath || !(await pathExists(trashPath)))
          );
        }),
      )
    ).every(Boolean);
    if (allBefore) {
      return writeBatchPlanJournal({
        ...journal,
        executingOperationId: undefined,
        executingStartedAt: undefined,
      });
    }
    const restoreErrors = await restoreLocalDelete(localSnapshots, journal);
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: restoreErrors.length
        ? `本地删除中断，且 ${restoreErrors.length} 个文件未能恢复`
        : "本地删除中断，已恢复暂存文件",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  const pages = usePages.getState().pages;
  const deleteBatchId = journal.deleteBatchIdsByOperationId[operationId];
  if (!deleteBatchId) {
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: "中断删除缺少可验证的批次标记",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  const allDeleted = affected.every((pageId) => {
    const page = pages[pageId];
    return !!page?.trashedAt && page.trashBatchId === deleteBatchId;
  });
  if (allDeleted) {
    return appendRecoveredSuccess(
      journal,
      { operationId, type: "delete", ok: true, pageIds: affected },
      Object.fromEntries(
        affected.map((pageId) => [pageId, revisionOf(pages[pageId]!)]),
      ),
    );
  }
  const allBefore = affected.every((pageId) => {
    const page = pages[pageId];
    const before = journal.before[pageId];
    return (
      !!page && !!before && sameRevision(revisionOf(page), before.revision)
    );
  });
  if (allBefore)
    return writeBatchPlanJournal({
      ...journal,
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  for (const rootId of operation.pageIds) {
    const page = usePages.getState().pages[rootId];
    if (page?.trashedAt && page.trashBatchId === deleteBatchId) {
      usePages.getState().restorePage(rootId);
    }
  }
  return writeBatchPlanJournal({
    ...journal,
    status: "failed",
    error: "删除操作在中断时只完成了一部分，已尝试恢复已删除根页面",
    executingOperationId: undefined,
    executingStartedAt: undefined,
  });
}
