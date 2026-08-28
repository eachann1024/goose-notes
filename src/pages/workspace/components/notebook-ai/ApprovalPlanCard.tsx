import { useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  normalizeBatchPlanInput,
  readBatchPlanJournal,
} from "@/lib/notebook-ai/batch-plan";
import {
  collapseRepeatedErrorSegments,
  formatNotebookAiError,
} from "@/lib/notebook-ai/errors";
import { ApprovalCard } from "./beautiful-ui/ApprovalCard";

type BatchOperation =
  | {
      operationId: string;
      type: "create";
      title: string;
      markdown: string;
      parentId?: string;
    }
  | {
      operationId: string;
      type: "edit";
      pageId: string;
      markdown: string;
      title?: string;
    }
  | {
      operationId: string;
      type: "delete";
      pageIds: string[];
    }
  | {
      operationId: string;
      type: "search_replace";
      pageId: string;
      oldString: string;
      newString: string;
      replaceAll?: boolean;
    };

type BatchPlanInput = {
  runId?: string;
  title?: string;
  summary?: string;
  operations?: BatchOperation[];
};

type BatchPlanOutput = {
  ok?: boolean;
  needsApproval?: boolean;
  toolCallId?: string;
  runId?: string;
  status?: string;
  appliedCount?: number;
  selectedCount?: number;
  error?: string;
  canUndo?: boolean;
};

export interface BatchApprovalResponse {
  approvalId: string;
  toolCallId: string;
  runId: string;
  approved: boolean;
  selectedOperationIds: string[];
}

export type BatchUndoResult = {
  ok: boolean;
  status?: string;
  revertedCount?: number;
  conflictCount?: number;
  error?: string;
};

interface ApprovalPlanPart {
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
  approval?: {
    id?: string;
    approved?: boolean;
    reason?: string;
  };
}

