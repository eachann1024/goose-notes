import type { BatchPlanExecuteResult } from "./types";

/** 失败后的成功记录可能已经补偿；只有完成的批次能报告当前已应用数量。 */
export function batchExecutionSummary(result: BatchPlanExecuteResult) {
  return {
    appliedCount: result.ok
      ? result.results.filter((item) => item.ok).length
      : undefined,
    rollbackStatus: result.journal.rollbackStatus,
  };
}
