import { useCallback, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { ChatTransport } from "ai";
import {
  useNotebookAiChats,
  composerDraftHasContent,
} from "@/stores/useNotebookAiChats";
import { buildTransport } from "@/lib/notebook-ai/transport";
import { buildLanguageModel } from "@/lib/notebook-ai/model";
import { getCurrentNotebookAiPageId } from "@/lib/notebook-ai/context";
import { prepareNotebookAiMessagesForModel } from "@/lib/notebook-ai/messageUtils";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import type { NotebookAiSessionScope } from "./types";

export function useSessionState(notebookId: string) {
  const requestCurrentPageIdRef = useRef<string | null>(null);
  const compactAbortRef = useRef<AbortController | null>(null);
  const [session, setSession] = useState<NotebookAiSessionScope>(() => ({
    notebookId,
    conversationId: useNotebookAiChats
      .getState()
      .ensureFreshActiveConversation(notebookId),
    generation: 0,
  }));
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [composerRevision, setComposerRevision] = useState(0);
  const [suppressDefaultPageSeed, setSuppressDefaultPageSeed] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);

  // WorkspaceLayout 不再用 key 重挂整个 Provider。这里在 render 期间把新笔记本
  // 的会话状态一次性换好，React 会立即重渲染，子节点不会拿到旧 notebook 的消息。
  // 真正停止旧 Chat/压缩任务留给 layout effect，避免在 render 中执行副作用。
  if (session.notebookId !== notebookId) {
    const nextConversationId = useNotebookAiChats
      .getState()
      .ensureFreshActiveConversation(notebookId);
    setSession({
      notebookId,
      conversationId: nextConversationId,
      generation: session.generation + 1,
    });
    setPlaceholderIndex(0);
    setSuppressDefaultPageSeed(false);
    setIsCompacting(false);
  }
  const { conversationId, generation: sessionGeneration } = session;
  const currentSessionScope = useMemo<NotebookAiSessionScope>(
    () => ({
      notebookId,
      conversationId,
      generation: sessionGeneration,
    }),
    [conversationId, notebookId, sessionGeneration],
  );
  const activeSessionScopeRef = useRef(currentSessionScope);
  const isCurrentSession = useCallback(
    (scope: NotebookAiSessionScope) =>
      activeSessionScopeRef.current.notebookId === scope.notebookId &&
      activeSessionScopeRef.current.conversationId === scope.conversationId &&
      activeSessionScopeRef.current.generation === scope.generation,
    [],
  );
  const setConversationId = useCallback(
    (nextConversationId: string) =>
      setSession((current) => ({
        ...current,
        conversationId: nextConversationId,
      })),
    [],
  );

  const composerHasContent = useNotebookAiChats((s) =>
    composerDraftHasContent(s.composerDrafts[notebookId]),
  );

  const modelCheck = buildLanguageModel();

  const persistedMessages = useMemo(
    () =>
      useNotebookAiChats
        .getState()
        .getConversationMessages(notebookId, conversationId),
    [notebookId, conversationId],
  );

  // useChat 只在 chat id 改变时重建 Chat；transport 必须保持稳定，
  // 并在真正发送时再绑定本轮最新的页签上下文。
  const transport = useMemo<ChatTransport<NotebookAiMessage>>(
    () => ({
      async sendMessages(options) {
        const currentPageId =
          requestCurrentPageIdRef.current ??
          getCurrentNotebookAiPageId(notebookId);
        const result = buildTransport(notebookId, currentPageId);
        if (!result.ok) {
          throw new Error(result.reason);
        }

        return result.transport.sendMessages({
          ...options,
          messages: prepareNotebookAiMessagesForModel(options.messages),
        });
      },
      async reconnectToStream(options) {
        const currentPageId =
          requestCurrentPageIdRef.current ??
          getCurrentNotebookAiPageId(notebookId);
        const result = buildTransport(notebookId, currentPageId);
        if (!result.ok) {
          throw new Error(result.reason);
        }
        return result.transport.reconnectToStream(options);
      },
    }),
    [notebookId],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
    error,
    clearError,
  } = useChat<NotebookAiMessage>({
    transport,
    id: `notebook-ai-${notebookId}-${conversationId}`,
    messages: persistedMessages,
    // 流式 token 不节流会每字触发 messages → 全树 commit + Streamdown 重解析，整面板卡顿。
    // ~50ms ≈ 20fps UI 更新，观感仍流畅，React commit 次数大幅下降。
    experimental_throttle: 50,
  });

  const isStreaming = status === "streaming" || status === "submitted";
  const isBusy = isStreaming || isCompacting;
  const unavailableReason = !modelCheck.ok ? modelCheck.reason : undefined;
  const aiStatusActiveRef = useRef(false);
  const messagesRef = useRef(messages);
  const committedStopRef = useRef(stop);

  return {
    notebookId,
    conversationId,
    sessionGeneration,
    currentSessionScope,
    activeSessionScopeRef,
    isCurrentSession,
    setConversationId,
    requestCurrentPageIdRef,
    compactAbortRef,
    placeholderIndex,
    setPlaceholderIndex,
    composerRevision,
    setComposerRevision,
    suppressDefaultPageSeed,
    setSuppressDefaultPageSeed,
    isCompacting,
    setIsCompacting,
    composerHasContent,
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
    error,
    clearError,
    isStreaming,
    isBusy,
    unavailableReason,
    aiStatusActiveRef,
    messagesRef,
    committedStopRef,
  };
}

export type SessionState = ReturnType<typeof useSessionState>;
