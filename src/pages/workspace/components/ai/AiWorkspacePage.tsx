import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import {
  buildAgentPlan,
  commitAgentArtifact,
  executeAgentPlan,
} from "@/agent/core/runtime";
import type {
  AgentArtifact,
  AgentPlan,
  MarkdownNoteArtifact,
} from "@/agent/core/types";
import { AgentArtifactView } from "@/agent/renderers/AgentArtifactView";
import {
  type AIReasoningLevel,
  type AIStreamPhase,
} from "@/lib/ai-provider";
import { getAIErrorType, trackEvent } from "@/lib/analytics";
import { type AiWritePlan } from "@/lib/ai-write";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";
import { useAiSessions, type AiSession } from "@/stores/useAiSessions";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type AiComposerInputHandle,
} from "../editor/ai-composer/AiComposerInput";
import {
  getAiReferenceStats,
  serializeAiComposerDoc,
  type AiFileReferenceAttrs,
} from "../editor/ai-composer/referenceLookup";
import { AiWorkspaceComposerBar } from "./AiWorkspaceComposerBar";

const AI_WORKSPACE_DEFAULT_DIAGRAM_URL =
  "https://goose-notion-1257312034.cos.ap-guangzhou.myqcloud.com/AI%20default%20diagram.png";

interface AiConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  references?: AiFileReferenceAttrs[];
  streaming?: boolean;
  error?: boolean;
  agentPlan?: AgentPlan | null;
  artifact?: AgentArtifact | null;
  writePlan?: AiWritePlan | null;
}

const STREAM_PHASE_LABEL: Record<AIStreamPhase, string> = {
  connecting: "正在连接模型",
  thinking: "正在整理上下文",
  generating: "正在生成回答",
  finishing: "正在整理结果",
};

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

function normalizeMessagesForPersistence(
  messages: AiConversationMessage[],
  streamPhase: AIStreamPhase,
) {
  return messages.map(({
    id,
    role,
    text,
    references,
    error,
    streaming,
    agentPlan,
    artifact,
    writePlan,
  }) => ({
    id,
    role,
    text: text || (streaming ? STREAM_PHASE_LABEL[streamPhase] : ""),
    references,
    error,
    agentPlan,
    artifact,
    writePlan:
      artifact?.type === "markdown_note"
        ? artifact.plan
        : writePlan,
  }));
}

function legacyWritePlanToAgentPlan(writePlan: AiWritePlan | null | undefined): AgentPlan | null {
  if (!writePlan) return null;
  const capabilityId =
    writePlan.action === "append_page"
      ? "note.append"
      : writePlan.action === "replace_page"
        ? "note.replace"
        : "note.create";
  return {
    id: `legacy-plan-${writePlan.action}-${writePlan.previewTitle}`,
    capabilityId,
    artifactType: "markdown_note",
    executionStrategy: "single",
    surface: "workspace",
    promptText: writePlan.promptText,
    systemPrompt: "",
    userPrompt: "",
    intentReason: "legacy_write_plan",
    targetType: writePlan.target.mode,
    resolvedTarget: writePlan.target,
    createdAt: Date.now(),
  };
}

function legacyWritePlanToArtifact(writePlan: AiWritePlan | null | undefined): AgentArtifact | null {
  if (!writePlan) return null;
  return {
    type: "markdown_note",
    plan: writePlan,
  } as MarkdownNoteArtifact;
}

function normalizeConversationMessage<T extends AiConversationMessage>(message: T): T {
  const artifact = message.artifact ?? legacyWritePlanToArtifact(message.writePlan);
  const agentPlan = message.agentPlan ?? legacyWritePlanToAgentPlan(message.writePlan);
  return {
    ...message,
    text:
      artifact?.type === "text_response"
        ? artifact.text
        : message.text,
    agentPlan,
    artifact,
    writePlan:
      artifact?.type === "markdown_note"
        ? artifact.plan
        : message.writePlan,
  };
}

function getLastAgentPlan(messages: AiConversationMessage[]) {
  return (
    messages
      .map((message) => message.agentPlan)
      .filter(Boolean)
      .at(-1) ?? null
  );
}

