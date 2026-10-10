import type { BatchPlanInput, BatchPlanJournal } from "./types";
import { usePages } from "@/stores/usePages";
import { writeBatchPlanJournal } from "./journal";
import { getPageContentSignature } from "@/lib/notebook-ai/pageWriteGuard";
import { pageAtLocalPath, pathExists } from "./batchPaths";
import { plannedContent } from "./batchPlannedContent";
import { appendRecoveredSuccess, revisionOf } from "./batchShared";

export async function recoverCreatedOperation(
  operation: Extract<BatchPlanInput["operations"][number], { type: "create" }>,
  journal: BatchPlanJournal,
): Promise<BatchPlanJournal> {
  const operationId = operation.operationId;

  const plannedLocalPath = journal.plannedLocalPaths[operationId];
  const plannedPageId = journal.plannedPageIds[operationId];
  const page = plannedLocalPath
    ? pageAtLocalPath(plannedLocalPath)
    : plannedPageId
      ? usePages.getState().pages[plannedPageId]
      : undefined;
  if (!page)
    if (plannedLocalPath && (await pathExists(plannedLocalPath))) {
      return writeBatchPlanJournal({
        ...journal,
        status: "failed",
        error: "中断创建的本地文件已存在但尚未安全载入，已停止恢复",
        executingOperationId: undefined,
        executingStartedAt: undefined,
      });
    }
  if (!page)
    return writeBatchPlanJournal({
      ...journal,
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  const expected = getPageContentSignature(plannedContent(operation, journal));
  if (
    page.workspaceId !== journal.notebookId ||
    getPageContentSignature(page.content) !== expected
  ) {
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: "中断创建页与冻结计划不一致，已停止恢复",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  return appendRecoveredSuccess(
    journal,
    { operationId, type: "create", ok: true, pageIds: [page.id] },
    { [page.id]: revisionOf(page) },
    page.id,
  );
}
