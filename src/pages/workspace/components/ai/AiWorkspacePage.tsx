import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import {
  buildAgentPlan,
  commitAgentArtifact,
  executeAgentPlan,
} from "@/agent/core/runtime";
import { buildWorkspaceIntentRouterDeps } from "@/agent/core/routerDeps";
import type {
  AgentArtifact,
  AgentPlan,
  MarkdownNoteArtifact,
} from "@/agent/core/types";
import { AgentArtifactView, StreamingDatavizText, textHasDataviz, artifactHasDataviz } from "@/agent/renderers/AgentArtifactView";
import {
  type AIMessage,
  type AIStreamPhase,
} from "@/lib/ai-provider";
import { getAIErrorType, trackEvent } from "@/lib/analytics";
import {
  createStickyTargetFromResolvedTarget,
  resolvedTargetToSelection,
  type AiWritePlan,
} from "@/lib/ai-write";
import { cn } from "@/lib/utils";
import {
  EDITOR_FONT_SIZE_DEFAULT,
  useSettings,
} from "@/stores/useSettings";
import { useAiSessions, type AiSession, type AiSessionMessage } from "@/stores/useAiSessions";
import { useAiStatus } from "@/stores/useAiStatus";
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
import { CLOSE_AI_WORKSPACE_EVENT } from "./events";

const AI_WORKSPACE_DEFAULT_DIAGRAM_URL =
  "https://goose-notion-1257312034.cos.ap-guangzhou.myqcloud.com/AI%20default%20diagram.png";

interface AiConversationMessage extends AiSessionMessage {
  streaming?: boolean;
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
      : writePlan.action === "replace_page" ||
          writePlan.action === "replace_block_range"
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

  // 运行时类型检查：确保 text 始终是字符串，防止 localStorage 数据损坏导致对象被渲染为 React child
  let text = message.text;
  if (artifact?.type === "text_response") {
    text = typeof artifact.text === "string" ? artifact.text : "";
  } else {
    text = typeof message.text === "string" ? message.text : "";
  }

