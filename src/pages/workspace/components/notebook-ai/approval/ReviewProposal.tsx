import { usePages } from "@/stores/usePages";
import { usePlanReviewSelection } from "./PlanReviewContext";
import { planReviewState, reviewOutput } from "./reviewState";
import { readReviewPlan } from "./planReviewData";
import { ReviewOperation } from "./ReviewOperation";
import "./plan-review.css";

export function ReviewProposal({
  part,
}: {
  part: {
    input?: unknown;
    output?: unknown;
    state?: string;
    toolCallId?: string;
    errorText?: string;
    approval?: { approved?: boolean };
  };
}) {
  // 页面标题、路径与可导航状态跟随目标笔记的变化。
  usePages((state) => state.pages);
  const { input, journal } = readReviewPlan(part);
  const operations = input?.operations ?? [];
  const key = `${part.toolCallId ?? ""}:${input?.runId ?? ""}`;
  const { selectedIds, setSelectedIds, locked } = usePlanReviewSelection(
    key,
    operations.map((op) => op.operationId),
    journal?.selectedOperationIds,
  );
  const review = planReviewState(part, journal);
  const output = reviewOutput(part.output);
  const results =
    journal?.results ??
    (Array.isArray(output.results)
      ? (output.results as { operationId: string; ok: boolean }[])
      : []);
  const canSelect = review.phase === "approval" && !locked;
  if (!input) return null;
  const resultLabel = (id: string) => {
    if (review.phase === "approval" || review.phase === "preparing")
      return undefined;
    if (review.phase === "cancelled") return "未执行";
    const included =
      journal?.selectedOperationIds.includes(id) ??
      results.some((result) => result.operationId === id);
    if (!included && results.length) return "已跳过";
    const result = results.find((item) => item.operationId === id);
    if (!result) return review.phase === "executing" ? "等待执行" : "未执行";
    if (!result.ok) return "失败";
    if (review.phase === "undone") return "已撤回";
    if (review.phase === "failed" || review.phase === "conflict")
      return review.rollback === "complete" ? "已恢复" : "请检查";
    return "已应用";
  };
  return (
    <div className="notebook-ai-work-proposal">
      <h4>{input.summary.trim() || input.title}</h4>
      {canSelect ? (
        <div className="notebook-ai-review-selection">
          <span>
            已选 {selectedIds.length} / {operations.length} 项，未选项将跳过
          </span>
          <button
            type="button"
            onClick={() =>
              setSelectedIds(
                selectedIds.length === operations.length
                  ? []
                  : operations.map((op) => op.operationId),
              )
            }
          >
            {selectedIds.length === operations.length ? "取消全选" : "全选"}
          </button>
        </div>
      ) : null}
      {operations.map((operation) => (
        <ReviewOperation
          key={operation.operationId}
          operation={operation}
          journal={journal}
          canSelect={canSelect}
          selected={selectedIds.includes(operation.operationId)}
          onSelect={() =>
            setSelectedIds(
              selectedIds.includes(operation.operationId)
                ? selectedIds.filter((id) => id !== operation.operationId)
                : [...selectedIds, operation.operationId],
            )
          }
          resultLabel={resultLabel(operation.operationId)}
        />
      ))}
    </div>
  );
}