function getLastArtifact(messages: AiConversationMessage[]) {
  return (
    messages
      .map((message) => message.artifact)
      .filter(Boolean)
      .at(-1) ?? null
  );
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

export function AiWorkspacePage() {
  const composerRef = useRef<AiComposerInputHandle | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const latestMessagesRef = useRef<AiConversationMessage[]>([]);
  const latestStreamPhaseRef = useRef<AIStreamPhase>("connecting");
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(null);

  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [messages, setMessages] = useState<AiConversationMessage[]>([]);
  const [streamPhase, setStreamPhase] = useState<AIStreamPhase>("connecting");
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { activePageId } = usePages();
  const { activeNotebookId } = useNotebooks();
  const { openTab } = useTabs();

  const {
    sessions,
    activeSessionId,
    activeMessages,
    draftContent,
    activeOriginPageId,
    activeOriginNotebookId,
    activeLastWritePlan,
    activeLastAgentPlan,
    activeLastArtifact,
    saveSession,
    setActiveSession,
    setActiveMessages,
    setDraftContent,
    setActiveOrigin,
    setActiveResolvedTarget,
    setActiveLastWritePlan,
    setActiveLastAgentPlan,
    setActiveLastArtifact,
    resetActiveState,
    deleteSession,
  } = useAiSessions();
  const originPageId = activeOriginPageId ?? activePageId;
  const originNotebookId = activeOriginNotebookId ?? activeNotebookId;
  const draftPayload = useMemo(
    () => serializeAiComposerDoc(draftContent),
    [draftContent],
  );

  const syncActiveMessages = useCallback(
    (nextMessages: AiConversationMessage[], phase: AIStreamPhase = streamPhase) => {
      latestMessagesRef.current = nextMessages;
      latestStreamPhaseRef.current = phase;
      setActiveMessages(normalizeMessagesForPersistence(nextMessages, phase));
    },
    [setActiveMessages, streamPhase],
  );

  const persistSessionSnapshot = useCallback(
    (
      nextMessages: AiConversationMessage[],
      options?: {
        plan?: AgentPlan | null;
        artifact?: AgentArtifact | null;
      },
    ) => {
      const snapshot = normalizeMessagesForPersistence(
        nextMessages,
        latestStreamPhaseRef.current,
      );
      const sessionId = currentSessionIdRef.current;
      if (!sessionId || snapshot.length === 0) return;

      saveSession({
        id: sessionId,
        title: extractSessionTitle(nextMessages),
        pageId: undefined,
        originPageId,
        originNotebookId,
        resolvedTarget:
          options?.plan?.resolvedTarget ??
          (options?.artifact?.type === "markdown_note"
            ? options.artifact.plan.target
            : null),
        lastWritePlan:
          options?.artifact?.type === "markdown_note"
            ? options.artifact.plan
            : activeLastWritePlan,
        lastAgentPlan: options?.plan ?? activeLastAgentPlan,
        lastArtifact: options?.artifact ?? activeLastArtifact,
        messages: snapshot,
      });
    },
    [
      activeLastAgentPlan,
      activeLastArtifact,
      activeLastWritePlan,
      originNotebookId,
      originPageId,
      saveSession,
    ],
  );

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    latestStreamPhaseRef.current = streamPhase;
  }, [streamPhase]);

  useEffect(() => {
    const restoredMessages =
      activeMessages.length > 0
        ? activeMessages.map((message) =>
            normalizeConversationMessage({
              ...message,
              streaming: false,
            } as AiConversationMessage),
          )
        : activeSessionId
          ? sessions
              .find((session) => session.id === activeSessionId)
              ?.messages.map((message) =>
                normalizeConversationMessage({
                  ...message,
                  streaming: false,
                } as AiConversationMessage),
              ) ?? []
          : [];

    currentSessionIdRef.current = activeSessionId;
    setMessages(restoredMessages);
    latestMessagesRef.current = restoredMessages;
    if (activeSessionId) {
      const session = sessions.find((item) => item.id === activeSessionId);
      setActiveOrigin({
        pageId: session?.originPageId ?? null,
        notebookId: session?.originNotebookId ?? null,
      });
      setActiveResolvedTarget(session?.resolvedTarget ?? null);
      setActiveLastWritePlan(
        session?.lastWritePlan ??
          (session?.lastArtifact?.type === "markdown_note"
            ? session.lastArtifact.plan
            : null),
      );
      setActiveLastAgentPlan(
        session?.lastAgentPlan ??
          legacyWritePlanToAgentPlan(session?.lastWritePlan ?? null),
      );
      setActiveLastArtifact(
        session?.lastArtifact ??
          legacyWritePlanToArtifact(session?.lastWritePlan ?? null),
      );
    }
  }, [
    activeMessages,
    activeSessionId,
    sessions,
    setActiveLastAgentPlan,
    setActiveLastArtifact,
    setActiveLastWritePlan,
    setActiveOrigin,
    setActiveResolvedTarget,
  ]);

  useEffect(() => {
    if (!activeOriginPageId && activePageId) {
      setActiveOrigin({
        pageId: activePageId,
        notebookId: activeNotebookId,
      });
    }
  }, [activeNotebookId, activeOriginPageId, activePageId, setActiveOrigin]);

  // ── 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isStreaming]);

  // ── 卸载时终止流
  useEffect(() => {
    return () => {
      const snapshot = normalizeMessagesForPersistence(
        latestMessagesRef.current,
        latestStreamPhaseRef.current,
      );

      streamAbortRef.current?.abort();
      streamAbortRef.current = null;

      setActiveMessages(snapshot);

      persistSessionSnapshot(latestMessagesRef.current, {
        plan: activeLastAgentPlan,
        artifact: activeLastArtifact,
      });
    };
  }, [
    activeLastAgentPlan,
    activeLastArtifact,
    activeLastWritePlan,
    persistSessionSnapshot,
    setActiveMessages,
  ]);

  const cancelActiveRequest = useCallback(() => {
    activeRequestIdRef.current += 1;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsStreaming(false);
    setStreamPhase("connecting");
  }, []);

  // ── 加载历史会话
  const handleSelectSession = useCallback(
    (session: AiSession) => {
      cancelActiveRequest();
      currentSessionIdRef.current = session.id;
      setActiveSession(session.id);
      setActiveOrigin({
        pageId: session.originPageId ?? null,
        notebookId: session.originNotebookId ?? null,
      });
      setActiveResolvedTarget(session.resolvedTarget ?? null);
      setActiveLastWritePlan(
        session.lastWritePlan ??
          (session.lastArtifact?.type === "markdown_note"
            ? session.lastArtifact.plan
            : null),
      );
      setActiveLastAgentPlan(
        session.lastAgentPlan ??
          legacyWritePlanToAgentPlan(session.lastWritePlan ?? null),
      );
      setActiveLastArtifact(
        session.lastArtifact ??
          legacyWritePlanToArtifact(session.lastWritePlan ?? null),
      );
      const restoredMessages = session.messages.map((m) =>
        normalizeConversationMessage({
          ...m,
          streaming: false,
        } as AiConversationMessage),
      );
      setMessages(restoredMessages);
      syncActiveMessages(restoredMessages, "connecting");
      setComposerFocusToken((v) => v + 1);
    },
    [
      cancelActiveRequest,
      setActiveLastAgentPlan,
      setActiveLastArtifact,
      setActiveLastWritePlan,
      setActiveSession,
      syncActiveMessages,
    ],
  );

  // ── 新建会话
  const handleNewSession = useCallback(() => {
    cancelActiveRequest();
    currentSessionIdRef.current = null;
    latestMessagesRef.current = [];
    latestStreamPhaseRef.current = "connecting";
    composerRef.current?.clear();
    setMessages([]);
    resetActiveState({
      pageId: activePageId ?? null,
      notebookId: activeNotebookId ?? null,
    });
    setComposerFocusToken((v) => v + 1);
    setHistoryOpen(false);
  }, [
    activeNotebookId,
    activePageId,
    cancelActiveRequest,
    resetActiveState,
  ]);

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
      tokens: [],
    };
    const promptText = payload.promptText.trim();
    if (!promptText) return;
    const agentContext = {
      surface: "workspace" as const,
      payload,
      originPageId,
      originNotebookId,
    };
    const planning = buildAgentPlan(agentContext);
    const submitPlan = planning.plan ?? null;
    const submitArtifact = planning.artifact ?? null;
    const submitTarget = submitPlan?.resolvedTarget ?? null;
    const capabilityId = planning.intent.capabilityId;
    const artifactType = planning.intent.artifactType;

    trackEvent("agent_capability_matched", {
      feature: "agent_runtime",
      capability_id: capabilityId,
      artifact_type: artifactType,
      target_type: planning.intent.targetType,
    });

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
    const referenceStats = getAiReferenceStats(payload.references);
    setActiveResolvedTarget(submitTarget);

    setMessages((current) => {
      const nextMessages = [
        ...current,
        {
          id: userMessageId,
          role: "user" as const,
          text: promptText,
          references: payload.references,
        },
        {
          id: assistantMessageId,
          role: "assistant" as const,
          text:
            submitArtifact?.type === "text_response"
              ? submitArtifact.text
              : "",
          streaming: Boolean(submitPlan),
          error: submitArtifact?.type === "text_response" && submitArtifact.error,
          agentPlan: submitPlan,
          artifact: submitArtifact,
          writePlan:
            submitArtifact?.type === "markdown_note"
              ? submitArtifact.plan
              : null,
        },
      ];
      syncActiveMessages(nextMessages, "connecting");
      if (submitArtifact) {
        const latestWritePlan =
          submitArtifact.type === "markdown_note" ? submitArtifact.plan : null;
        setActiveLastWritePlan(latestWritePlan);
        setActiveLastAgentPlan(submitPlan);
        setActiveLastArtifact(submitArtifact);
        persistSessionSnapshot(nextMessages, {
          plan: submitPlan,
          artifact: submitArtifact,
        });
      }
      return nextMessages;
    });
    setIsStreaming(Boolean(submitPlan));
    setStreamPhase("connecting");
    composerRef.current?.clear();
    setDraftContent(null);
    setComposerFocusToken((v) => v + 1);

    trackEvent("ai_request_submitted", {
      feature: "ai",
      action: "submit",
      result: "submitted",
      source: "ai_page",
      usage_type: artifactType === "markdown_note" ? "write_preview" : "chat",
      usage_bucket:
        artifactType === "markdown_note"
          ? "workspace_write"
          : "workspace_chat",
      content_scope:
        submitTarget?.mode ??
        planning.intent.targetType,
      has_selection: false,
      has_custom_query: true,
      query_length: payload.freeformText.trim().length,
      reference_count: referenceStats.referenceCount,
      app_reference_count: referenceStats.appReferenceCount,
      local_reference_count: referenceStats.localReferenceCount,
      provider_type: providerType,
      model_id: modelId,
      write_action: submitTarget?.action ?? "chat_only",
      target_type:
        submitTarget?.mode ??
        planning.intent.targetType,
      capability_id: capabilityId,
      artifact_type: artifactType,
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

    if (!submitPlan) {
      if (submitArtifact) {
        trackEvent("agent_artifact_rendered", {
          feature: "agent_runtime",
          capability_id: capabilityId,
          artifact_type: submitArtifact.type,
          target_type: planning.intent.targetType,
        });
      }
      return;
    }

    trackEvent("agent_plan_built", {
      feature: "agent_runtime",
      capability_id: capabilityId,
      artifact_type: submitPlan.artifactType,
      target_type: submitPlan.targetType,
    });

    try {
      const historyMessages = messages
        .filter((message) => !message.streaming)
        .map((message) => ({
          role: message.role,
          content:
            message.artifact?.type === "markdown_note"
              ? message.artifact.plan.outputMarkdown
              : message.artifact?.type === "text_response"
                ? message.artifact.text
                : message.text,
        }));

      const result = await executeAgentPlan({
        settings: useSettings.getState().ai,
        plan: submitPlan,
        context: agentContext,
        parsed: planning.parsed,
        requestOverrides,
        abortSignal: controller.signal,
        historyMessages,
        onUpdate: (update) => {
          if (activeRequestIdRef.current !== requestId) return;
          setStreamPhase(update.phase);
          setMessages((current) => {
            const nextMessages = current.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    text: update.text || update.reasoningText,
                  }
                : message,
            );
            syncActiveMessages(nextMessages, update.phase);
            return nextMessages;
          });
        },
      });

      if (activeRequestIdRef.current !== requestId) return;

      const finalText =
        result.artifact.type === "text_response"
          ? result.artifact.text
          : result.rawText;

      setMessages((current) => {
        const finalMessages = current.map((message) =>
          message.id === assistantMessageId
            ? normalizeConversationMessage({
                ...message,
                text:
                  result.artifact.type === "text_response"
                    ? result.artifact.text
                    : "已生成写入预览，确认后会落到目标页面。",
                streaming: false,
                error:
                  result.artifact.type === "text_response" &&
                  Boolean(result.artifact.error),
                agentPlan: result.plan,
                artifact: result.artifact,
                writePlan:
                  result.artifact.type === "markdown_note"
                    ? result.artifact.plan
                    : null,
              })
            : message,
        );
        syncActiveMessages(finalMessages, "finishing");
        setActiveLastWritePlan(
          result.artifact.type === "markdown_note"
            ? result.artifact.plan
            : null,
        );
        setActiveLastAgentPlan(result.plan);
        setActiveLastArtifact(result.artifact);
        persistSessionSnapshot(finalMessages, {
          plan: result.plan,
          artifact: result.artifact,
        });

        return finalMessages;
      });

      trackEvent("ai_request_succeeded", {
        feature: "ai",
        action: "success",
        result: "success",
        source: "ai_page",
        usage_type: artifactType === "markdown_note" ? "write_preview" : "chat",
        has_selection: false,
        provider_type: providerType,
        model_id: modelId,
        output_length: finalText.length,
      });

      trackEvent("agent_artifact_rendered", {
        feature: "agent_runtime",
        capability_id: result.plan.capabilityId,
        artifact_type: result.artifact.type,
        target_type: result.plan.targetType,
      });

      if (result.artifact.type === "markdown_note") {
        trackEvent("ai_write_previewed", {
          feature: "ai_write",
          action: "preview",
          write_action: result.artifact.plan.action,
          target_type: result.artifact.plan.target.mode,
          is_local_folder: Boolean(result.artifact.plan.target.isLocalFolder),
          cross_notebook: Boolean(
            result.artifact.plan.target.workspaceId &&
              activeNotebookId &&
              result.artifact.plan.target.workspaceId !== activeNotebookId,
          ),
        });
      }
    } catch (error) {
      if (controller.signal.aborted || activeRequestIdRef.current !== requestId) return;

      const errorMessage =
        error instanceof Error ? error.message : "AI 处理失败，请稍后再试";

      setMessages((current) =>
        {
          const nextMessages = current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  text: errorMessage,
                  streaming: false,
                  error: true,
                  artifact: {
                    type: "text_response",
                    text: errorMessage,
                    error: true,
                  } as AgentArtifact,
                }
              : message,
          );
          syncActiveMessages(nextMessages, latestStreamPhaseRef.current);
          return nextMessages;
        },
      );

      trackEvent("ai_request_failed", {
        feature: "ai",
        action: "fail",
        result: "failed",
        source: "ai_page",
        usage_type: artifactType === "markdown_note" ? "write_preview" : "chat",
        error_type: getAIErrorType(error),
        has_selection: false,
        provider_type: providerType,
        model_id: modelId,
        capability_id: capabilityId,
      });
      toast.error(errorMessage);
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsStreaming(false);
        streamAbortRef.current = null;
      }
    }
  };

  const updateMessageArtifact = useCallback(
    (
      messageId: string,
      updater: (artifact: MarkdownNoteArtifact) => MarkdownNoteArtifact,
    ) => {
      setMessages((current) => {
        const nextMessages = current.map((message) => {
          if (message.id !== messageId || message.artifact?.type !== "markdown_note") {
            return message;
          }

          const nextArtifact = updater(message.artifact);
          return normalizeConversationMessage({
            ...message,
            artifact: nextArtifact,
            writePlan: nextArtifact.plan,
          });
        });
        syncActiveMessages(nextMessages, latestStreamPhaseRef.current);
        const latestPlan = getLastAgentPlan(nextMessages);
        const latestArtifact = getLastArtifact(nextMessages);
        setActiveLastWritePlan(
          latestArtifact?.type === "markdown_note"
            ? latestArtifact.plan
            : null,
        );
        setActiveLastAgentPlan(latestPlan);
        setActiveLastArtifact(latestArtifact);
        persistSessionSnapshot(nextMessages, {
          plan: latestPlan,
          artifact: latestArtifact,
        });
        return nextMessages;
      });
    },
    [
      persistSessionSnapshot,
      setActiveLastAgentPlan,
      setActiveLastArtifact,
      setActiveLastWritePlan,
      syncActiveMessages,
    ],
  );

  const handleConfirmWrite = useCallback(
    async (messageId: string, artifact: MarkdownNoteArtifact) => {
      setApplyingMessageId(messageId);
      trackEvent("agent_commit_confirmed", {
        feature: "agent_runtime",
        capability_id: "note.commit",
        artifact_type: artifact.type,
        target_type: artifact.plan.target.mode,
      });
      trackEvent("ai_write_confirmed", {
        feature: "ai_write",
        action: "confirm",
        write_action: artifact.plan.action,
        target_type: artifact.plan.target.mode,
        is_local_folder: Boolean(artifact.plan.target.isLocalFolder),
        cross_notebook: Boolean(
          artifact.plan.target.workspaceId &&
            activeNotebookId &&
            artifact.plan.target.workspaceId !== activeNotebookId,
        ),
      });

      try {
        const result = await commitAgentArtifact(artifact);
        if (!result?.pageId) {
          throw new Error("写入失败，请稍后再试");
        }

        updateMessageArtifact(messageId, (currentArtifact) => ({
          ...currentArtifact,
          plan: {
            ...currentArtifact.plan,
            status: "committed",
            committedPageId: result.pageId,
          },
        }));

        trackEvent("agent_commit_succeeded", {
          feature: "agent_runtime",
          capability_id: "note.commit",
          artifact_type: artifact.type,
          target_type: artifact.plan.target.mode,
        });
        trackEvent("ai_write_committed", {
          feature: "ai_write",
          action: "commit",
          result: "success",
          write_action: artifact.plan.action,
          target_type: artifact.plan.target.mode,
          is_local_folder: Boolean(artifact.plan.target.isLocalFolder),
          cross_notebook: Boolean(
            artifact.plan.target.workspaceId &&
              activeNotebookId &&
              artifact.plan.target.workspaceId !== activeNotebookId,
          ),
        });
        toast.success("已写入目标页面");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "写入失败，请稍后再试";
        toast.error(message);
      } finally {
        setApplyingMessageId(null);
      }
    },
    [activeNotebookId, updateMessageArtifact],
  );

  const handleCancelWrite = useCallback(
    (messageId: string, artifact: MarkdownNoteArtifact) => {
      updateMessageArtifact(messageId, (currentArtifact) => ({
        ...currentArtifact,
        plan: {
          ...currentArtifact.plan,
          status: "cancelled",
        },
      }));
      trackEvent("agent_commit_cancelled", {
        feature: "agent_runtime",
        capability_id: "note.commit",
        artifact_type: artifact.type,
        target_type: artifact.plan.target.mode,
      });
      trackEvent("ai_write_cancelled", {
        feature: "ai_write",
        action: "cancel",
        write_action: artifact.plan.action,
        target_type: artifact.plan.target.mode,
        is_local_folder: Boolean(artifact.plan.target.isLocalFolder),
        cross_notebook: Boolean(
          artifact.plan.target.workspaceId &&
            activeNotebookId &&
            artifact.plan.target.workspaceId !== activeNotebookId,
        ),
      });
    },
    [activeNotebookId, updateMessageArtifact],
  );

  const handleOpenResultPage = useCallback(
    (pageId: string) => {
      openTab(pageId);
      usePages.getState().setExpandPageId(pageId);
    },
    [openTab],
  );

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
                  可以直接发起独立聊天，也可以通过 @ 引用应用页面或本地文件。
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
                  message.artifact ? (
                    <AgentArtifactView
                      artifact={message.artifact}
                      applying={applyingMessageId === message.id}
                      onConfirmMarkdownNote={(artifact) => {
                        void handleConfirmWrite(message.id, artifact);
                      }}
                      onCancelMarkdownNote={(artifact) => {
                        handleCancelWrite(message.id, artifact);
                      }}
                      onOpenResult={handleOpenResultPage}
                    />
                  ) : message.text ? (
                    <div className="whitespace-pre-wrap break-words text-sm leading-7">
                      {message.text}
                    </div>
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
        draftContent={draftContent}
        onSubmit={(params) => {
          void handleSubmit(params);
        }}
        onDraftChange={setDraftContent}
        onReferenceAdded={handleReferenceAdded}
      />
    </div>
  );
}
