import type { BatchPlanInput, BatchOperationResult } from "./types";
import { usePages } from "@/stores/usePages";
import { writePageContentSafely } from "@/lib/notebook-ai/pageWriteGuard";
import { reloadEditorIfActive } from "@/lib/notebook-ai/liveWriter";
import {
  type BatchOperationExecution,
  type BatchOperationExecutionState,
  revisionOf,
  pendingOperations,
} from "./batchShared";
import { rememberBefore } from "./batchLocalDelete";
import { comparisonPath, basenameWithoutMarkdownExtension } from "./batchPaths";
import { plannedContent } from "./batchPlannedContent";
import { writeSearchReplaceFromLatest } from "./batchSearchReplaceWrite";

export async function executeEditOperation(
  operation: Extract<BatchPlanInput["operations"][number], { type: "edit" }>,
  state: BatchOperationExecutionState,
): Promise<BatchOperationExecution> {
  let working = state.working;
  try {
    let result: BatchOperationResult;

    await rememberBefore(operation.pageId, working);
    const before = working.before[operation.pageId];
    const originalPath = before.page.localFilePath;
    const plannedLocalPath = working.plannedLocalPaths[operation.operationId];
    let renamed = false;
    if (
      originalPath &&
      plannedLocalPath &&
      comparisonPath(originalPath) !== comparisonPath(plannedLocalPath)
    ) {
      const renamedPageId = await usePages
        .getState()
        .renameLocalPageFile(
          operation.pageId,
          basenameWithoutMarkdownExtension(plannedLocalPath),
        );
      const actualPath =
        usePages.getState().pages[renamedPageId]?.localFilePath;
      if (
        !actualPath ||
        comparisonPath(actualPath) !== comparisonPath(plannedLocalPath)
      ) {
        if (actualPath && originalPath) {
          try {
            await usePages
              .getState()
              .renameLocalPageFile(
                operation.pageId,
                basenameWithoutMarkdownExtension(originalPath),
              );
          } catch {
            // 保留失败现场，由执行日志提示人工恢复。
          }
        }
        throw new Error("本地文件重命名结果与审批计划不一致");
      }
      renamed = true;
    }
    const saved = await writePageContentSafely(
      operation.pageId,
      plannedContent(operation, working),
      {
        expectedNotebookId: working.notebookId,
        expectedRevision: before.revision,
      },
    );
    if (!saved.ok) {
      if (renamed && originalPath) {
        await usePages
          .getState()
          .renameLocalPageFile(
            operation.pageId,
            basenameWithoutMarkdownExtension(originalPath),
          );
      }
      throw new Error(saved.error);
    }
    const page = usePages.getState().pages[operation.pageId]!;
    working = {
      ...working,
      after: { ...working.after, [operation.pageId]: revisionOf(page) },
      localPathAfterByPageId: page.localFilePath
        ? {
            ...working.localPathAfterByPageId,
            [operation.pageId]: page.localFilePath,
          }
        : working.localPathAfterByPageId,
    };
    reloadEditorIfActive(operation.pageId);
    result = {
      operationId: operation.operationId,
      type: operation.type,
      ok: true,
      pageIds: [operation.pageId],
    };

    return { working, result };
  } finally {
    state.working = working;
  }
}

export async function executeSearchReplaceOperation(
  operation: Extract<
    BatchPlanInput["operations"][number],
    { type: "search_replace" }
  >,
  state: BatchOperationExecutionState,
): Promise<BatchOperationExecution> {
  let working = state.working;
  try {
    let result: BatchOperationResult;

    await rememberBefore(operation.pageId, working);
    await writeSearchReplaceFromLatest(operation, working);
    const page = usePages.getState().pages[operation.pageId]!;
    working = {
      ...working,
      after: { ...working.after, [operation.pageId]: revisionOf(page) },
      localPathAfterByPageId: page.localFilePath
        ? {
            ...working.localPathAfterByPageId,
            [operation.pageId]: page.localFilePath,
          }
        : working.localPathAfterByPageId,
    };
    const nextSamePage = pendingOperations(working).some(
      (candidate) =>
        candidate.operationId !== operation.operationId &&
        candidate.type === "search_replace" &&
        candidate.pageId === operation.pageId &&
        !working.results.some(
          (item) => item.operationId === candidate.operationId && item.ok,
        ),
    );
    // 同页后续项还要写：先不刷新编辑器，避免中间修订把后面的项卡死。
    if (!nextSamePage) reloadEditorIfActive(operation.pageId);
    result = {
      operationId: operation.operationId,
      type: operation.type,
      ok: true,
      pageIds: [operation.pageId],
    };

    return { working, result };
  } finally {
    state.working = working;
  }
}
