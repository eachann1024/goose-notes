import type {
  BatchPlanJournal,
  BatchPlanExecuteResult,
  BatchOperationResult,
} from "./types";
import { writeBatchPlanJournal } from "./journal";
import { formatBatchPlanErrors } from "@/lib/notebook-ai/errors";
import { recoverInterruptedOperation } from "./batchRecovery";
import { preflight } from "./batchPreflight";
import { pendingOperations } from "./batchShared";
import { executeOperation } from "./batchExecuteOperation";
import { compensate } from "./batchCompensate";

export async function run(
  journal: BatchPlanJournal,
): Promise<BatchPlanExecuteResult> {
  if (journal.status === "completed")
    return { ok: true, journal, results: journal.results };
  if (journal.status === "invalid")
    return {
      ok: false,
      journal,
      error: journal.error || "计划无效",
      results: journal.results,
    };
  if (journal.selectedOperationIds.length === 0) {
    const invalid = writeBatchPlanJournal({
      ...journal,
      status: "invalid",
      error: "至少选择一项操作后才能执行",
    });
    return {
      ok: false,
      journal: invalid,
      error: invalid.error!,
      results: invalid.results,
    };
  }
  const recovered = await recoverInterruptedOperation(journal);
  if (recovered.status === "failed") {
    return {
      ok: false,
      journal: recovered,
      error: recovered.error || "中断恢复失败",
      results: recovered.results,
    };
  }
  const conflict = await preflight(recovered);
  if (conflict) {
    const failed = writeBatchPlanJournal({
      ...recovered,
      status: "failed",
      error: conflict,
    });
    return {
      ok: false,
      journal: failed,
      error: conflict,
      results: failed.results,
    };
  }
  let working = writeBatchPlanJournal({
    ...recovered,
    status: "executing",
    error: undefined,
  });
  for (const operation of pendingOperations(working)) {
    // 每项真正写入前先持久化 intent；崩溃后不会把“未开始”误报成成功。
    working = writeBatchPlanJournal({
      ...working,
      executingOperationId: operation.operationId,
      executingStartedAt: Date.now(),
    });
    let result: BatchOperationResult;
    const executionState = { working };
    try {
      const execution = await executeOperation(operation, executionState);
      working = execution.working;
      result = execution.result;
      if (execution.recorded) continue;
    } catch (error) {
      working = executionState.working;
      result = {
        operationId: operation.operationId,
        type: operation.type,
        ok: false,
        pageIds:
          operation.type === "delete"
            ? operation.pageIds
            : operation.type === "edit" || operation.type === "search_replace"
              ? [operation.pageId]
              : [],
        error: error instanceof Error ? error.message : "执行失败",
      };
      working = writeBatchPlanJournal({
        ...working,
        results: [...working.results, result],
        status: "failed",
        error: result.error,
        executingOperationId: undefined,
        executingStartedAt: undefined,
      });
      const compensationErrors = await compensate(working);
      working = writeBatchPlanJournal({
        ...working,
        rollbackStatus:
          compensationErrors.length > 0 ? "incomplete" : "complete",
      });
      if (compensationErrors.length > 0) {
        working = writeBatchPlanJournal({
          ...working,
          error: formatBatchPlanErrors([
            result.error ?? "",
            ...compensationErrors,
          ]),
        });
      }
      return {
        ok: false,
        journal: working,
        error: working.error!,
        results: working.results,
      };
    }
    working = writeBatchPlanJournal({
      ...working,
      results: [...working.results, result],
      executingOperationId: undefined,
      executingStartedAt: undefined,
    });
  }
  working = writeBatchPlanJournal({ ...working, status: "completed" });
  return { ok: true, journal: working, results: working.results };
}
