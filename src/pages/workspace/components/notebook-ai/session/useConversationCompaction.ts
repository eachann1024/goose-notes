import { useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import { ensureNotebookAiMessageCreatedAt } from "@/lib/notebook-ai/messageTime";
import { formatNotebookAiError } from "@/lib/notebook-ai/errors";
import {
  buildCompactedConversation,
  conversationHasCompactableContent,
  generateConversationCompactSummary,
} from "@/lib/notebook-ai/compactConversation";
import { createChatMessageId } from "./helpers";
import type { SessionState } from "./useSessionState";

export function useConversationCompaction(state: SessionState) {
  const {
    isBusy,
    unavailableReason,
    messagesRef,
    compactAbortRef,
    currentSessionScope,
    setIsCompacting,
    clearError,
    isCurrentSession,
    setMessages,
    notebookId,
    conversationId,
  } = state;
  const compactConversation = useCallback(() => {
    if (isBusy) {
      toast.warning("AI 正在回复中，请待生成结束后再压缩上下文");
      return;
    }
    if (unavailableReason) {
      toast.error(unavailableReason);
      return;
    }
    const currentMessages = messagesRef.current;
    if (!conversationHasCompactableContent(currentMessages)) {
      toast.info("当前会话暂无需要压缩的历史内容");
      return;
    }

    compactAbortRef.current?.abort();
    const scope = currentSessionScope;
    const abort = new AbortController();
    compactAbortRef.current = abort;
    setIsCompacting(true);
    clearError();

    void generateConversationCompactSummary(currentMessages, abort.signal)
      .then((summary) => {
        if (abort.signal.aborted || !isCurrentSession(scope)) return;
        const compacted = ensureNotebookAiMessageCreatedAt(
          buildCompactedConversation({
            summary,
            createId: createChatMessageId,
          }),
        );
        setMessages(compacted);
        useNotebookAiChats
          .getState()
          .setMessages(notebookId, conversationId, compacted);
        toast.success("会话上下文已压缩");
      })
      .catch((error) => {
        if (abort.signal.aborted || !isCurrentSession(scope)) return;
        toast.error("压缩失败", {
          description: formatNotebookAiError(error, { phase: "chat" }),
        });
      })
      .finally(() => {
        if (compactAbortRef.current === abort) {
          compactAbortRef.current = null;
        }
        if (isCurrentSession(scope)) {
          setIsCompacting(false);
        }
      });
  }, [
    isBusy,
    unavailableReason,
    messagesRef,
    compactAbortRef,
    currentSessionScope,
    setIsCompacting,
    clearError,
    isCurrentSession,
    setMessages,
    notebookId,
    conversationId,
  ]);

  return compactConversation;
}