interface ApprovalPlanCardProps {
  part: ApprovalPlanPart;
  onApprovalResponse: (response: BatchApprovalResponse) => Promise<void> | void;
  onUndo: (toolCallId: string, runId: string) => Promise<BatchUndoResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseInput(value: unknown, toolCallId?: string): BatchPlanInput {
  const normalized = normalizeBatchPlanInput(value, {
    fallbackRunId: toolCallId ? `batch-${toolCallId}` : undefined,
    fallbackTitle: "笔记变更计划",
  });
  if (!normalized) return {};
  return {
    runId: normalized.runId,
    title: normalized.title,
    summary: normalized.summary,
    operations: normalized.operations,
  };
}

function parseOutput(value: unknown): BatchPlanOutput {
  return isRecord(value) ? (value as BatchPlanOutput) : {};
}

export function ApprovalPlanCard({
  part,
  onApprovalResponse,
  onUndo,
}: ApprovalPlanCardProps) {
  const input = parseInput(part.input, part.toolCallId);
  const output = parseOutput(part.output);
  const operations = input.operations ?? [];
  const operationIds = operations.map((operation) => operation.operationId);
  const preparedJournal = useMemo(
    () =>
      part.toolCallId && input.runId
        ? readBatchPlanJournal(part.toolCallId, input.runId)
        : null,
    [input.runId, part.state, part.toolCallId],
  );
  const invalidPlanError =
    preparedJournal?.status === "invalid"
      ? formatNotebookAiError(preparedJournal.error, { phase: "prepare" })
      : undefined;
  const [submitting, setSubmitting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoResult, setUndoResult] = useState<BatchUndoResult | null>(null);

  const isPreparedApproval =
    part.state === "output-available" &&
    output.status === "prepared" &&
    output.needsApproval === true;
  const isApprovalRequested =
    part.state === "approval-requested" || isPreparedApproval;
  const isApprovalResponded = part.state === "approval-responded";
  const isDenied =
    part.state === "output-denied" ||
    (isApprovalResponded && part.approval?.approved === false);
  const isComplete =
    part.state === "output-available" &&
    output.ok === true &&
    !isPreparedApproval;
  const isPersistedUndone = output.status === "undone";
  const hasError =
    Boolean(invalidPlanError) ||
    part.state === "output-error" ||
    Boolean(part.errorText) ||
    (part.state === "output-available" && output.ok === false);
  const canApprove =
    isApprovalRequested &&
    !invalidPlanError &&
    operationIds.length > 0 &&
    !submitting;

  const respond = async (approved: boolean) => {
    const toolCallId = part.toolCallId;
    const approvalId =
      part.approval?.id ??
      (toolCallId ? `batch-approval-${toolCallId}` : undefined);
    const runId = input.runId;
    if (!approvalId || !toolCallId || !runId || submitting) return;
    setSubmitting(true);
    try {
      await onApprovalResponse({
        approvalId,
        toolCallId,
        runId,
        approved,
        selectedOperationIds: approved ? operationIds : [],
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndo = async () => {
    const toolCallId = output.toolCallId || part.toolCallId;
    if (!toolCallId || !output.runId || undoing) return;
    setUndoing(true);
    try {
      setUndoResult(await onUndo(toolCallId, output.runId));
    } finally {
      setUndoing(false);
    }
  };

  const statusLabel = invalidPlanError
    ? "计划无效"
    : isApprovalRequested
      ? "等待同意"
      : isDenied
        ? "已取消"
        : isApprovalResponded
          ? "准备执行"
          : isPersistedUndone || undoResult?.status === "reverted"
            ? "已撤回"
            : isComplete
              ? "执行完成"
              : hasError
                ? "执行失败"
                : "生成计划";
  const statusTone =
    hasError || isDenied ? "danger" : isComplete ? "success" : "neutral";

  const footer = isApprovalRequested ? (
    <div className="grid grid-cols-[1fr_1.2fr] gap-2.5">
      {invalidPlanError ? (
        <p
          className="col-span-2 min-w-0 truncate text-[12px] text-[var(--goose-color-danger-focus)]"
          role="alert"
        >
          {invalidPlanError}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        className="h-11 rounded-[14px] bg-[var(--goose-block-subtle-bg)] text-[15px] text-foreground shadow-none hover:bg-[var(--goose-block-subtle-hover)]"
        disabled={submitting}
        onClick={() => void respond(false)}
      >
        取消
      </Button>
      <Button
        type="button"
        className="h-11 rounded-[14px] bg-[#171717] text-[15px] font-semibold text-white shadow-none hover:bg-[#2a2a2a] dark:bg-[#f4f4f5] dark:text-[#171717] dark:hover:bg-[#e4e4e7]"
        disabled={!canApprove}
        onClick={() => void respond(true)}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {invalidPlanError ? "不可执行" : "同意"}
      </Button>
    </div>
  ) : isDenied ? (
    <p className="text-[13px] text-muted-foreground">已取消</p>
  ) : hasError ? (
    <p
      className="text-[13px] text-[var(--goose-color-danger-focus)]"
      role="alert"
    >
      {formatNotebookAiError(
        collapseRepeatedErrorSegments(
          String(part.errorText || output.error || ""),
        ) ||
          part.errorText ||
          output.error,
        {
          phase:
            isApprovalResponded || part.approval?.approved === true
              ? "execute"
              : "prepare",
        },
      )}
    </p>
  ) : isComplete ? (
    output.canUndo !== false &&
    !isPersistedUndone &&
    undoResult?.ok !== true ? (
      <Button
        type="button"
        variant="secondary"
        className="h-11 w-full rounded-[14px] bg-[var(--goose-block-subtle-bg)] text-[15px] text-foreground shadow-none hover:bg-[var(--goose-block-subtle-hover)]"
        disabled={!output.runId || undoing}
        onClick={() => void handleUndo()}
      >
        {undoing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        撤回
      </Button>
    ) : (
      <p className="text-[13px] text-muted-foreground" aria-live="polite">
        {undoResult
          ? undoResult.ok
            ? "已撤回"
            : collapseRepeatedErrorSegments(undoResult.error ?? "") ||
              undoResult.error ||
              "未能撤回"
          : isPersistedUndone
            ? "已撤回"
            : "已更改"}
      </p>
    )
  ) : (
    <p className="text-[13px] text-muted-foreground" aria-live="polite">
      正在更改…
    </p>
  );

  return (
    <ApprovalCard
      title={input.title?.trim() || "笔记变更计划"}
      statusLabel={statusLabel}
      statusTone={statusTone}
      footer={footer}
    />
  );
}
