import type { BatchPlanInput, BatchOperationResult } from "./types";
import { usePages } from "@/stores/usePages";
import {
  type BatchOperationExecution,
  type BatchOperationExecutionState,
  revisionOf,
} from "./batchShared";
import { plannedContent } from "./batchPlannedContent";
import { comparisonPath } from "./batchPaths";

export async function executeCreateOperation(
  operation: Extract<BatchPlanInput["operations"][number], { type: "create" }>,
  state: BatchOperationExecutionState,
): Promise<BatchOperationExecution> {
  let working = state.working;
  try {
    let result: BatchOperationResult;

    const content = plannedContent(operation, working);
    const plannedLocalPath = working.plannedLocalPaths[operation.operationId];
    let pageId: string;
    if (plannedLocalPath) {
      const created = await usePages.getState().createLocalPageRecord({
        workspaceId: working.notebookId,
        parentId: operation.parentId,
        title: operation.title,
        content,
        filePath: plannedLocalPath,
      });
      if (!created) throw new Error("创建本地文件页面失败");
      pageId = created;
      const actualPath = usePages.getState().pages[pageId]?.localFilePath;
      if (
        !actualPath ||
        comparisonPath(actualPath) !== comparisonPath(plannedLocalPath)
      ) {
        await usePages.getState().deletePage(pageId);
        throw new Error("本地新建目标在执行时发生变化，已取消创建");
      }
    } else {
      pageId = working.plannedPageIds[operation.operationId];
      if (!pageId) throw new Error("冻结计划缺少预分配页面 ID");
      if (usePages.getState().pages[pageId]) {
        throw new Error("预分配页面 ID 已存在，拒绝重复创建");
      }
      const created = usePages.getState().createPageRecord({
        id: pageId,
        workspaceId: working.notebookId,
        parentId: operation.parentId,
        content,
      });
      if (created !== pageId) throw new Error("创建页面返回了非预分配 ID");
    }
    const page = usePages.getState().pages[pageId];
    if (!page) throw new Error("创建页面后未找到页面");
    working = {
      ...working,
      createdPageIds: {
        ...working.createdPageIds,
        [operation.operationId]: pageId,
      },
      after: { ...working.after, [pageId]: revisionOf(page) },
    };
    result = {
      operationId: operation.operationId,
      type: operation.type,
      ok: true,
      pageIds: [pageId],
    };

    return { working, result };
  } finally {
    state.working = working;
  }
}
