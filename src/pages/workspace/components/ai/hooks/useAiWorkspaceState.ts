import { useCallback, useEffect, useRef, useState, useMemo, type RefObject } from "react";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { useSettings } from "@/stores/useSettings";
import { useAiSessionHistory, getLastAgentPlan, getLastArtifact, normalizeConversationMessage } from "../useAiSessionHistory";
import { useAiRequestSubmit } from "./useAiRequestSubmit";
import { useAiWriteActions } from "./useAiWriteActions";
import { CLOSE_AI_WORKSPACE_EVENT } from "../events";
import type { EditorRef } from "../../editor/Editor";
import type { MarkdownNoteArtifact } from "@/agent/core/types";
import type { AiComposerInputHandle } from "../../editor/ai-composer/AiComposerInput";
import type { AiConversationMessage } from "../useAiSessionHistory";
import type { AIStreamPhase } from "@/lib/ai-provider";

interface UseAiWorkspaceStateParams {
  editorRef?: RefObject<EditorRef | null>;
}

export function useAiWorkspaceState({ editorRef }: UseAiWorkspaceStateParams = {}) {
  const composerRef = useRef<AiComposerInputHandle | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { activePageId } = usePages();
  const { activeNotebookId } = useNotebooks();
  const { openTab } = useTabs();

  const {
    isStreaming,
    streamPhase,
    setStreamPhase,
    setIsStreaming,
    handleSubmit,
    cancelActiveRequest,
    lastSubmitPayloadRef,
    lastSubmitOverridesRef,
  } = useAiRequestSubmit({
    composerRef,
    streamAbortRef,
    syncActiveMessages: (...args) => syncActiveMessages(...args),
    ensureCurrentSessionId: () => ensureCurrentSessionId(),
    latestMessagesRef: { get current() { return latestMessagesRef.current; }, set current(val) { latestMessagesRef.current = val; } },
    latestStreamPhaseRef: { get current() { return latestStreamPhaseRef.current as AIStreamPhase; }, set current(val) { latestStreamPhaseRef.current = val; } } as any,
    setMessages: (msgs) => setMessages(msgs as any),
    setDraftContent: (val) => setDraftContent(val),
    setActiveLastAgentPlan: (val) => setActiveLastAgentPlan(val),
    setActiveLastArtifact: (val) => setActiveLastArtifact(val),
    setActiveLastWritePlan: (val) => setActiveLastWritePlan(val),
    persistSessionSnapshot: (...args) => persistSessionSnapshot(...args),
    activeLastWritePlan: null,
    activeLastArtifactRef: { get current() { return activeLastArtifactRef.current; } } as any,
    originPageId: activePageId,
    originNotebookId: activeNotebookId,
    setComposerFocusToken,
  });

  const {
    sessions,
    activeSessionId,
    draftContent,
    activeLastWritePlan,
    originPageId,
    originNotebookId,
    messages,
    setMessages,
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
      syncActiveMessages(nextMessages, latestStreamPhaseRef.current as AIStreamPhase);
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

  const {
    applyingMessageId,
    handleConfirmWrite,
    handleCancelWrite,
  } = useAiWriteActions({
    editorRef,
    activeNotebookId,
    activePageId,
    updateMessageArtifact,
  });

  const handleRetry = useCallback(() => {
    if (isStreaming || !lastSubmitPayloadRef.current || !lastSubmitOverridesRef.current) return;
    const currentMsgs = latestMessagesRef.current;
    const lastMsg = currentMsgs[currentMsgs.length - 1];
    if (lastMsg?.role !== "assistant" || !lastMsg.error) return;
    const trimmed = currentMsgs.slice(0, -2);
    latestMessagesRef.current = trimmed;
    setMessages(trimmed);
    syncActiveMessages(trimmed, latestStreamPhaseRef.current as AIStreamPhase);
    const currentSettings = useSettings.getState().ai;
    const currentOverrides = {
      selectedModelId: currentSettings.selectedModelId ?? lastSubmitOverridesRef.current.selectedModelId,
    };
    void handleSubmit(currentOverrides, lastSubmitPayloadRef.current);
  }, [isStreaming, latestMessagesRef, latestStreamPhaseRef, lastSubmitOverridesRef, lastSubmitPayloadRef, setMessages, syncActiveMessages, handleSubmit]);

  const handleRegenerate = useCallback(
    (messageIndex: number) => {
      if (isStreaming) return;
      const currentMsgs = latestMessagesRef.current;
      const targetMsg = currentMsgs[messageIndex];
      if (!targetMsg || targetMsg.role !== "assistant") return;
      const userMsg = currentMsgs[messageIndex - 1];
      if (!userMsg || userMsg.role !== "user") return;

      const existingVersions = targetMsg.versions ?? [
        { text: targetMsg.text, artifact: targetMsg.artifact, agentPlan: targetMsg.agentPlan },
      ];

      const trimmed = currentMsgs.slice(0, messageIndex);
      latestMessagesRef.current = trimmed;
      setMessages(trimmed);
      syncActiveMessages(trimmed, latestStreamPhaseRef.current as AIStreamPhase);

      const payload = {
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
    [isStreaming, latestMessagesRef, latestStreamPhaseRef, setMessages, syncActiveMessages, handleSubmit],
  );

  const handleOpenResultPage = useCallback(
    (pageId: string) => {
      window.dispatchEvent(new CustomEvent(CLOSE_AI_WORKSPACE_EVENT));
      openTab(pageId);
      usePages.getState().setExpandPageId(pageId);
    },
    [openTab],
  );

  return {
    composerRef,
    messagesEndRef,
    messagesScrollRef,
    userScrolledUpRef,
    composerFocusToken,
    setComposerFocusToken,
    historyOpen,
    setHistoryOpen,
    activePageId,
    activeNotebookId,
    isStreaming,
    streamPhase,
    sessions,
    activeSessionId,
    draftContent,
    messages,
    applyingMessageId,
    handleNewSession,
    handleSelectSession,
    deleteSession,
    handleRegenerate,
    switchMessageVersion,
    handleConfirmWrite,
    handleCancelWrite,
    handleOpenResultPage,
    handleSubmit,
    handleRetry,
    setDraftContent,
  };
}
