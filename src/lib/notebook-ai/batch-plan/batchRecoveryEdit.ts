import type { BatchPlanInput, BatchPlanJournal } from "./types";
import { usePages } from "@/stores/usePages";
import { writeBatchPlanJournal } from "./journal";
import { getPageContentSignature } from "@/lib/notebook-ai/pageWriteGuard";
import {
  sameRevision,
  revisionOf,
  appendRecoveredSuccess,
} from "./batchShared";
import { comparisonPath, basenameWithoutMarkdownExtension } from "./batchPaths";
import {
  plannedContent,
  plannedSearchReplaceContent,
} from "./batchPlannedContent";

export async function recoverEditedOperation(
  operation: Extract<BatchPlanInput["operations"][number], { type: "edit" }>,
  journal: BatchPlanJournal,
): Promise<BatchPlanJournal> {
  const operationId = operation.operationId;

  const page = usePages.getState().pages[operation.pageId];
  const before = journal.before[operation.pageId];
  if (!page || !before)
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: "中断编辑的目标页不存在",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  const plannedLocalPath = journal.plannedLocalPaths[operationId];
  const currentPath = page.localFilePath;
  if (
    sameRevision(revisionOf(page), before.revision) &&
    (!plannedLocalPath ||
      comparisonPath(currentPath ?? "") ===
        comparisonPath(before.page.localFilePath ?? ""))
  )
    return writeBatchPlanJournal({
      ...journal,
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  const expected = getPageContentSignature(plannedContent(operation, journal));
  if (
    getPageContentSignature(page.content) === expected &&
    (!plannedLocalPath ||
      comparisonPath(currentPath ?? "") === comparisonPath(plannedLocalPath))
  ) {
    return appendRecoveredSuccess(
      currentPath
        ? {
            ...journal,
            localPathAfterByPageId: {
              ...journal.localPathAfterByPageId,
              [operation.pageId]: currentPath,
            },
          }
        : journal,
      { operationId, type: "edit", ok: true, pageIds: [operation.pageId] },
      { [operation.pageId]: revisionOf(page) },
    );
  }
  if (
    plannedLocalPath &&
    before.page.localFilePath &&
    sameRevision(revisionOf(page), before.revision) &&
    comparisonPath(currentPath ?? "") === comparisonPath(plannedLocalPath)
  ) {
    try {
      await usePages
        .getState()
        .renameLocalPageFile(
          operation.pageId,
          basenameWithoutMarkdownExtension(before.page.localFilePath),
        );
      return writeBatchPlanJournal({
        ...journal,
        executingOperationId: undefined,
        executingStartedAt: undefined,
      });
    } catch {
      // 继续走失败分支，避免覆盖无法证明状态的本地文件。
    }
  }
  return writeBatchPlanJournal({
    ...journal,
    status: "failed",
    error: "中断编辑后的内容与冻结计划不一致，已停止恢复",
    executingOperationId: undefined,
    executingStartedAt: undefined,
  });
}

export async function recoverSearchReplaceOperation(
  operation: Extract<
    BatchPlanInput["operations"][number],
    { type: "search_replace" }
  >,
  journal: BatchPlanJournal,
): Promise<BatchPlanJournal> {
  const operationId = operation.operationId;

  const page = usePages.getState().pages[operation.pageId];
  const before = journal.before[operation.pageId];
  if (!page || !before)
    return writeBatchPlanJournal({
      ...journal,
      status: "failed",
      error: "中断局部替换的目标页不存在",
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  if (sameRevision(revisionOf(page), before.revision)) {
    return writeBatchPlanJournal({
      ...journal,
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  try {
    const expected = getPageContentSignature(
      plannedSearchReplaceContent(operation, journal),
    );
    if (getPageContentSignature(page.content) === expected) {
      return appendRecoveredSuccess(
        page.localFilePath
          ? {
              ...journal,
              localPathAfterByPageId: {
                ...journal.localPathAfterByPageId,
                [operation.pageId]: page.localFilePath,
              },
            }
          : journal,
        {
          operationId,
          type: "search_replace",
          ok: true,
          pageIds: [operation.pageId],
        },
        { [operation.pageId]: revisionOf(page) },
      );
    }
  } catch {
    // fall through to failed
  }
  return writeBatchPlanJournal({
    ...journal,
    status: "failed",
    error: "中断局部替换后的内容与冻结计划不一致，已停止恢复",
    executingOperationId: undefined,
    executingStartedAt: undefined,
  });
}
