import type { BatchPlanInput, BatchOperationResult } from "./types";
import { writeBatchPlanJournal } from "./journal";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import {
  type BatchOperationExecution,
  type BatchOperationExecutionState,
  revisionOf,
} from "./batchShared";
import { rememberBefore, stageLocalDelete } from "./batchLocalDelete";

export async function executeDeleteOperation(
  operation: Extract<BatchPlanInput["operations"][number], { type: "delete" }>,
  state: BatchOperationExecutionState,
): Promise<BatchOperationExecution> {
  let working = state.working;
  try {
    let result: BatchOperationResult;

    const affectedPageIds =
      working.affectedPageIdsByOperationId[operation.operationId] ??
      operation.pageIds;
    for (const pageId of affectedPageIds) await rememberBefore(pageId, working);
    const localSnapshots = affectedPageIds.flatMap((pageId) => {
      const snapshot = working.before[pageId];
      return snapshot?.page.localFilePath ? [snapshot] : [];
    });
    if (localSnapshots.length > 0) {
      if (localSnapshots.length !== affectedPageIds.length) {
        throw new Error("删除计划不能混合本地文件和内置页面");
      }
      await stageLocalDelete(localSnapshots, working);
      result = {
        operationId: operation.operationId,
        type: operation.type,
        ok: true,
        pageIds: [...affectedPageIds],
      };
      working = writeBatchPlanJournal({
        ...working,
        results: [...working.results, result],
        executingOperationId: undefined,
        executingStartedAt: undefined,
      });
      return { working, result, recorded: true };
    }
    const deletedRootIds: string[] = [];
    const deleteBatchId =
      working.deleteBatchIdsByOperationId[operation.operationId];
    if (!deleteBatchId) throw new Error("冻结计划缺少删除批次标记");
    for (const pageId of operation.pageIds) {
      const deleted = await usePages
        .getState()
        .deletePage(pageId, { trashBatchId: deleteBatchId });
      if (!deleted) {
        const restoreErrors: string[] = [];
        for (const deletedRootId of [...deletedRootIds].reverse()) {
          const restored = usePages.getState().restorePage(deletedRootId);
          if (!restored.ok) restoreErrors.push(deletedRootId);
        }
        throw new Error(
          restoreErrors.length > 0
            ? `删除页面 ${pageId} 失败，且 ${restoreErrors.length} 个已删除页面未能恢复`
            : `删除页面 ${pageId} 失败，已恢复本项此前删除的页面`,
        );
      }
      deletedRootIds.push(pageId);
      for (const affectedPageId of affectedPageIds) {
        const page = usePages.getState().pages[affectedPageId];
        if (page)
          working = {
            ...working,
            after: { ...working.after, [affectedPageId]: revisionOf(page) },
          };
      }
    }
    affectedPageIds.forEach((pageId) =>
      useTabs.getState().removeDeletedPage(pageId),
    );
    result = {
      operationId: operation.operationId,
      type: operation.type,
      ok: true,
      pageIds: [...affectedPageIds],
    };

    return { working, result };
  } finally {
    state.working = working;
  }
}
