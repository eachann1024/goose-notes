import { useCallback, useRef, useState, type MutableRefObject } from "react";
import { toast } from "sonner";
import {
  buildAgentPlan,
  commitAgentArtifact,
  executeAgentPlan,
} from "@/agent/core/runtime";
import { buildWorkspaceIntentRouterDeps } from "@/agent/core/routerDeps";
import type { AgentArtifact, MarkdownNoteArtifact } from "@/agent/core/types";
import type { AIMessage, AIStreamPhase } from "@/lib/ai-provider";
import { getAIErrorType, trackEvent } from "@/lib/analytics";
import {
  createStickyTargetFromResolvedTarget,
  resolvedTargetToSelection,
} from "@/lib/ai-write";
import { useSettings } from "@/stores/useSettings";
import { useAiStatus } from "@/stores/useAiStatus";
import { usePages } from "@/stores/usePages";
import type { AiComposerInputHandle } from "../editor/ai-composer/AiComposerInput";
import {
  getAiReferenceStats,
  type AiComposerPayload,
  type AiFileReferenceAttrs,
} from "../editor/ai-composer/referenceLookup";
import { CLOSE_AI_WORKSPACE_EVENT } from "./events";
import {
  getLastAgentPlan,
  getLastArtifact,
  normalizeConversationMessage,
  type AiConversationMessage,
} from "./useAiSessionHistory";

interface UseAiWorkspaceActionsParams {
  activeNotebookId: string | null | undefined;
  activeLastWritePlan: NonNullable<ReturnType<typeof useSettings.getState>["ai"]> extends never ? never : import("@/lib/ai-write").AiWritePlan | null;
  originPageId: string | null | undefined;
  originNotebookId: string | null | undefined;
  composerRef: MutableRefObject<AiComposerInputHandle | null>;
  activeRequestIdRef: MutableRefObject<number>;
  streamAbortRef: MutableRefObject<AbortController | null>;
  streamingAccRef: MutableRefObject<{ text: string; phase: AIStreamPhase }>;
  streamingRafRef: MutableRefObject<ReturnType<typeof requestAnimationFrame> | null>;
  userScrolledUpRef: MutableRefObject<boolean>;
  latestMessagesRef: MutableRefObject<AiConversationMessage[]>;
  latestStreamPhaseRef: MutableRefObject<AIStreamPhase>;
  activeLastArtifactRef: MutableRefObject<AgentArtifact | null>;
  isStreaming: boolean;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setStreamPhase: React.Dispatch<React.SetStateAction<AIStreamPhase>>;
  setMessages: React.Dispatch<React.SetStateAction<AiConversationMessage[]>>;
  setComposerFocusToken: React.Dispatch<React.SetStateAction<number>>;
  setDraftContent: (content: import("@/types").JSONContent | null) => void;
  syncActiveMessages: (messages: AiConversationMessage[], phase?: AIStreamPhase) => void;
  persistSessionSnapshot: (
    messages: AiConversationMessage[],
    options?: { plan?: import("@/agent/core/types").AgentPlan | null; artifact?: AgentArtifact | null },
  ) => void;
  ensureCurrentSessionId: () => void;
  setActiveLastWritePlan: (plan: import("@/lib/ai-write").AiWritePlan | null) => void;
  setActiveLastAgentPlan: (plan: import("@/agent/core/types").AgentPlan | null) => void;
  setActiveLastArtifact: (artifact: AgentArtifact | null) => void;
  openTab: (pageId: string) => void;
}

export function useAiWorkspaceActions({
  activeNotebookId,
  activeLastWritePlan,
  originPageId,
  originNotebookId,
  composerRef,
  activeRequestIdRef,
  streamAbortRef,
  streamingAccRef,
  streamingRafRef,
  userScrolledUpRef,
  latestMessagesRef,
  latestStreamPhaseRef,
  activeLastArtifactRef,
  isStreaming,
  setIsStreaming,
  setStreamPhase,
  setMessages,
  setComposerFocusToken,
  setDraftContent,
  syncActiveMessages,
  persistSessionSnapshot,
  ensureCurrentSessionId,
  setActiveLastWritePlan,
  setActiveLastAgentPlan,
  setActiveLastArtifact,
  openTab,
}: UseAiWorkspaceActionsParams) {
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(null);
  const lastSubmitPayloadRef = useRef<AiComposerPayload | null>(null);
  const lastSubmitOverridesRef = useRef<{ selectedModelId: string | null } | null>(null);

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
    requestOverrides: { selectedModelId: string | null },
    payloadOverride?: AiComposerPayload,
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

    const userMessageId = `user-${requestId}`;
    const assistantMessageId = `assistant-${requestId}`;
    const previousMessages = latestMessagesRef.current;
    const initMessages: AiConversationMessage[] = [
      ...latestMessagesRef.current,
      { id: userMessageId, role: "user" as const, text: promptText, references: payload.references },
      { id: assistantMessageId, role: "assistant" as const, text: "", streaming: true, error: false, agentPlan: null, artifact: null, writePlan: null },
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
      latestMessagesRef,
      latestStreamPhaseRef,
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

  const handleOpenResultPage = useCallback(
    (pageId: string) => {
      window.dispatchEvent(new CustomEvent(CLOSE_AI_WORKSPACE_EVENT));
      openTab(pageId);
      usePages.getState().setExpandPageId(pageId);
    },
    [openTab],
  );

  return {
    applyingMessageId,
    hasRetryPayload: !!lastSubmitPayloadRef.current,
    handleReferenceAdded,
    handleSubmit,
    handleRetry,
    handleConfirmWrite,
    handleCancelWrite,
    handleOpenResultPage,
  };
}
