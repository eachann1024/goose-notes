import type { BatchPlanJournal } from "@/lib/notebook-ai/batch-plan/types";
import { collapseRepeatedErrorSegments } from "@/lib/notebook-ai/errors";

export type PlanReviewPhase =
  | "preparing"
  | "approval"
  | "executing"
  | "applied"
  | "cancelled"
  | "undone"
  | "conflict"
  | "invalid"
  | "failed";
type ReviewPart = {
  state?: string;
  output?: unknown;
  errorText?: string;
  approval?: { approved?: boolean };
};
export function reviewOutput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function isPlanConflict(error: string): boolean {
  return /页面内容已发生变化|审批后发生变化|已被修改|已变化|拒绝覆盖|路径.*变化|已被占用|已不存在|已被删除|页面.*不存在|笔记本.*不存在/.test(
    error,
  );
}
export function planReviewState(
  part: ReviewPart,
  journal?: BatchPlanJournal | null,
) {
  const output = reviewOutput(part.output);
  const status = journal?.status ?? output.status;
  const error = collapseRepeatedErrorSegments(
    String(part.errorText || journal?.error || output.error || ""),
  );
  let phase: PlanReviewPhase = "preparing";
  if (
    part.state === "output-denied" ||
    (part.state === "approval-responded" && part.approval?.approved === false)
  )
    phase = "cancelled";
  else if (status === "undone") phase = "undone";
  else if (status === "undo-conflicted") phase = "conflict";
  else if (status === "invalid") phase = "invalid";
  else if (
    part.state === "output-error" ||
    part.errorText ||
    status === "failed" ||
    output.ok === false
  )
    phase = isPlanConflict(error) ? "conflict" : "failed";
  else if (part.state === "approval-responded" || status === "executing")
    phase = "executing";
  else if (
    part.state === "approval-requested" ||
    (status === "prepared" && output.needsApproval === true)
  )
    phase = "approval";
  else if (
    status === "completed" ||
    (part.state === "output-available" && output.ok === true)
  )
    phase = "applied";
  const selectedCount =
    journal?.selectedOperationIds.length ??
    (typeof output.selectedCount === "number"
      ? output.selectedCount
      : undefined);
  const appliedCount =
    phase === "applied"
      ? (journal?.results.filter((result) => result.ok).length ??
        (typeof output.appliedCount === "number"
          ? output.appliedCount
          : undefined))
      : 0;
  const label: Record<PlanReviewPhase, string> = {
    preparing: "正在生成方案",
    approval: "等待确认",
    executing: "正在应用",
    applied: "已应用",
    cancelled: "已取消",
    undone: "已撤回",
    conflict: status === "undo-conflicted" ? "撤回冲突" : "原文冲突",
    invalid: "方案无效",
    failed: "执行未完成",
  };
  const rollback = journal?.rollbackStatus ?? output.rollbackStatus;
  const detail =
    phase === "approval"
      ? "方案已生成，尚未修改笔记。"
      : phase === "executing"
        ? "正在应用已选操作，请稍候。"
        : phase === "applied"
          ? `已应用${appliedCount === undefined ? "所选" : ` ${appliedCount} 项`}操作。`
          : phase === "cancelled"
            ? "本方案未执行，笔记未修改。"
            : phase === "undone"
              ? "本次变更已撤回。"
              : phase === "conflict"
                ? status === "undo-conflicted"
                  ? "笔记在应用后发生变化，未覆盖后续编辑。"
                  : "原文或目标位置已变化，请基于当前笔记重新生成方案。"
                : phase === "invalid"
                  ? "方案无法执行，尚未写入笔记。"
                  : phase === "failed"
                    ? rollback === "complete"
                      ? "执行未完成，已恢复此前成功的操作。"
                      : rollback === "incomplete"
                        ? "执行未完成，部分操作未能恢复，请检查目标笔记。"
                        : "执行未完成，请检查目标笔记后调整方案。"
                    : "正在整理变更内容。";
  return {
    phase,
    label: label[phase],
    detail,
    error,
    selectedCount,
    appliedCount,
    rollback,
  };
}
