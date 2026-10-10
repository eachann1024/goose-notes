import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { useAiStatus } from "@/stores/useAiStatus";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import { sanitizeNotebookAiMessages } from "@/lib/notebook-ai/messageUtils";
import { ensureNotebookAiMessageCreatedAt } from "@/lib/notebook-ai/messageTime";
import { NOTEBOOK_AI_PLACEHOLDER_HINTS } from "./helpers";
import type { NotebookAiSessionScope } from "./types";
import type { SessionState } from "./useSessionState";

const NOTEBOOK_AI_STREAM_IDLE_TIMEOUT_MS = 60_000;
export function useStreamLifecycle(state: SessionState) {
  const {
    activeSessionScopeRef,
    currentSessionScope,
    committedStopRef,
    stop,
    messagesRef,
    messages,
    requestCurrentPageIdRef,
    compactAbortRef,
    aiStatusActiveRef,
    notebookId,
    isCurrentSession,
    setMessages,
    conversationId,
    isStreaming,
    status,
    sessionGeneration,
    isCompacting,
    error,
    clearError,
    unavailableReason,
    isBusy,
    composerHasContent,
    setPlaceholderIndex,
  } = state;
  useLayoutEffect(() => {
    activeSessionScopeRef.current = currentSessionScope;
    committedStopRef.current = stop;
    messagesRef.current = messages;
  }, [
    activeSessionScopeRef,
    committedStopRef,
    currentSessionScope,
    messages,
    messagesRef,
    stop,
  ]);

  useLayoutEffect(() => {
    requestCurrentPageIdRef.current = null;
    return () => {
      compactAbortRef.current?.abort();
      void committedStopRef.current();
      // 切换不是一次成功完成，不能在新笔记本上误触发 celebrate。
      if (aiStatusActiveRef.current) {
        aiStatusActiveRef.current = false;
        useAiStatus.getState().reset();
      }
    };
  }, [
    aiStatusActiveRef,
    committedStopRef,
    compactAbortRef,
    notebookId,
    requestCurrentPageIdRef,
  ]);

  const streamStateRef = useRef<{
    scope: NotebookAiSessionScope;
    wasStreaming: boolean;
  } | null>(null);

  // @ai-sdk/react 会把旧 Chat 的 onFinish 转发给最新 render 的 callback；笔记本
  // 切换时该 callback 无法辨认消息来自哪个 Chat。改为只观察当前 Chat 的状态转变，
  // 并按捕获的会话 scope 落盘，旧流即使迟到也不会触碰新会话。
  useEffect(() => {
    const scope = currentSessionScope;
    const previous = streamStateRef.current;
    streamStateRef.current = { scope, wasStreaming: isStreaming };
    if (
      !previous ||
      previous.scope.notebookId !== scope.notebookId ||
      previous.scope.conversationId !== scope.conversationId ||
      previous.scope.generation !== scope.generation ||
      !previous.wasStreaming ||
      isStreaming ||
      status !== "ready"
    ) {
      return;
    }

    const cleanedMessages = ensureNotebookAiMessageCreatedAt(
      sanitizeNotebookAiMessages(messages),
    );
    if (isCurrentSession(scope)) {
      setMessages(cleanedMessages);
    }
    const persist = () => {
      useNotebookAiChats
        .getState()
        .setMessages(scope.notebookId, scope.conversationId, cleanedMessages);
    };
    const ric = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      ric(persist, { timeout: 700 });
    } else {
      setTimeout(persist, 48);
    }
  }, [
    conversationId,
    currentSessionScope,
    isCurrentSession,
    isStreaming,
    messages,
    notebookId,
    sessionGeneration,
    setMessages,
    status,
  ]);

  const stopAll = useCallback(() => {
    compactAbortRef.current?.abort();
    void stop();
  }, [compactAbortRef, stop]);

  useEffect(() => {
    if (!isStreaming) return;
    const timer = window.setTimeout(() => {
      void committedStopRef.current();
      toast.error("AI 响应超时，已暂停本次任务", {
        id: "notebook-ai-stream-timeout",
        description: "已完成的内容已保留，可随时重试。",
      });
    }, NOTEBOOK_AI_STREAM_IDLE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [committedStopRef, isStreaming, messages]);

  // 请求生命周期 → 页头图标：关面板/切页不打断；仅真实结束才 celebrate。
  useEffect(() => {
    if (isStreaming || isCompacting) {
      if (!aiStatusActiveRef.current) {
        aiStatusActiveRef.current = true;
        useAiStatus.getState().beginStreaming();
      }
      return;
    }

    if (!aiStatusActiveRef.current) return;
    aiStatusActiveRef.current = false;
    useAiStatus
      .getState()
      .finishStreaming({ celebrate: status === "ready" && !error });
  }, [aiStatusActiveRef, error, isCompacting, isStreaming, status]);

  useEffect(() => {
    setMessages(
      useNotebookAiChats
        .getState()
        .getConversationMessages(notebookId, conversationId),
    );
    clearError();
    requestCurrentPageIdRef.current = null;
  }, [
    notebookId,
    conversationId,
    setMessages,
    clearError,
    requestCurrentPageIdRef,
  ]);

  useEffect(() => {
    if (unavailableReason || isBusy || composerHasContent) return;

    let timer: number | null = null;
    const stop = () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        setPlaceholderIndex(
          (index) => (index + 1) % NOTEBOOK_AI_PLACEHOLDER_HINTS.length,
        );
      }, 4500);
    };
    const sync = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [unavailableReason, isBusy, composerHasContent, setPlaceholderIndex]);

  return stopAll;
}
