/**
 * NotebookAiPanel — AI 聊天面板（右侧并排，可拖宽）
 *
 * - useChat（@ai-sdk/react）+ DirectChatTransport proxy
 * - 会话按 notebookId 隔离持久化（useNotebookAiChats）
 * - 每轮发送绑定当前活动页签 pageId，避免新建/切换页面影响当前请求
 * - 流式写入页面：handleStreamingWritePart + cleanupWriterSession
 */
import { useEffect, useRef, useCallback, useMemo, type KeyboardEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { X, Trash2, Bot, CircleAlert } from "lucide-react";
import { useNotebooks } from "@/stores/useNotebooks";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import { buildTransport } from "@/lib/notebook-ai/transport";
import {
  handleStreamingWritePart,
  cleanupWriterSession,
  type StreamingWritePart,
} from "@/lib/notebook-ai/liveWriter";
import { buildLanguageModel } from "@/lib/notebook-ai/model";
import {
  buildNotebookAiUserMessage,
  getCurrentNotebookAiPageId,
  getNotebookAiReferenceSuggestions,
} from "@/lib/notebook-ai/context";
import { sanitizeNotebookAiMessages } from "@/lib/notebook-ai/messageUtils";
import { ChatMessages } from "./ChatMessages";
import { Composer } from "./Composer";
import { usePanelWidth } from "./usePanelWidth";
import type { AiComposerPayload } from "@/components/editor/ai/composer/referenceLookup";
import type { ChatTransport } from "ai";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";

interface NotebookAiPanelProps {
  notebookId: string;
  onClose: () => void;
}

function formatChatError(error: Error): string {
  const message = error.message?.trim();
  return message || "本轮请求失败，请稍后重试。";
}

export function NotebookAiPanel({ notebookId, onClose }: NotebookAiPanelProps) {
  const { notebooks } = useNotebooks();
  const notebook = notebooks[notebookId];
  const notebookName = notebook?.name ?? "AI 助手";

  const { width, onDragHandleMouseDown } = usePanelWidth();
  const requestCurrentPageIdRef = useRef<string | null>(null);

  // 检查模型是否可用（用于引导文案）
  const modelCheck = buildLanguageModel();

  // 持久化消息
  const persistedMessages = useMemo(
    () => useNotebookAiChats.getState().getMessages(notebookId),
    [notebookId],
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
          messages: sanitizeNotebookAiMessages(options.messages),
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
    id: `notebook-ai-${notebookId}`,
    messages: persistedMessages,
    onFinish: ({ messages: finishedMessages }) => {
      const cleanedMessages = sanitizeNotebookAiMessages(finishedMessages);
      useNotebookAiChats.getState().setMessages(notebookId, cleanedMessages);
      queueMicrotask(() => setMessages(cleanedMessages));
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // 流式写入页面
  useEffect(() => {
    if (!isStreaming) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;

    for (const part of lastMsg.parts ?? []) {
      if (
        part.type === "tool-createPage" ||
        part.type === "tool-updatePage"
      ) {
        void handleStreamingWritePart(part as StreamingWritePart, {
          notebookId,
          currentPageId: requestCurrentPageIdRef.current,
        });
      }
    }
  }, [messages, isStreaming, notebookId]);

  // 组件卸载时清理 writer session
  useEffect(() => {
    return () => {
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.role !== "assistant") return;
      for (const part of lastMsg.parts ?? []) {
        if (
          part.type === "tool-createPage" ||
          part.type === "tool-updatePage"
        ) {
          const toolCallId = (part as Record<string, unknown>).toolCallId as string | undefined;
          if (toolCallId) cleanupWriterSession(toolCallId);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePanelKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.stopPropagation();
      onClose();
    },
    [onClose],
  );

  const unavailableReason = !modelCheck.ok ? modelCheck.reason : undefined;

  const handleSend = useCallback(
    (payload: AiComposerPayload) => {
      if (isStreaming || unavailableReason) return false;

      const displayText = payload.promptText.trim();
      if (!displayText) return false;

      const currentPageId = getCurrentNotebookAiPageId(notebookId);
      requestCurrentPageIdRef.current = currentPageId;

      const { modelText, metadata } = buildNotebookAiUserMessage({
        payload,
        notebookId,
        currentPageId,
      });

      const cleanedMessages = sanitizeNotebookAiMessages(messages);
      if (cleanedMessages !== messages) {
        setMessages(cleanedMessages);
        useNotebookAiChats.getState().setMessages(notebookId, cleanedMessages);
      }

      clearError();
      void sendMessage({ text: modelText, metadata });
      return true;
    },
    [
      isStreaming,
      unavailableReason,
      notebookId,
      messages,
      setMessages,
      clearError,
      sendMessage,
    ],
  );

  const handleClearChat = useCallback(() => {
    if (isStreaming) stop();
    clearError();
    requestCurrentPageIdRef.current = null;
    setMessages([]);
    useNotebookAiChats.getState().clearChat(notebookId);
  }, [isStreaming, stop, clearError, setMessages, notebookId]);

  const searchPages = useCallback(
    (query: string) => getNotebookAiReferenceSuggestions(query, notebookId),
    [notebookId],
  );

  // 获取正在流式的消息 id
  const streamingMessageId =
    isStreaming && messages.length > 0
      ? messages[messages.length - 1].id
      : undefined;

  return (
    <div
      onKeyDown={handlePanelKeyDown}
      className="relative flex h-full flex-col overflow-hidden rounded-[12px] bg-[hsl(var(--goose-editor-bg))]"
      style={{ width }}
    >
      {/* 拖拽手柄 */}
      <div
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-[var(--goose-interactive-hover)]"
        onMouseDown={onDragHandleMouseDown}
        aria-hidden="true"
      />

      {/* 头部 */}
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <Bot className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {notebookName}
        </span>
        <button
          type="button"
          onClick={handleClearChat}
          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-muted-foreground"
          aria-label="清空会话"
          title="清空会话"
          disabled={messages.length === 0 && !isStreaming}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-foreground"
          aria-label="关闭 AI 面板"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* 消息区 / 引导区 */}
      {unavailableReason ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="flex max-w-[260px] flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--goose-interactive-hover)] text-muted-foreground">
              <CircleAlert className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-medium text-foreground">AI 暂不可用</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {unavailableReason}
            </p>
          </div>
        </div>
      ) : (
        <ChatMessages
          messages={messages}
          streamingMessageId={streamingMessageId}
        />
      )}

      {error ? (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-[8px] border border-destructive bg-[hsl(var(--background))] px-3 py-2 text-xs text-destructive">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <div className="font-medium">本轮失败原因</div>
            <div className="mt-0.5 break-words leading-relaxed">
              {formatChatError(error)}
            </div>
          </div>
        </div>
      ) : null}

      {/* 输入框 */}
      <Composer
        onSend={handleSend}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!!unavailableReason}
        placeholder={
          unavailableReason
            ? "请先在设置中配置 AI 模型"
            : "向 AI 提问，输入 @ 引用当前笔记本页面…"
        }
        searchPages={searchPages}
        onEscape={onClose}
      />
    </div>
  );
}
