import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import {
  buildAgentPlan,
  commitAgentArtifact,
  executeAgentPlan,
} from "@/agent/core/runtime";
import { buildWorkspaceIntentRouterDeps } from "@/agent/core/routerDeps";
import type { AgentArtifact, MarkdownNoteArtifact } from "@/agent/core/types";
import type { AiSessionMessageVersion } from "@/stores/useAiSessions";
import type { AIMessage } from "@/lib/ai-provider";
import { getAIErrorType, trackEvent } from "@/lib/analytics";
import {
  createStickyTargetFromResolvedTarget,
  resolvedTargetToSelection,
} from "@/lib/ai-write";
import { cn } from "@/lib/utils";
import {
  EDITOR_FONT_SIZE_DEFAULT,
  useSettings,
} from "@/stores/useSettings";
import { useAiStatus } from "@/stores/useAiStatus";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AiComposerInputHandle } from "../editor/ai-composer/AiComposerInput";
import type { EditorRef } from "../editor/Editor";
import {
  getAiReferenceStats,
  serializeAiComposerDoc,
  type AiFileReferenceAttrs,
} from "../editor/ai-composer/referenceLookup";
import { useCompactViewport } from "@/hooks/useCompactViewport";
import { AiPromptComposer } from "./AiPromptComposer";
import { AiSessionHistoryPanel } from "./AiSessionHistoryPanel";
import { AiWorkspaceMessages } from "./AiWorkspaceMessages";
import { CLOSE_AI_WORKSPACE_EVENT } from "./events";
import {
  getLastAgentPlan,
  getLastArtifact,
  normalizeConversationMessage,
  type AiConversationMessage,
  useAiSessionHistory,
} from "./useAiSessionHistory";

interface AiWorkspacePageProps {
  editorRef?: RefObject<EditorRef | null>;
}

