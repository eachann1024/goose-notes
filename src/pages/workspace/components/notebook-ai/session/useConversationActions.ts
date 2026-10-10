import { useCallback, useEffect } from "react";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import { toast } from "@/components/ui/sonner";
import { OPEN_AI_PANEL_EVENT } from "@/components/editor/ai/composer/selectionQuote";
import { getNotebookAiReferenceSuggestions } from "@/lib/notebook-ai/context";
import { sanitizeNotebookAiMessages } from "@/lib/notebook-ai/messageUtils";
import type { SessionState } from "./useSessionState";

export function useConversationActions(state: SessionState) {
  const {
    isBusy,
    notebookId,
    conversationId,
    messages,
    clearError,
    requestCurrentPageIdRef,
    setSuppressDefaultPageSeed,
    setComposerRevision,
    setConversationId,
    setMessages,
  } = state;
  const persistCurrentConversation = useCallback(() => {
    useNotebookAiChats
      .getState()
      .setMessages(
        notebookId,
        conversationId,
        sanitizeNotebookAiMessages(messages),
      );
  }, [notebookId, conversationId, messages]);

  const newConversation = useCallback(
    (options?: { onConsumeCapturedSelection?: () => void }) => {
      if (isBusy) return;
      persistCurrentConversation();
      clearError();
      requestCurrentPageIdRef.current = null;
      options?.onConsumeCapturedSelection?.();
      // 新会话清空输入草稿，避免把旧会话未发送内容带过去
      useNotebookAiChats.getState().clearComposerDraft(notebookId);
      const nextConversationId = useNotebookAiChats
        .getState()
        .createConversation(notebookId);
      setSuppressDefaultPageSeed(true);
      setComposerRevision((revision) => revision + 1);
      setConversationId(nextConversationId);
      setMessages([]);
    },
    [
      isBusy,
      persistCurrentConversation,
      clearError,
      notebookId,
      setConversationId,
      setMessages,
    ],
  );

  const ensureFreshConversation = useCallback(() => {
    if (isBusy) return conversationId;
    const nextConversationId = useNotebookAiChats
      .getState()
      .ensureFreshActiveConversation(notebookId);
    if (nextConversationId === conversationId) return conversationId;

    persistCurrentConversation();
    clearError();
    requestCurrentPageIdRef.current = null;
    useNotebookAiChats.getState().clearComposerDraft(notebookId);
    setSuppressDefaultPageSeed(true);
    setComposerRevision((revision) => revision + 1);
    setConversationId(nextConversationId);
    setMessages([]);
    return nextConversationId;
  }, [
    isBusy,
    conversationId,
    notebookId,
    persistCurrentConversation,
    clearError,
    setConversationId,
    setMessages,
  ]);

  useEffect(() => {
    const onOpen = () => {
      ensureFreshConversation();
    };
    window.addEventListener(OPEN_AI_PANEL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AI_PANEL_EVENT, onOpen);
  }, [ensureFreshConversation]);

  const selectConversation = useCallback(
    (
      nextConversationId: string,
      options?: { onConsumeCapturedSelection?: () => void },
    ) => {
      if (isBusy || nextConversationId === conversationId) return;
      persistCurrentConversation();
      const chats = useNotebookAiChats.getState();
      chats.setActiveConversation(notebookId, nextConversationId);
      const nextMessages = chats.getConversationMessages(
        notebookId,
        nextConversationId,
      );
      clearError();
      requestCurrentPageIdRef.current = null;
      options?.onConsumeCapturedSelection?.();
      setSuppressDefaultPageSeed(false);
      setConversationId(nextConversationId);
      setMessages(nextMessages);
    },
    [
      isBusy,
      conversationId,
      notebookId,
      clearError,
      setConversationId,
      setMessages,
      persistCurrentConversation,
    ],
  );

  const deleteConversation = useCallback(
    (targetConversationId: string) => {
      // 流式中只拒绝删除当前激活会话，删除其他历史会话不受影响
      if (isBusy && targetConversationId === conversationId) {
        toast.warning("正在生成回复，请稍后再删除当前会话");
        return false;
      }

      const chats = useNotebookAiChats.getState();
      if (targetConversationId !== conversationId) {
        // 非激活会话：只删记录，不影响当前会话内容
        chats.deleteConversation(notebookId, targetConversationId);
        return true;
      }

      // 删除激活会话：不要 persistCurrentConversation（会把内存消息写回刚要删的会话）
      chats.deleteConversation(notebookId, targetConversationId);
      clearError();
      requestCurrentPageIdRef.current = null;

      const nextActiveConversationId = useNotebookAiChats
        .getState()
        .getActiveConversationId(notebookId);
      if (nextActiveConversationId) {
        const nextMessages = useNotebookAiChats
          .getState()
          .getConversationMessages(notebookId, nextActiveConversationId);
        setSuppressDefaultPageSeed(false);
        setConversationId(nextActiveConversationId);
        setMessages(nextMessages);
        return true;
      }

      // 无剩余会话：与新建会话一致，落到空白新会话
      useNotebookAiChats.getState().clearComposerDraft(notebookId);
      const freshConversationId = useNotebookAiChats
        .getState()
        .createConversation(notebookId);
      setSuppressDefaultPageSeed(true);
      setComposerRevision((revision) => revision + 1);
      setConversationId(freshConversationId);
      setMessages([]);
      return true;
    },
    [
      isBusy,
      conversationId,
      notebookId,
      clearError,
      setConversationId,
      setMessages,
    ],
  );

  const searchPages = useCallback(
    (query: string) => getNotebookAiReferenceSuggestions(query, notebookId),
    [notebookId],
  );

  return {
    newConversation,
    ensureFreshConversation,
    selectConversation,
    deleteConversation,
    searchPages,
  };
}
