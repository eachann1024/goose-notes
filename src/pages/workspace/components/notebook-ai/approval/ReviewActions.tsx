import { useRef, useState } from "react";
import { Loader2, RotateCcw } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useNotebooks } from "@/stores/useNotebooks";
import { formatNotebookAiError } from "@/lib/notebook-ai/errors";
import { ApprovalCard } from "../beautiful-ui/ApprovalCard";
import {
  useEmbeddedWorkCardStatus,
  type WorkCardStatusData,
} from "../workCardStatusContext";
import type { ApprovalPlanCardProps, BatchUndoResult } from "./types";
import { readReviewPlan } from "./planReviewData";
import { usePlanReviewSelection } from "./PlanReviewContext";
import { planReviewState, reviewOutput } from "./reviewState";
import { requestPlanRefinement } from "./refinePlan";
import "./plan-review.css";

export function ReviewActions({
  part,
  onApprovalResponse,
  onUndo,
  embedded = false,
}: ApprovalPlanCardProps) {
  const { input, journal } = readReviewPlan(part);
  const output = reviewOutput(part.output);
  const operationIds =
    input?.operations.map((operation) => operation.operationId) ?? [];
  const { selectedIds, setLocked } = usePlanReviewSelection(
    `${part.toolCallId ?? ""}:${input?.runId ?? ""}`,
    operationIds,
    journal?.selectedOperationIds,
  );
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(true);
  const [undoing, setUndoing] = useState(false);
  const [undoResult, setUndoResult] = useState<BatchUndoResult | null>(null);
  const [actionError, setActionError] = useState("");
  const busyRef = useRef(false);
  const review = planReviewState(part, journal);
  const canApprove =
    review.phase === "approval" &&
    Boolean(journal && input && part.toolCallId && selectedIds.length) &&
    !submitting;
  const hasError =
    ["failed", "invalid", "conflict"].includes(review.phase) ||
    Boolean(actionError);
  const undone = review.phase === "undone" || undoResult?.ok === true;
  const undoConflict =
    undoResult?.status === "undo-conflicted" ||
    journal?.status === "undo-conflicted";
  const undoFailed = undoResult?.ok === false;
  const status: WorkCardStatusData =
    submitting || review.phase === "executing"
      ? {
          label: submitting && !approving ? "正在取消" : "正在应用",
          icon: "running",
          tone: "accent",
        }
      : undoing
        ? { label: "正在撤回", icon: "running", tone: "accent" }
        : undone
          ? { label: "已撤回", icon: "undone", tone: "neutral" }
          : undoFailed || undoConflict
            ? {
                label: undoConflict ? "撤回冲突" : "撤回失败",
                icon: "error",
                tone: "danger",
              }
            : hasError
              ? {
                  label: actionError ? "执行未完成" : review.label,
                  icon: "error",
                  tone: "danger",
                }
              : review.phase === "approval"
                ? { label: review.label, icon: "waiting", tone: "warning" }
                : review.phase === "cancelled"
                  ? { label: review.label, icon: "cancelled", tone: "neutral" }
                  : review.phase === "applied"
                    ? { label: review.label, icon: "done", tone: "success" }
                    : { label: review.label, icon: "running", tone: "accent" };
  useEmbeddedWorkCardStatus(status, embedded);
  const respond = async (approved: boolean) => {
    if (
      !part.toolCallId ||
      !input?.runId ||
      busyRef.current ||
      (approved && !canApprove)
    )
      return;
    busyRef.current = true;
    setApproving(approved);
    setSubmitting(true);
    setLocked(true);
    setActionError("");
    try {
      await onApprovalResponse({
        approvalId: part.approval?.id ?? `batch-approval-${part.toolCallId}`,
        toolCallId: part.toolCallId,
        runId: input.runId,
        approved,
        selectedOperationIds: approved ? selectedIds : [],
      });
    } catch (error) {
      setActionError(formatNotebookAiError(error, { phase: "execute" }));
    } finally {
      busyRef.current = false;
      setSubmitting(false);
      setLocked(false);
    }
  };
  const undo = async () => {
    const toolCallId =
      typeof output.toolCallId === "string"
        ? output.toolCallId
        : part.toolCallId;
    const runId =
      typeof output.runId === "string" ? output.runId : input?.runId;
    if (!toolCallId || !runId || busyRef.current) return;
    busyRef.current = true;
    setUndoing(true);
    try {
      setUndoResult(await onUndo(toolCallId, runId));
    } catch (error) {
      setUndoResult({
        ok: false,
        error: formatNotebookAiError(error, { phase: "undo" }),
      });
    } finally {
      busyRef.current = false;
      setUndoing(false);
    }
  };
  const regenerate = () => {
    const notebookId =
      journal?.notebookId ?? useNotebooks.getState().activeNotebookId;
    if (!notebookId) return;
    requestPlanRefinement({
      notebookId,
      text: `方案「${input?.title ?? "笔记变更计划"}」${review.phase === "conflict" ? "遇到原文或位置冲突" : "未能完成"}。请重新读取目标笔记，检查当前内容和先前操作的结果，基于现状重新生成待确认方案，避免重复执行已完成的变更。\n${review.error ? `原因：${review.error}\n` : ""}\n我的补充要求：`,
    });
  };
  const secondaryClass =
    "h-[40px] rounded-[14px] bg-[var(--goose-block-subtle-bg)] text-[14px] text-foreground shadow-none hover:bg-[var(--goose-block-subtle-hover)]";
  const detail = submitting
    ? approving
      ? "正在应用已选操作，请稍候。"
      : "正在取消本方案，请稍候。"
    : undoing
      ? "正在撤回本次变更，请稍候。"
      : undone
        ? "本次变更已撤回。"
        : undoConflict
          ? "笔记在应用后发生变化，未覆盖后续编辑。"
          : undoFailed
            ? "未能撤回，请检查目标笔记后重试。"
            : review.detail;
  const reason = actionError || undoResult?.error || review.error;
  const canUndo =
    (review.phase === "applied" || undoConflict) &&
    output.canUndo !== false &&
    !undone;
  const footer = (
    <div className="notebook-ai-review-footer">
      <p aria-live="polite">{detail}</p>
      {review.phase === "applied" &&
      review.selectedCount !== undefined &&
      operationIds.length > review.selectedCount ? (
        <p className="text-muted-foreground">
          已跳过 {operationIds.length - review.selectedCount} 项未选操作。
        </p>
      ) : null}
      {reason ? (
        <p className="text-[var(--goose-color-danger-focus)]" role="alert">
          {reason}
        </p>
      ) : null}
      {review.phase === "approval" ? (
        <>
          {!journal ? (
            <p className="text-[var(--goose-color-danger-focus)]" role="alert">
              原方案记录已不可用，请重新生成。
            </p>
          ) : null}
          <div className="grid grid-cols-[1fr_1.2fr] gap-2.5">
            <Button
              type="button"
              variant="secondary"
              className={secondaryClass}
              disabled={submitting}
              onClick={() => void respond(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="goose-interactive-primary h-[40px] rounded-[14px] text-[14px] font-semibold shadow-none"
              disabled={!canApprove}
              onClick={() => void respond(true)}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              应用 {selectedIds.length} 项
            </Button>
          </div>
          {!journal ? (
            <Button
              type="button"
              variant="secondary"
              className={secondaryClass}
              onClick={regenerate}
            >
              重新生成方案
            </Button>
          ) : null}
        </>
      ) : null}
      {canUndo ? (
        <Button
          type="button"
          variant="secondary"
          className={`${secondaryClass} w-full`}
          disabled={undoing}
          onClick={() => void undo()}
        >
          {undoing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {undoFailed || undoConflict ? "重试撤回" : "撤回本次变更"}
        </Button>
      ) : null}
      {hasError && !undoConflict ? (
        <Button
          type="button"
          variant="secondary"
          className={secondaryClass}
          onClick={regenerate}
        >
          调整并重新生成方案
        </Button>
      ) : null}
    </div>
  );
  return embedded ? (
    footer
  ) : (
    <ApprovalCard
      title={input?.title ?? "笔记变更计划"}
      status={status}
      footer={footer}
    />
  );
}
