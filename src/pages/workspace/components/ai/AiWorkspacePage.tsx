import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import MarkdownIt from "markdown-it";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import {
  runAITextStream,
  type AIMessage,
  type AIReasoningLevel,
  type AIStreamPhase,
} from "@/lib/ai-provider";
import { getAIErrorType, trackEvent } from "@/lib/analytics";
import { extractTextFromContent } from "@/lib/content-text-extractor";
import { getPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import type { Page } from "@/types";
import { useSettings } from "@/stores/useSettings";
import { useAiSessions, type AiSession } from "@/stores/useAiSessions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type AiComposerInputHandle,
} from "../editor/ai-composer/AiComposerInput";
import {
  formatAiReferenceContextBlock,
  getAiReferenceStats,
  resolveAiReferenceContexts,
  type AiFileReferenceAttrs,
} from "../editor/ai-composer/referenceLookup";
import { AiWorkspaceComposerBar } from "./AiWorkspaceComposerBar";

// markdown-it 实例：启用表格、linkify，禁止原始 HTML（安全）
const md = new MarkdownIt({ html: false, linkify: true, typographer: false }).enable("table");

const AI_WORKSPACE_SYSTEM_PROMPT =
  "你是 Goose Note 内置 AI 助手。优先结合当前页面和用户 @ 引用的文件内容回答。回答直接给结果，简洁清楚，不要自我介绍。";
const AI_WORKSPACE_DEFAULT_DIAGRAM_URL =
  "https://goose-notion-1257312034.cos.ap-guangzhou.myqcloud.com/AI%20default%20diagram.png";

interface AiWorkspacePageProps {
  page: Page | undefined;
}

interface AiConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  references?: AiFileReferenceAttrs[];
  streaming?: boolean;
  error?: boolean;
}

const STREAM_PHASE_LABEL: Record<AIStreamPhase, string> = {
  connecting: "正在连接模型",
  thinking: "正在整理上下文",
  generating: "正在生成回答",
  finishing: "正在整理结果",
};

function buildCurrentPageContext(page: Page | undefined) {
  if (!page) return "";

  const title = getPageTitle(page);
  const content = extractTextFromContent(page.content).trim();

  return [
    "[当前页面]",
    `标题：${title}`,
    "内容：",
    content || "（空白内容）",
  ].join("\n");
}