  return {
    ...message,
    text,
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
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  // 用于智能自动滚动：记录用户是否已主动上滚
  const userScrolledUpRef = useRef(false);
  const activeRequestIdRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const latestMessagesRef = useRef<AiConversationMessage[]>([]);
  const latestStreamPhaseRef = useRef<AIStreamPhase>("connecting");
  // RAF throttle refs for streaming updates
  const streamingAccRef = useRef<{ text: string; phase: AIStreamPhase }>({ text: "", phase: "connecting" });
  const streamingRafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  // Stable refs for unmount cleanup — avoids re-registering cleanup on every plan/artifact change
  const persistSessionSnapshotRef = useRef<typeof persistSessionSnapshot | null>(null);
  const activeLastAgentPlanRef = useRef<AgentPlan | null>(null);
  const activeLastArtifactRef = useRef<AgentArtifact | null>(null);
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(null);
  // Retry: store last submitted payload and model overrides
  const lastSubmitPayloadRef = useRef<import("../editor/ai-composer/referenceLookup").AiComposerPayload | null>(null);
  const lastSubmitOverridesRef = useRef<{ selectedModelId: string | null } | null>(null);

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

  const editorFontSize = useSettings((s) => s.editorFontSize);
  const aiWorkspaceScale = editorFontSize / EDITOR_FONT_SIZE_DEFAULT;

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

  // Keep refs in sync so the unmount cleanup can access the latest values
  // without being re-registered every time these change (which would cause
  // the cleanup to fire prematurely and trigger an infinite setState loop).
  useEffect(() => {
    persistSessionSnapshotRef.current = persistSessionSnapshot;
  }, [persistSessionSnapshot]);
  useEffect(() => {
    activeLastAgentPlanRef.current = activeLastAgentPlan;
  }, [activeLastAgentPlan]);
  useEffect(() => {
    activeLastArtifactRef.current = activeLastArtifact;
  }, [activeLastArtifact]);

  useEffect(() => {
    // Guard: do not overwrite local messages state while a stream is active.
    // syncActiveMessages → setActiveMessages would otherwise trigger this effect and
    // reset all message.streaming flags to false, causing a false "未收到响应" flash.
    if (isStreaming) return;
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
    isStreaming,
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

  // ── 智能自动滚动：用户上滚时不打断，新消息发出时强制滚底
  const isAutoScrollingRef = useRef(false);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (isAutoScrollingRef.current) return;
      const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;
      userScrolledUpRef.current = !nearBottom;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      isAutoScrollingRef.current = true;
      messagesEndRef.current?.scrollIntoView({ block: "end" });
      // scrollIntoView 是同步的，但 scroll 事件在下一微任务才触发，用 rAF 安全恢复
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false;
      });
    }
  }, [messages, isStreaming]);

  // ── 卸载时终止流
  // 使用 [] 依赖（仅卸载时执行），通过 refs 读取最新值，
  // 避免每次 activeLastAgentPlan / persistSessionSnapshot 变化时提前触发 cleanup，
  // 从而防止 cleanup → setActiveMessages → restore effect → setActiveLastAgentPlan → cleanup 的无限循环。
  useEffect(() => {
    return () => {
      const snapshot = normalizeMessagesForPersistence(
        latestMessagesRef.current,
        latestStreamPhaseRef.current,
      );

      streamAbortRef.current?.abort();
      streamAbortRef.current = null;

      setActiveMessages(snapshot);

      persistSessionSnapshotRef.current?.(latestMessagesRef.current, {
        plan: activeLastAgentPlanRef.current,
        artifact: activeLastArtifactRef.current,
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelActiveRequest = useCallback(() => {
    activeRequestIdRef.current += 1;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsStreaming(false);
    setStreamPhase("connecting");
    useAiStatus.getState().finishStreaming({ celebrate: false });
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

  const handleSubmit = async (
    requestOverrides: {
      selectedModelId: string | null;
    },
    payloadOverride?: import("../editor/ai-composer/referenceLookup").AiComposerPayload,
  ) => {
    if (isStreaming) return;

    const payload = payloadOverride ?? composerRef.current?.getPayload() ?? {
      promptText: "",
      freeformText: "",
      references: [],
      tokens: [],
    };
    const promptText = payload.promptText.trim();
    if (!promptText) return;

    // 仅非重试时更新 retry refs
    if (!payloadOverride) {
      lastSubmitPayloadRef.current = payload;
      lastSubmitOverridesRef.current = requestOverrides;
    }

    setIsStreaming(true);
    setStreamPhase("connecting");
    useAiStatus.getState().beginStreaming();
    let streamSucceeded = false;
    // 新消息发出时重置上滚标记，强制滚到底部
    userScrolledUpRef.current = false;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = genSessionId();
    }

    const userMessageId = `user-${requestId}`;
    const assistantMessageId = `assistant-${requestId}`;

    const previousMessages = latestMessagesRef.current;

    // ── 在 setMessages updater 外构建消息并同步 Zustand，避免 React error #185
    const initMessages: AiConversationMessage[] = [
      ...latestMessagesRef.current,
      { id: userMessageId, role: "user" as const, text: promptText, references: payload.references },
      { id: assistantMessageId, role: "assistant" as const, text: "", streaming: true, error: false, agentPlan: null, artifact: null, writePlan: null },
    ];
    latestMessagesRef.current = initMessages;
    setMessages(initMessages);
    syncActiveMessages(initMessages, "connecting");

    // 重试时不清空 composer（composer 本身没有内容）
    if (!payloadOverride) {
      composerRef.current?.clear();
      setDraftContent(null);
    }
    setComposerFocusToken((v) => v + 1);

    const aiSettings = useSettings.getState().ai;
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const requestStartedAt = Date.now();
    const providerType = aiSettings.useCustomProvider ? aiSettings.customProtocol : "utools";
    const modelId = requestOverrides.selectedModelId ?? aiSettings.selectedModelId ?? "";

    // 重置流式累积器，取消旧的待执行 RAF
    streamingAccRef.current = { text: "", phase: "connecting" };
    if (streamingRafRef.current !== null) {
      cancelAnimationFrame(streamingRafRef.current);
      streamingRafRef.current = null;
    }

    const historyMessages: AIMessage[] = previousMessages
      .filter((m) => !m.streaming && (m.text?.trim() || m.artifact?.type === "text_response"))
      .reduce<AIMessage[]>((acc, m) => {
        if (m.role === "user" && m.text?.trim()) {
          acc.push({ role: "user", content: m.text });
        } else if (m.role === "assistant") {
          const text = m.artifact?.type === "text_response" ? m.artifact.text : m.text;
          if (text?.trim()) acc.push({ role: "assistant", content: text.trim() });
        }
        return acc;
      }, []);

    try {
      const stickyTarget = activeLastWritePlan
        ? createStickyTargetFromResolvedTarget(activeLastWritePlan.target)
        : null;
      const recentWriteTarget = activeLastWritePlan
        ? resolvedTargetToSelection(activeLastWritePlan.target)
        : null;
      const agentContext = {
        surface: "workspace" as const,
        payload,
        originPageId,
        originNotebookId,
        stickyTarget,
        recentWriteTarget,
      };

      const planning = await buildAgentPlan(
        agentContext,
        buildWorkspaceIntentRouterDeps({
          settings: aiSettings,
          messages: previousMessages,
          originPageId,
          originNotebookId,
          lastArtifact: activeLastArtifactRef.current,
        }),
      );
      if (activeRequestIdRef.current !== requestId) return;

      trackEvent("ai_request_submitted", {
        feature: "ai",
        action: "submit",
        result: "submitted",
        source: "ai_workspace",
        provider_type: providerType,
        model_id: modelId,
        capability_id: planning.intent?.capabilityId,
        has_reference: payload.references.length > 0,
      });

      if (!planning.plan) {
        const immediateArtifact: AgentArtifact = {
          type: "text_response",
          text: planning.artifact?.type === "text_response"
            ? planning.artifact.text.trim() || "暂无响应"
            : "暂无响应",
        };
        const idx = latestMessagesRef.current.findIndex((m) => m.id === assistantMessageId);
        if (idx !== -1) {
          const nextMsgs = [...latestMessagesRef.current];
          nextMsgs[idx] = { ...nextMsgs[idx], streaming: false, artifact: immediateArtifact };
          latestMessagesRef.current = nextMsgs;
          setMessages(nextMsgs);
          syncActiveMessages(nextMsgs, "finishing");
          persistSessionSnapshot(nextMsgs, { plan: null, artifact: immediateArtifact });
        }
        setIsStreaming(false);
        setStreamPhase("connecting");
        streamAbortRef.current = null;
        streamSucceeded = true;
        return;
      }

      const result = await executeAgentPlan({
        settings: aiSettings,
        plan: planning.plan,
        context: agentContext,
        parsed: planning.parsed,
        historyMessages,
        requestOverrides: {
          selectedModelId: requestOverrides.selectedModelId,
        },
        abortSignal: controller.signal,
        // RAF 节流：只更新内存累积值，每帧最多一次 setMessages，且不在 updater 内调用 Zustand
        onUpdate: (update: { phase: AIStreamPhase; text: string }) => {
          if (activeRequestIdRef.current !== requestId) return;
          streamingAccRef.current = { text: update.text, phase: update.phase };
          if (streamingRafRef.current === null) {
            streamingRafRef.current = requestAnimationFrame(() => {
              streamingRafRef.current = null;
              if (activeRequestIdRef.current !== requestId) return;
              const { text, phase } = streamingAccRef.current;
              setStreamPhase(phase);
              setMessages((current) => {
                const i = current.findIndex((m) => m.id === assistantMessageId);
                if (i === -1) return current;
                const next = [...current];
                next[i] = { ...next[i], text };
                return next;
              });
            });
          }
        },
      });

      if (activeRequestIdRef.current !== requestId) return;

      // 取消未执行的 RAF，确保使用最终文本
      if (streamingRafRef.current !== null) {
        cancelAnimationFrame(streamingRafRef.current);
        streamingRafRef.current = null;
      }
      const finalText = streamingAccRef.current.text;

      trackEvent("ai_request_succeeded", {
        feature: "ai",
        action: "success",
        result: "success",
        source: "ai_workspace",
        duration_ms: Date.now() - requestStartedAt,
        provider_type: providerType,
        model_id: modelId,
        capability_id: result.plan.capabilityId,
      });

      const idxSuccess = latestMessagesRef.current.findIndex((m) => m.id === assistantMessageId);
      if (idxSuccess !== -1) {
        const nextMsgsSuccess = [...latestMessagesRef.current];
        nextMsgsSuccess[idxSuccess] = {
          ...nextMsgsSuccess[idxSuccess],
          text: finalText,
          streaming: false,
          artifact: result.artifact,
          agentPlan: result.plan,
        };
        latestMessagesRef.current = nextMsgsSuccess;
        setMessages(nextMsgsSuccess);
        syncActiveMessages(nextMsgsSuccess, "finishing");
        persistSessionSnapshot(nextMsgsSuccess, { plan: result.plan, artifact: result.artifact });
      }

      setActiveLastAgentPlan(result.plan);
      setActiveLastArtifact(result.artifact);
      if (result.artifact.type === "markdown_note") {
        setActiveLastWritePlan(result.artifact.plan);
      }
      streamSucceeded = true;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (activeRequestIdRef.current !== requestId) return;

      if (streamingRafRef.current !== null) {
        cancelAnimationFrame(streamingRafRef.current);
        streamingRafRef.current = null;
      }

      const errMsg = err instanceof Error ? err.message : "请求失败，请重试";
      trackEvent("ai_request_failed", {
        feature: "ai",
        action: "fail",
        result: "failed",
        source: "ai_workspace",
        error_type: getAIErrorType(err),
        duration_ms: Date.now() - requestStartedAt,
        provider_type: providerType,
        model_id: modelId,
      });

      const idxErr = latestMessagesRef.current.findIndex((m) => m.id === assistantMessageId);
      if (idxErr !== -1) {
        const nextMsgsErr = [...latestMessagesRef.current];
        nextMsgsErr[idxErr] = { ...nextMsgsErr[idxErr], text: errMsg, streaming: false, error: true };
        latestMessagesRef.current = nextMsgsErr;
        setMessages(nextMsgsErr);
        syncActiveMessages(nextMsgsErr, "connecting");
        persistSessionSnapshot(nextMsgsErr);
      }
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsStreaming(false);
        setStreamPhase("connecting");
        streamAbortRef.current = null;
        useAiStatus.getState().finishStreaming({ celebrate: streamSucceeded });
      }
    }
  };

  const updateMessageArtifact = useCallback(
    (
      messageId: string,
      updater: (artifact: MarkdownNoteArtifact) => MarkdownNoteArtifact,
    ) => {
      // Compute next messages from the latest ref to avoid stale closures,
      // then call all state setters OUTSIDE the setMessages updater (React rule:
      // no side effects / nested setState inside an updater function).
      const current = latestMessagesRef.current;
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
      latestMessagesRef.current = nextMessages;
      setMessages(nextMessages);
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

  const handleRetry = useCallback(() => {
    if (isStreaming || !lastSubmitPayloadRef.current || !lastSubmitOverridesRef.current) return;
    // 移除末尾的 user + assistant error 这一对消息
    const currentMsgs = latestMessagesRef.current;
    const lastMsg = currentMsgs[currentMsgs.length - 1];
    if (lastMsg?.role !== "assistant" || !lastMsg.error) return;
    const trimmed = currentMsgs.slice(0, -2);
    latestMessagesRef.current = trimmed;
    setMessages(trimmed);
    syncActiveMessages(trimmed, latestStreamPhaseRef.current);
    // 使用当前用户选择的模型配置，而非上次提交时的旧配置
    const currentSettings = useSettings.getState().ai;
    const currentOverrides = {
      selectedModelId: currentSettings.selectedModelId ?? lastSubmitOverridesRef.current.selectedModelId,
    };
    void handleSubmit(currentOverrides, lastSubmitPayloadRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, syncActiveMessages]);

  const handleOpenResultPage = useCallback(
    (pageId: string) => {
      window.dispatchEvent(new CustomEvent(CLOSE_AI_WORKSPACE_EVENT));
      openTab(pageId);
      usePages.getState().setExpandPageId(pageId);
    },
    [openTab],
  );

  return (
    <div
      data-ai-workspace-root="true"
      className="flex h-full flex-col bg-[hsl(var(--goose-editor-bg))]"
      style={{ zoom: aiWorkspaceScale }}
    >

      {/* ── 顶部工具栏：历史 & 新建会话 */}
      <div className="flex shrink-0 items-center justify-end gap-1 px-4 pt-3 pb-1">
        {/* 新建会话 */}
        <button
          type="button"
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
      <div ref={messagesScrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] py-2">
        {messages.length === 0 ? (
          <div className="flex h-[calc(100vh-180px)] flex-col justify-center px-4 pb-10">
            <div
              data-ai-empty-state-card="true"
              className="relative overflow-hidden rounded-[30px] border border-border/70 bg-muted/60 dark:bg-[#1c2027] shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-90"
                style={{
                  backgroundImage: `url("${AI_WORKSPACE_DEFAULT_DIAGRAM_URL}")`,
                }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,16,24,0.14)_0%,rgba(12,16,24,0.35)_48%,rgba(12,16,24,0.6)_100%)] dark:bg-[linear-gradient(180deg,rgba(12,16,24,0.14)_0%,rgba(12,16,24,0.5)_48%,rgba(12,16,24,0.82)_100%)]" />
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
          <div className="flex flex-col pb-20">
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1;
              const isRetryable =
                message.role === "assistant" &&
                message.error &&
                isLastMessage &&
                !isStreaming &&
                !draftPayload.promptText.trim() &&
                !!lastSubmitPayloadRef.current;

              const isDataviz =
                message.role === "assistant" &&
                !message.error &&
                (artifactHasDataviz(message.artifact) || textHasDataviz(message.text));

              const isUserMsg = message.role === "user";

              return (
              <div key={message.id} className={cn(
                "flex flex-col gap-1.5",
                isDataviz
                  ? "px-4 py-2"
                  : isUserMsg
                    ? "items-end px-4 py-1"
                    : "px-4 py-1"
              )}>
                <div
                  className={cn(
                    "select-text",
                    isDataviz
                      ? "text-foreground w-full"
                      : cn(
                          "rounded-2xl border px-4 py-3 shadow-[0_4px_16px_rgba(15,23,42,0.04)]",
                          message.role === "user"
                            ? "self-end max-w-[85%] border-transparent bg-foreground text-background"
                            : message.error
                              ? "border-destructive/20 bg-destructive/5 text-destructive"
                              : "border-border/70 dark:border-border bg-background/80 text-foreground",
                        ),
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
                      <StreamingDatavizText
                        text={message.text}
                        streaming={!!message.streaming}
                        streamPhaseLabel={STREAM_PHASE_LABEL[streamPhase]}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-sm leading-6 text-muted-foreground">
                        {message.streaming ? (
                          <>
                            <LucideIcons.LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            <span>{STREAM_PHASE_LABEL[streamPhase]}</span>
                          </>
                        ) : (
                          <span className="text-destructive">未收到响应，请重试</span>
                        )}
                      </div>
                    )
                  ) : message.role === "assistant" && message.error ? (
                    <div className="flex items-center gap-2 text-sm leading-6">
                      <LucideIcons.AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span className="whitespace-pre-wrap break-words">{message.text || "请求失败，请重试"}</span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words text-sm leading-6">
                      {message.text}
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
                {/* 重试按钮：仅错误消息 & 最后一条 & composer 为空时显示 */}
                {isRetryable && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <LucideIcons.RotateCcw className="h-3 w-3" />
                    重试
                  </button>
                )}
              </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
        </div>
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