export function AiWorkspacePage({ editorRef }: AiWorkspacePageProps = {}) {
  const composerRef = useRef<AiComposerInputHandle | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);
  const activeRequestIdRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamingAccRef = useRef<{ text: string; phase: import("@/lib/ai-provider").AIStreamPhase }>({ text: "", phase: "connecting" });
  const streamingRafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastSubmitPayloadRef = useRef<import("../editor/ai-composer/referenceLookup").AiComposerPayload | null>(null);
  const lastSubmitOverridesRef = useRef<{ selectedModelId: string | null } | null>(null);
  const cancelActiveRequestRef = useRef<() => void>(() => {});

  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(null);
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { activePageId } = usePages();
  const { activeNotebookId } = useNotebooks();
  const { openTab } = useTabs();
  const editorFontSize = useSettings((s) => s.editorFontSize);
  const aiWorkspaceScale = editorFontSize / EDITOR_FONT_SIZE_DEFAULT;
  // utools 吸附模式窗口高度受限，composer 会被压出可视区。
  // 视口高度低于 520 时切换成"贴底"布局，保证发送区始终可见。
  const compactViewport = useCompactViewport(520);

  const cancelActiveRequest = useCallback(() => {
    cancelActiveRequestRef.current();
  }, []);

  const {
    sessions,
    activeSessionId,
    draftContent,
    activeLastWritePlan,
    originPageId,
    originNotebookId,
    messages,
    setMessages,
    streamPhase,
    setStreamPhase,
    currentSessionIdRef,
    latestMessagesRef,
    latestStreamPhaseRef,
    activeLastArtifactRef,
    syncActiveMessages,
    persistSessionSnapshot,
    switchMessageVersion,
    handleSelectSession,
    handleNewSession,
    ensureCurrentSessionId,
    setDraftContent,
    setActiveLastWritePlan,
    setActiveLastAgentPlan,
    setActiveLastArtifact,
    deleteSession,
  } = useAiSessionHistory({
    activePageId,
    activeNotebookId,
    composerRef,
    cancelActiveRequest,
    isStreaming,
    setComposerFocusToken,
    setHistoryOpen,
    streamAbortRef,
  });

  cancelActiveRequestRef.current = () => {
    activeRequestIdRef.current += 1;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsStreaming(false);
    setStreamPhase("connecting");
    useAiStatus.getState().finishStreaming({ celebrate: false });
  };

  const draftPayload = useMemo(
    () => serializeAiComposerDoc(draftContent),
    [draftContent],
  );

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
      requestAnimationFrame(() => {
        isAutoScrollingRef.current = false;
      });
    }
  }, [messages, isStreaming]);

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
    priorVersions?: AiSessionMessageVersion[],
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

    if (!payloadOverride) {
      lastSubmitPayloadRef.current = payload;
      lastSubmitOverridesRef.current = requestOverrides;
    }

    setIsStreaming(true);
    setStreamPhase("connecting");
    useAiStatus.getState().beginStreaming();
    let streamSucceeded = false;
    userScrolledUpRef.current = false;

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    ensureCurrentSessionId();

    const assistantMessageId = `assistant-${requestId}`;
    const previousMessages = latestMessagesRef.current;
    const isRegenerate = !!payloadOverride;
    const initMessages: AiConversationMessage[] = [
      ...latestMessagesRef.current,
      ...(isRegenerate
        ? []
        : [{ id: `user-${requestId}`, role: "user" as const, text: promptText, references: payload.references }]),
      { id: assistantMessageId, role: "assistant" as const, text: "", streaming: true, error: false, agentPlan: null, artifact: null, writePlan: null, versions: priorVersions },
    ];
    latestMessagesRef.current = initMessages;
    setMessages(initMessages);
    syncActiveMessages(initMessages, "connecting");

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
        ...getAiReferenceStats(payload.references),
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
        onUpdate: (update) => {
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
        const prevMsg = nextMsgsSuccess[idxSuccess];
        const completedVersions: AiSessionMessageVersion[] = [
          ...(prevMsg.versions ?? []),
          { text: finalText, artifact: result.artifact, agentPlan: result.plan },
        ];
        nextMsgsSuccess[idxSuccess] = {
          ...prevMsg,
          text: finalText,
          streaming: false,
          artifact: result.artifact,
          agentPlan: result.plan,
          versions: completedVersions,
          activeVersionIndex: completedVersions.length - 1,
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
      if (err instanceof DOMException && err.name === "AbortError") return;
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
    (messageId: string, updater: (artifact: MarkdownNoteArtifact) => MarkdownNoteArtifact) => {
      const nextMessages = latestMessagesRef.current.map((message) => {
        if (message.id !== messageId || message.artifact?.type !== "markdown_note") return message;
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
      setActiveLastWritePlan(latestArtifact?.type === "markdown_note" ? latestArtifact.plan : null);
      setActiveLastAgentPlan(latestPlan);
      setActiveLastArtifact(latestArtifact);
      persistSessionSnapshot(nextMessages, { plan: latestPlan, artifact: latestArtifact });
    },
    [
      persistSessionSnapshot,
      setActiveLastAgentPlan,
      setActiveLastArtifact,
      setActiveLastWritePlan,
      setMessages,
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
        // 当目标是当前活跃页面且编辑器可用时，用 BlockNote 原生 API 写入，格式更可靠
        const editor = editorRef?.current?.editor;
        const canUseEditor =
          editor &&
          (artifact.plan.action === "replace_page" || artifact.plan.action === "append_page") &&
          artifact.plan.target.pageId === activePageId &&
          artifact.plan.outputMarkdown;

        if (canUseEditor) {
          const newBlocks = await editor.tryParseMarkdownToBlocks(artifact.plan.outputMarkdown);

          if (artifact.plan.action === "replace_page") {
            const allBlocks = editor.document;
            const titleBlock = allBlocks[0];
            const blocksToRemove = allBlocks.slice(1);
            // AI 输出可能以 H1 开头（标题），跳过它，只保留正文
            const contentBlocks =
              newBlocks[0]?.type === "heading" && (newBlocks[0] as any)?.props?.level === 1
                ? newBlocks.slice(1)
                : newBlocks;
            if (blocksToRemove.length) editor.removeBlocks(blocksToRemove);
            if (contentBlocks.length && titleBlock) {
              editor.insertBlocks(contentBlocks, titleBlock, "after");
            }
          } else {
            // append_page：追加到末尾
            const allBlocks = editor.document;
            const lastBlock = allBlocks[allBlocks.length - 1];
            if (lastBlock) editor.insertBlocks(newBlocks, lastBlock, "after");
          }

          updateMessageArtifact(messageId, (currentArtifact) => ({
            ...currentArtifact,
            plan: {
              ...currentArtifact.plan,
              status: "committed",
              committedPageId: artifact.plan.target.pageId!,
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
            cross_notebook: false,
          });
          toast.success("已写入目标页面");
          return;
        }

        const result = await commitAgentArtifact(artifact);
        if (!result?.pageId) throw new Error("写入失败，请稍后再试");
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
    const currentMsgs = latestMessagesRef.current;
    const lastMsg = currentMsgs[currentMsgs.length - 1];
    if (lastMsg?.role !== "assistant" || !lastMsg.error) return;
    const trimmed = currentMsgs.slice(0, -2);
    latestMessagesRef.current = trimmed;
    setMessages(trimmed);
    syncActiveMessages(trimmed, latestStreamPhaseRef.current);
    const currentSettings = useSettings.getState().ai;
    const currentOverrides = {
      selectedModelId: currentSettings.selectedModelId ?? lastSubmitOverridesRef.current.selectedModelId,
    };
    void handleSubmit(currentOverrides, lastSubmitPayloadRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, setMessages, syncActiveMessages]);

  const handleRegenerate = useCallback(
    (messageIndex: number) => {
      if (isStreaming) return;
      const currentMsgs = latestMessagesRef.current;
      const targetMsg = currentMsgs[messageIndex];
      if (!targetMsg || targetMsg.role !== "assistant") return;
      const userMsg = currentMsgs[messageIndex - 1];
      if (!userMsg || userMsg.role !== "user") return;

      const existingVersions: AiSessionMessageVersion[] = targetMsg.versions ?? [
        { text: targetMsg.text, artifact: targetMsg.artifact, agentPlan: targetMsg.agentPlan },
      ];

      const trimmed = currentMsgs.slice(0, messageIndex);
      latestMessagesRef.current = trimmed;
      setMessages(trimmed);
      syncActiveMessages(trimmed, latestStreamPhaseRef.current);

      const payload: import("../editor/ai-composer/referenceLookup").AiComposerPayload = {
        promptText: userMsg.text,
        freeformText: "",
        references: userMsg.references ?? [],
        tokens: [],
      };
      const currentSettings = useSettings.getState().ai;
      const currentOverrides = {
        selectedModelId: currentSettings.selectedModelId ?? null,
      };
      void handleSubmit(currentOverrides, payload, existingVersions);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStreaming, setMessages, syncActiveMessages],
  );

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
      className="relative flex h-full flex-col bg-[hsl(var(--goose-editor-bg))]"
      style={{ zoom: aiWorkspaceScale }}
    >
      <div className="flex shrink-0 items-center justify-end gap-1 px-4 pt-3 pb-1">
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
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-foreground/80">历史会话</span>
              {sessions.length > 0 && (
                <span className="text-[10px] text-muted-foreground">{sessions.length} 条</span>
              )}
            </div>
            <div className="max-h-[340px] overflow-y-auto scrollbar-hide">
              <AiSessionHistoryPanel
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

      <div
        ref={messagesScrollRef}
        className="flex-1 overflow-y-auto"
        style={compactViewport ? { paddingBottom: 132 } : undefined}
      >
        <div className="mx-auto w-full max-w-[760px] py-2">
          <AiWorkspaceMessages
            messages={messages}
            isStreaming={isStreaming}
            streamPhase={streamPhase}
            applyingMessageId={applyingMessageId}
            messagesEndRef={messagesEndRef}
            onRegenerate={handleRegenerate}
            onSwitchVersion={switchMessageVersion}
            onConfirmWrite={(messageId, artifact) => {
              void handleConfirmWrite(messageId, artifact);
            }}
            onCancelWrite={handleCancelWrite}
            onOpenResultPage={handleOpenResultPage}
          />
        </div>
      </div>

      <div
        className={
          compactViewport
            ? "absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[hsl(var(--goose-editor-bg))] via-[hsl(var(--goose-editor-bg))]/95 to-transparent pt-4"
            : undefined
        }
      >
        <AiPromptComposer
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
    </div>
  );
}
