import { useRef, useState, type RefObject, type MutableRefObject } from "react";
import { trackEvent, getAIErrorType } from "@/lib/analytics";
import { useAiStatus } from "@/stores/useAiStatus";
import { useSettings } from "@/stores/useSettings";
import { buildAgentPlan, executeAgentPlan } from "@/agent/core/runtime";
import { buildWorkspaceIntentRouterDeps } from "@/agent/core/routerDeps";
import { createStickyTargetFromResolvedTarget, resolvedTargetToSelection } from "@/lib/ai-write";
import type { AiComposerInputHandle } from "../../editor/ai-composer/AiComposerInput";
import type { AiSessionMessageVersion } from "@/stores/useAiSessions";
import type { AIMessage, AIStreamPhase } from "@/lib/ai-provider";
import type { AiConversationMessage } from "../useAiSessionHistory";
import type { AgentArtifact } from "@/agent/core/types";

interface UseAiRequestSubmitParams {
  composerRef: RefObject<AiComposerInputHandle | null>;
  streamAbortRef: RefObject<AbortController | null>;
  syncActiveMessages: (messages: AiConversationMessage[], phase: AIStreamPhase) => void;
  ensureCurrentSessionId: () => void;
  latestMessagesRef: MutableRefObject<AiConversationMessage[]>;
  latestStreamPhaseRef: MutableRefObject<AIStreamPhase>;
  setMessages: (msgs: AiConversationMessage[] | ((current: AiConversationMessage[]) => AiConversationMessage[])) => void;
  setDraftContent: (content: any) => void;
  setActiveLastAgentPlan: (plan: any) => void;
  setActiveLastArtifact: (artifact: any) => void;
  setActiveLastWritePlan: (plan: any) => void;
  persistSessionSnapshot: (msgs: AiConversationMessage[], ext?: any) => void;
  activeLastWritePlan: any;
  activeLastArtifactRef: RefObject<any>;
  originPageId: string | null | undefined;
  originNotebookId: string | null | undefined;
  setComposerFocusToken: (updater: (v: number) => number) => void;
}

export function useAiRequestSubmit({
  composerRef,
  streamAbortRef,
  syncActiveMessages,
  ensureCurrentSessionId,
  latestMessagesRef,
  latestStreamPhaseRef,
  setMessages,
  setDraftContent,
  setActiveLastAgentPlan,
  setActiveLastArtifact,
  setActiveLastWritePlan,
  persistSessionSnapshot,
  activeLastWritePlan,
  activeLastArtifactRef,
  originPageId,
  originNotebookId,
  setComposerFocusToken,
}: UseAiRequestSubmitParams) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamPhase, setStreamPhase] = useState<AIStreamPhase>("connecting");

  const activeRequestIdRef = useRef(0);
  const streamingAccRef = useRef<{ text: string; phase: any }>({ text: "", phase: "connecting" });
  const streamingRafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastSubmitPayloadRef = useRef<any>(null);
  const lastSubmitOverridesRef = useRef<any>(null);

  const cancelActiveRequest = () => {
    activeRequestIdRef.current += 1;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsStreaming(false);
    setStreamPhase("connecting");
    useAiStatus.getState().finishStreaming({ celebrate: false });
  };

  const handleSubmit = async (
    requestOverrides: { selectedModelId: string | null },
    payloadOverride?: any,
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

  return {
    isStreaming,
    streamPhase,
    setStreamPhase,
    setIsStreaming,
    handleSubmit,
    cancelActiveRequest,
    lastSubmitPayloadRef,
    lastSubmitOverridesRef,
  };
}
