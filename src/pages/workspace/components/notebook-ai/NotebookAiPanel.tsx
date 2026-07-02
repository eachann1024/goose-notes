/**
 * NotebookAiPanel — AI 聊天面板（右侧并排，可拖宽）
 *
 * - useChat（@ai-sdk/react）+ buildTransport(notebookId)
 * - 会话按 notebookId 隔离持久化（useNotebookAiChats）
 * - 切换笔记本切换会话
 * - Esc 关闭（仅面板聚焦时）
 * - 流式写入页面：handleStreamingWritePart + cleanupWriterSession
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { X, Trash2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotebooks } from "@/stores/useNotebooks";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import { buildTransport } from "@/lib/notebook-ai/transport";
import {
  handleStreamingWritePart,
  cleanupWriterSession,
  type StreamingWritePart,
} from "@/lib/notebook-ai/liveWriter";
import { buildLanguageModel } from "@/lib/notebook-ai/model";
import { ChatMessages } from "./ChatMessages";
import { Composer } from "./Composer";
import { usePanelWidth } from "./usePanelWidth";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";

interface NotebookAiPanelProps {
  notebookId: string;
  onClose: () => void;
}

export function NotebookAiPanel({ notebookId, onClose }: NotebookAiPanelProps) {
  const { notebooks } = useNotebooks();
  const notebook = notebooks[notebookId];
  const notebookName = notebook?.name ?? "AI 助手";

  const { width, onDragHandleMouseDown } = usePanelWidth();
  const panelRef = useRef<HTMLDivElement>(null);

  // 检查模型是否可用（用于引导文案）
  const modelCheck = buildLanguageModel();

  // 持久化消息
  const persistedMessages = useNotebookAiChats.getState().getMessages(notebookId);

  // 每次发送前重建 transport（保证 system prompt 最新）
  const getTransport = useCallback(() => {
    return buildTransport(notebookId);
  }, [notebookId]);

  const [inputValue, setInputValue] = useState("");
  const transportRef = useRef(getTransport());

  // 切换笔记本时重置 transport
  useEffect(() => {
    transportRef.current = getTransport();
  }, [notebookId, getTransport]);

  const transportResult = transportRef.current;

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
  } = useChat({
    transport: transportResult.ok ? transportResult.transport : (null as never),
    id: `notebook-ai-${notebookId}`,
    messages: persistedMessages as NotebookAiMessage[],
    onFinish: ({ messages: finishedMessages }) => {
      useNotebookAiChats.getState().setMessages(
        notebookId,
        finishedMessages as NotebookAiMessage[],
      );
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

  // Esc 关闭面板（仅面板内聚焦时）
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        // 只有面板内元素获取焦点时才关闭
        if (panel.contains(document.activeElement)) {
          e.stopPropagation();
          onClose();
        }
      }
    };
    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    // 每次发送前重建 transport（确保 system prompt 最新）
    transportRef.current = getTransport();
    const newTransport = transportRef.current;
    if (!newTransport.ok) return;

    setInputValue("");
    void sendMessage({ text });
  }, [inputValue, isStreaming, sendMessage, getTransport]);

  const handleClearChat = useCallback(() => {
    if (isStreaming) stop();
    setMessages([]);
    useNotebookAiChats.getState().clearChat(notebookId);
  }, [isStreaming, stop, setMessages, notebookId]);

  // 获取正在流式的消息 id
  const streamingMessageId =
    isStreaming && messages.length > 0
      ? messages[messages.length - 1].id
      : undefined;

  // 无法使用时的引导内容
  const unavailableReason = !transportResult.ok
    ? transportResult.reason
    : !modelCheck.ok
      ? modelCheck.reason
      : undefined;

  return (
    <div
      ref={panelRef}
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
          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-muted-foreground transition-colors"
          aria-label="清空会话"
          title="清空会话"
          disabled={messages.length === 0 && !isStreaming}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-foreground transition-colors"
          aria-label="关闭 AI 面板"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* 消息区 / 引导区 */}
      {unavailableReason ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-center text-sm text-muted-foreground leading-relaxed">
            {unavailableReason}
          </p>
        </div>
      ) : (
        <ChatMessages
          messages={messages as NotebookAiMessage[]}
          streamingMessageId={streamingMessageId}
        />
      )}

      {/* 输入框 */}
      <Composer
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={!!unavailableReason}
        placeholder={unavailableReason ? "请先在设置中配置 AI 模型" : undefined}
      />
    </div>
  );
}
