import type {
  BatchPlanInput,
  BatchPlanPrepareResult,
  FrozenPageSnapshot,
  BatchPlanJournal,
} from "./types";
import { readBatchPlanJournal, writeBatchPlanJournal } from "./journal";
import {
  guardNotebookForAiWrite,
  guardPageForAiWrite,
} from "@/lib/notebook-ai/pageWriteGuard";
import { useNotebooks } from "@/stores/useNotebooks";
import { v4 as uuidv4 } from "uuid";
import { usePages } from "@/stores/usePages";
import {
  validateInput,
  invalidJournal,
  convertPartialEditsInPlan,
  expandDeletePageIds,
} from "./batchValidation";
import { makeLocalPlanPaths } from "./batchLocalPlanPaths";
import { clone } from "./batchShared";

export async function prepareBatchPlan(params: {
  toolCallId: string;
  runId: string;
  notebookId: string;
  input: BatchPlanInput;
}): Promise<BatchPlanPrepareResult> {
  const existing = readBatchPlanJournal(params.toolCallId, params.runId);
  if (existing)
    return existing.status === "invalid"
      ? { ok: false, error: existing.error || "计划无效", journal: existing }
      : { ok: true, journal: existing };
  const inputError = validateInput(params.input);
  const notebookGuard = guardNotebookForAiWrite(params.notebookId);
  if (inputError || !notebookGuard.ok) {
    const error =
      inputError ??
      (!notebookGuard.ok ? notebookGuard.error : "目标笔记本不可写入");
    const journal = writeBatchPlanJournal(
      invalidJournal(
        params.toolCallId,
        params.runId,
        params.notebookId,
        params.input,
        error,
      ),
    );
    return { ok: false, error: journal.error!, journal };
  }

  // 局部 edit → search_replace；后续冻结/路径规划均使用转换后的计划
  const planInput = convertPartialEditsInPlan(params.input, params.notebookId);

  const before: Record<string, FrozenPageSnapshot> = {};
  const affectedPageIdsByOperationId: Record<string, string[]> = {};
  let localPlanPaths: Awaited<ReturnType<typeof makeLocalPlanPaths>>;
  try {
    localPlanPaths = await makeLocalPlanPaths(params.notebookId, planInput);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "本地文件计划准备失败";
    const journal = writeBatchPlanJournal(
      invalidJournal(
        params.toolCallId,
        params.runId,
        params.notebookId,
        planInput,
        message,
      ),
    );
    return { ok: false, error: message, journal };
  }
  const deleteBatchIdsByOperationId: Record<string, string> = {
    ...localPlanPaths.deleteBatchIdsByOperationId,
  };
  const plannedPageIds: Record<string, string> = {};
  const operationOwnerByPageId = new Map<string, string>();
  for (const operation of planInput.operations) {
    if (
      operation.type === "create" &&
      useNotebooks.getState().notebooks[params.notebookId]?.source !==
        "local-folder"
    )
      plannedPageIds[operation.operationId] = uuidv4();
    if (operation.type === "create" && operation.parentId) {
      const parent = usePages.getState().pages[operation.parentId];
      if (
        !parent ||
        parent.workspaceId !== params.notebookId ||
        Boolean(parent.trashedAt)
      ) {
        const message = "新页面的父级不存在、已在垃圾箱中或不属于当前笔记本";
        const journal = writeBatchPlanJournal(
          invalidJournal(
            params.toolCallId,
            params.runId,
            params.notebookId,
            planInput,
            message,
          ),
        );
        return { ok: false, error: message, journal };
      }
    }
    if (operation.type === "delete") {
      const requestedIds = new Set(operation.pageIds);
      for (const pageId of operation.pageIds) {
        const page = usePages.getState().pages[pageId];
        if (
          !page ||
          page.workspaceId !== params.notebookId ||
          Boolean(page.trashedAt)
        ) {
          const message = "删除目标不存在、已在垃圾箱中或不属于当前笔记本";
          const journal = writeBatchPlanJournal(
            invalidJournal(
              params.toolCallId,
              params.runId,
              params.notebookId,
              planInput,
              message,
            ),
          );
          return { ok: false, error: message, journal };
        }
        let parentId = page.parentId;
        while (parentId) {
          if (requestedIds.has(parentId)) {
            const message = "删除目标包含重复的父子页面，请只保留父页面";
            const journal = writeBatchPlanJournal(
              invalidJournal(
                params.toolCallId,
                params.runId,
                params.notebookId,
                planInput,
                message,
              ),
            );
            return { ok: false, error: message, journal };
          }
          parentId = usePages.getState().pages[parentId]?.parentId;
        }
      }
    }
    const pageIds =
      operation.type === "edit" || operation.type === "search_replace"
        ? [operation.pageId]
        : operation.type === "delete"
          ? expandDeletePageIds(params.notebookId, operation.pageIds)
          : [];
    if (operation.type === "delete")
      affectedPageIdsByOperationId[operation.operationId] = pageIds;
    if (
      operation.type === "delete" &&
      !deleteBatchIdsByOperationId[operation.operationId]
    )
      deleteBatchIdsByOperationId[operation.operationId] =
        `ai-batch-${params.runId}-${uuidv4()}`;
    for (const pageId of pageIds) {
      const owner = operationOwnerByPageId.get(pageId);
      // 允许多个 search_replace 串联同一页；edit/delete 仍互斥。
      const allowSharedSearchReplace =
        operation.type === "search_replace" &&
        owner?.startsWith("search_replace:");
      if (
        owner &&
        owner !== operation.operationId &&
        !allowSharedSearchReplace
      ) {
        const message = "编辑或删除操作的目标页面树发生重叠";
        const journal = writeBatchPlanJournal(
          invalidJournal(
            params.toolCallId,
            params.runId,
            params.notebookId,
            planInput,
            message,
          ),
        );
        return { ok: false, error: message, journal };
      }
      operationOwnerByPageId.set(
        pageId,
        operation.type === "search_replace"
          ? `search_replace:${operation.operationId}`
          : operation.operationId,
      );
      const guard = guardPageForAiWrite(pageId, {
        expectedNotebookId: params.notebookId,
      });
      if (!guard.ok) {
        const journal = writeBatchPlanJournal(
          invalidJournal(
            params.toolCallId,
            params.runId,
            params.notebookId,
            planInput,
            guard.error,
          ),
        );
        return { ok: false, error: guard.error, journal };
      }
      before[pageId] = {
        pageId,
        page: clone(guard.page),
        revision: {
          updatedAt: guard.updatedAt,
          contentSignature: guard.contentSignature,
        },
      };
    }
  }
  const now = Date.now();
  const journal: BatchPlanJournal = {
    version: 1,
    toolCallId: params.toolCallId,
    runId: params.runId,
    notebookId: params.notebookId,
    input: clone(planInput),
    selectedOperationIds: planInput.operations.map(
      (operation) => operation.operationId,
    ),
    status: "prepared",
    before,
    affectedPageIdsByOperationId,
    deleteBatchIdsByOperationId,
    plannedPageIds,
    plannedLocalPaths: localPlanPaths.plannedLocalPaths,
    localPathAfterByPageId: {},
    localTrashPathsByPageId: localPlanPaths.localTrashPathsByPageId,
    after: {},
    createdPageIds: {},
    results: [],
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, journal: writeBatchPlanJournal(journal) };
}