function buildUserPrompt(params: {
  promptText: string;
  pageContext: string;
  referenceContext: string;
}) {
  return [
    "用户问题：",
    params.promptText,
    params.pageContext ? `\n${params.pageContext}` : "",
    params.referenceContext
      ? `\n补充上下文（以下是用户通过 @ 引用的文件内容）：\n${params.referenceContext}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 生成新会话 ID */
function genSessionId() {
  return `ai-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 从首条用户消息中提取标题（最多 40 字） */
function extractSessionTitle(messages: AiConversationMessage[]) {
  const first = messages.find((m) => m.role === "user");
  if (!first?.text) return "新对话";
  return first.text.length > 40 ? `${first.text.slice(0, 40)}…` : first.text;
}

/** 格式化时间戳为人类可读文字 */
function formatSessionTime(ts: number) {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

// ── 历史会话下拉面板
interface SessionHistoryPanelProps {
  sessions: AiSession[];
  activeSessionId: string | null;
  onSelectSession: (session: AiSession) => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
}

function SessionHistoryPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onClose,
}: SessionHistoryPanelProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <LucideIcons.History className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-[12px] text-muted-foreground">暂无历史会话</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {sessions.map((session) => (
        <div
          key={session.id}
          className={cn(
            "group flex cursor-pointer items-start gap-2 rounded-[10px] px-2.5 py-2 transition-colors",
            session.id === activeSessionId
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/60",
          )}
          onClick={() => {
            onSelectSession(session);
            onClose();
          }}
        >
          <LucideIcons.MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-foreground">
              {session.title}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {formatSessionTime(session.updatedAt)} · {session.messages.filter((m) => m.role === "user").length} 条提问
            </div>
          </div>
          {/* 删除按钮 */}
          <button
            type="button"
            className="ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSession(session.id);
            }}
          >
            <LucideIcons.X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AiWorkspacePage({ page }: AiWorkspacePageProps) {
  const composerRef = useRef<AiComposerInputHandle | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [messages, setMessages] = useState<AiConversationMessage[]>([]);
  const [streamPhase, setStreamPhase] = useState<AIStreamPhase>("connecting");
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { sessions, activeSessionId, saveSession, setActiveSession, deleteSession } =
    useAiSessions();

  const currentPageContext = useMemo(() => buildCurrentPageContext(page), [page]);

  // ── 切换页面时重置会话
  useEffect(() => {
    setMessages([]);
    setIsStreaming(false);
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    currentSessionIdRef.current = null;
    setActiveSession(null);
    setComposerFocusToken((v) => v + 1);
  }, [page?.id, setActiveSession]);

  // ── 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isStreaming]);

  // ── 卸载时终止流
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
    };
  }, []);

  // ── 加载历史会话
  const handleSelectSession = useCallback(
    (session: AiSession) => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      setIsStreaming(false);
      currentSessionIdRef.current = session.id;
      setActiveSession(session.id);
      setMessages(
        session.messages.map((m) => ({
          ...m,
          streaming: false,
        })),
      );
      setComposerFocusToken((v) => v + 1);
    },
    [setActiveSession],
  );

  // ── 新建会话
  const handleNewSession = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsStreaming(false);
    currentSessionIdRef.current = null;
    setActiveSession(null);
    setMessages([]);
    setComposerFocusToken((v) => v + 1);
    setHistoryOpen(false);
  }, [setActiveSession]);

  const handleReferenceAdded = (reference: AiFileReferenceAttrs) => {
    trackEvent("ai_reference_added", {
      feature: "ai",
      action: "reference_add",
      result: "success",
      source: "ai_page",
      reference_source_type: reference.sourceType,
      reference_scope: "workspace_ai_page",
    });
  };

  const handleSubmit = async (requestOverrides: {
    selectedModelId: string | null;
    reasoningLevel: AIReasoningLevel;
  }) => {
    if (isStreaming) return;

    const payload = composerRef.current?.getPayload() ?? {
      promptText: "",
      freeformText: "",
      references: [],
    };
    const promptText = payload.promptText.trim();
    if (!promptText) return;

    const aiSettings = useSettings.getState().ai;
    const providerType = aiSettings.useCustomProvider
      ? aiSettings.customProtocol
      : "utools";
    const modelId = requestOverrides.selectedModelId ?? aiSettings.selectedModelId ?? "";
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    const controller = new AbortController();
    streamAbortRef.current = controller;

    // 若是新会话，生成 sessionId
    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = genSessionId();
    }

    const userMessageId = `user-${requestId}`;
    const assistantMessageId = `assistant-${requestId}`;
    const referenceContexts = resolveAiReferenceContexts(payload.references);
    const referenceContextBlock = formatAiReferenceContextBlock(referenceContexts);
    const referenceStats = getAiReferenceStats(payload.references);

    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        text: promptText,
        references: payload.references,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        text: "",
        streaming: true,
      },
    ]);
    setIsStreaming(true);
    setStreamPhase("connecting");
    composerRef.current?.clear();
    setComposerFocusToken((v) => v + 1);

    trackEvent("ai_request_submitted", {
      feature: "ai",
      action: "submit",
      result: "submitted",
      source: "ai_page",
      usage_type: "chat",
      usage_bucket: "workspace_chat",
      content_scope: page ? "page_context" : "workspace_only",
      has_selection: false,
      has_custom_query: true,
      query_length: payload.freeformText.trim().length,
      reference_count: referenceStats.referenceCount,
      app_reference_count: referenceStats.appReferenceCount,
      local_reference_count: referenceStats.localReferenceCount,
      provider_type: providerType,
      model_id: modelId,
    });

    if (referenceStats.referenceCount > 0) {
      trackEvent("ai_reference_submitted", {
        feature: "ai",
        action: "reference_submit",
        result: "submitted",
        source: "ai_page",
        reference_count: referenceStats.referenceCount,
        app_reference_count: referenceStats.appReferenceCount,
        local_reference_count: referenceStats.localReferenceCount,
      });
    }

    try {
      const historyMessages = messages
        .filter((message) => !message.streaming)
        .map((message) => ({
          role: message.role,
          content: message.text,
        })) satisfies AIMessage[];

      const assistantText = await runAITextStream(
        useSettings.getState().ai,
        [
          { role: "system", content: AI_WORKSPACE_SYSTEM_PROMPT },
          ...historyMessages,
          {
            role: "user",
            content: buildUserPrompt({
              promptText,
              pageContext: currentPageContext,
              referenceContext: referenceContextBlock,
            }),
          },
        ],
        {
          abortSignal: controller.signal,
          requestOverrides,
          onUpdate: (update) => {
            if (activeRequestIdRef.current !== requestId) return;
            setStreamPhase(update.phase);
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      text: update.text || update.reasoningText,
                    }
                  : message,
              ),
            );
          },
        },
      );

      if (activeRequestIdRef.current !== requestId) return;

      const finalText = assistantText?.trim();
      if (!finalText) {
        throw new Error("AI 没有返回可用内容");
      }

      setMessages((current) => {
        const finalMessages = current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                text: finalText,
                streaming: false,
              }
            : message,
        );

        // ── 持久化：完成后保存会话
        const sessionId = currentSessionIdRef.current;
        if (sessionId) {
          const persistMessages = finalMessages
            .filter((m) => !m.streaming)
            .map(({ id, role, text, references, error }) => ({
              id,
              role,
              text,
              references,
              error,
            }));

          saveSession({
            id: sessionId,
            title: extractSessionTitle(finalMessages),
            pageId: page?.id,
            messages: persistMessages,
          });
        }

        return finalMessages;
      });

      trackEvent("ai_request_succeeded", {
        feature: "ai",
        action: "success",
        result: "success",
        source: "ai_page",
        usage_type: "chat",
        has_selection: false,
        provider_type: providerType,
        model_id: modelId,
        output_length: finalText.length,
      });
    } catch (error) {
      if (controller.signal.aborted) return;

      const errorMessage =
        error instanceof Error ? error.message : "AI 处理失败，请稍后再试";

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                text: errorMessage,
                streaming: false,
                error: true,
              }
            : message,
        ),
      );

      trackEvent("ai_request_failed", {
        feature: "ai",
        action: "fail",
        result: "failed",
        source: "ai_page",
        usage_type: "chat",
        error_type: getAIErrorType(error),
        has_selection: false,
        provider_type: providerType,
        model_id: modelId,
      });
      toast.error(errorMessage);
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsStreaming(false);
        streamAbortRef.current = null;
      }
    }
  };

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--goose-editor-bg))]">

      {/* ── 顶部工具栏：历史 & 新建会话 */}
      <div className="flex shrink-0 items-center justify-end gap-1 px-4 pt-3 pb-1">
        {/* 新建会话 */}
        <button
          type="button"
          title="新建会话"
          onClick={handleNewSession}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <LucideIcons.SquarePen className="h-4 w-4" />
        </button>

        {/* 历史会话 */}
        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="历史会话"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                historyOpen
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <LucideIcons.History className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={6}
            className="w-[300px] rounded-[16px] border border-border/75 bg-popover p-2 shadow-[0_14px_34px_rgba(15,23,42,0.16)]"
          >
            {/* 面板标题 */}
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-foreground/80">历史会话</span>
              {sessions.length > 0 && (
                <span className="text-[10px] text-muted-foreground">{sessions.length} 条</span>
              )}
            </div>
            <div className="max-h-[340px] overflow-y-auto scrollbar-hide">
              <SessionHistoryPanel
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={deleteSession}
                onClose={() => setHistoryOpen(false)}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center pb-10">
            <div
              data-ai-empty-state-card="true"
              className="relative overflow-hidden rounded-[30px] border border-border/70 bg-[#1c2027] shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-90"
                style={{
                  backgroundImage: `url("${AI_WORKSPACE_DEFAULT_DIAGRAM_URL}")`,
                }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,16,24,0.14)_0%,rgba(12,16,24,0.5)_48%,rgba(12,16,24,0.82)_100%)]" />
              <div className="relative flex min-h-[220px] flex-col justify-end px-6 py-7 sm:min-h-[248px] sm:px-7">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-black/20 backdrop-blur-[6px]">
                  <AiGradientIcon className="h-5 w-5" />
                </div>
                <div className="text-base font-medium text-white">
                  在底部输入框直接提问
                </div>
                <div className="mt-2 max-w-xl text-sm leading-6 text-white dark:text-white/72">
                  可以直接问当前页面，也可以通过 @ 引用其他应用页面或本地文件。
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-10">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-[24px] border px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]",
                  message.role === "user"
                    ? "self-end max-w-[85%] border-transparent bg-foreground text-background"
                    : message.error
                      ? "border-destructive/20 bg-destructive/5 text-destructive"
                      : "border-border/70 bg-background/80 text-foreground",
                )}
              >
                {message.role === "assistant" && !message.error ? (
                  message.text ? (
                    <div
                      className="ai-markdown break-words text-sm leading-7"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: md.render(message.text) }}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm leading-7 text-muted-foreground">
                      {message.streaming && (
                        <LucideIcons.LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {message.streaming ? STREAM_PHASE_LABEL[streamPhase] : ""}
                    </div>
                  )
                ) : (
                  <div className="whitespace-pre-wrap break-words text-sm leading-7">
                    {message.text ||
                      (message.streaming ? STREAM_PHASE_LABEL[streamPhase] : "")}
                  </div>
                )}
                {message.references && message.references.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.references.map((reference) => (
                      <span
                        key={`${message.id}-${reference.pageId}`}
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
                          message.role === "user"
                            ? "bg-white/15 text-white/90"
                            : "border border-border/70 bg-muted/60 text-muted-foreground",
                        )}
                      >
                        @{reference.titleSnapshot}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── 底部输入框：全宽，去除多余边距 */}
      <AiWorkspaceComposerBar
        composerRef={composerRef}
        composerFocusToken={composerFocusToken}
        isStreaming={isStreaming}
        onSubmit={(params) => {
          void handleSubmit(params);
        }}
        onReferenceAdded={handleReferenceAdded}
      />
    </div>
  );
}
