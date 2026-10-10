import { useCallback } from "react";
import { batchExecutionSummary } from "@/lib/notebook-ai/batch-plan/executionSummary";
import { toast } from "@/components/ui/sonner";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import {
  executePreparedBatchPlan,
  undoBatchPlan,
  updateBatchPlanSelection,
} from "@/lib/notebook-ai/batch-plan";
import { reloadEditorIfActive } from "@/lib/notebook-ai/liveWriter";
import { updatePlanMessages } from "../approval/updatePlanMessages";
import { formatNotebookAiError } from "@/lib/notebook-ai/errors";
import type {
  BatchApprovalResponse,
  BatchUndoResult,
} from "../ApprovalPlanCard";
import type { SessionState } from "./useSessionState";

export function useBatchApprovalActions(state: SessionState) {
  const {
    currentSessionScope,
    isCurrentSession,
    setMessages,
    notebookId,
    conversationId,
  } = state;
  const onBatchApproval = useCallback(
    async (response: BatchApprovalResponse) => {
      const scope = currentSessionScope;
      const replaceToolPart = (
        state:
          | "approval-responded"
          | "output-available"
          | "output-denied"
          | "output-error",
        payload: { output?: unknown; errorText?: string } = {},
      ) => {
        if (!isCurrentSession(scope)) return;
        setMessages((current) => {
          const cleanedMessages = updatePlanMessages(
            current,
            response.toolCallId,
            (part) => ({
              ...part,
              state,
              ...(payload.output !== undefined
                ? { output: payload.output }
                : {}),
              ...(payload.errorText ? { errorText: payload.errorText } : {}),
              approval: {
                id: response.approvalId,
                approved: response.approved,
                reason: response.approved
                  ? `用户批准执行 ${response.selectedOperationIds.length} 项操作`
                  : "用户取消了整批计划",
              },
            }),
          );
          useNotebookAiChats
            .getState()
            .setMessages(notebookId, conversationId, cleanedMessages);
          return cleanedMessages;
        });
      };

      if (!response.approved) {
        replaceToolPart("output-denied");
        return;
      }

      const journal = updateBatchPlanSelection(
        response.toolCallId,
        response.runId,
        response.selectedOperationIds,
      );
      if (!journal) {
        toast.error("当前执行计划已过期，请重新向 AI 发起指令生成新计划");
        return;
      }

      replaceToolPart("approval-responded");
      try {
        const result = await executePreparedBatchPlan(
          response.toolCallId,
          response.runId,
        );
        replaceToolPart("output-available", {
          output: {
            ok: result.ok,
            toolCallId: response.toolCallId,
            runId: response.runId,
            status: result.journal.status,
            ...batchExecutionSummary(result),
            selectedCount: result.journal.selectedOperationIds.length,
            canUndo: result.ok && result.journal.status === "completed",
            ...(result.ok ? {} : { error: result.error }),
            results: result.results,
          },
        });
      } catch (executeError) {
        replaceToolPart("output-error", {
          errorText:
            executeError instanceof Error
              ? executeError.message
              : "批量计划执行失败",
        });
      }
    },
    [
      conversationId,
      currentSessionScope,
      isCurrentSession,
      notebookId,
      setMessages,
    ],
  );

  const onBatchUndo = useCallback(
    async (toolCallId: string, runId: string): Promise<BatchUndoResult> => {
      const scope = currentSessionScope;
      try {
        const result = await undoBatchPlan(toolCallId, runId);
        if (!isCurrentSession(scope)) {
          return { ok: false, error: "会话已切换，已忽略过期结果" };
        }
        if (!result.ok) {
          toast.error("无法完整撤回本批变更", {
            description: formatNotebookAiError(result.error, { phase: "undo" }),
          });
          return {
            ok: false,
            status: result.journal.status,
            conflictCount: result.journal.status === "undo-conflicted" ? 1 : 0,
            error: result.error,
          };
        }

        const pageIds = new Set(
          result.results.flatMap((operation) => operation.pageIds),
        );
        pageIds.forEach(reloadEditorIfActive);
        setMessages((current) => {
          const cleanedMessages = updatePlanMessages(
            current,
            toolCallId,
            (part) => ({
              ...part,
              output: {
                ...(part.output && typeof part.output === "object"
                  ? (part.output as Record<string, unknown>)
                  : {}),
                status: "undone",
                canUndo: false,
              },
            }),
          );
          useNotebookAiChats
            .getState()
            .setMessages(notebookId, conversationId, cleanedMessages);
          return cleanedMessages;
        });
        toast.success("已撤回本批变更");
        return {
          ok: true,
          status: "reverted",
          revertedCount: result.results.filter((operation) => operation.ok)
            .length,
        };
      } catch (undoError) {
        if (!isCurrentSession(scope)) {
          return { ok: false, error: "会话已切换，已忽略过期结果" };
        }
        const description = formatNotebookAiError(undoError, { phase: "undo" });
        toast.error("撤回失败", { description });
        return { ok: false, error: description };
      }
    },
    [
      conversationId,
      currentSessionScope,
      isCurrentSession,
      notebookId,
      setMessages,
    ],
  );

  return { onBatchApproval, onBatchUndo };
}
