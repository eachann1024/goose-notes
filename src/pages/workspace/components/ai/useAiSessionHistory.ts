import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { AgentArtifact, AgentPlan } from "@/agent/core/types";
import type { AIStreamPhase } from "@/lib/ai-provider";
import { useAiSessions, type AiSession } from "@/stores/useAiSessions";
import type { AiComposerInputHandle } from "../editor/ai-composer/AiComposerInput";
import {
  genSessionId,
  extractSessionTitle,
  normalizeMessagesForPersistence,
  legacyWritePlanToAgentPlan,
  legacyWritePlanToArtifact,
  normalizeConversationMessage,
  getLastAgentPlan,
  getLastArtifact,
  STREAM_PHASE_LABEL,
  type AiConversationMessage,
} from "./session/utils";

export {
  normalizeMessagesForPersistence,
  legacyWritePlanToAgentPlan,
  legacyWritePlanToArtifact,
  normalizeConversationMessage,
  getLastAgentPlan,
  getLastArtifact,
  STREAM_PHASE_LABEL,
  type AiConversationMessage,
};

interface UseAiSessionHistoryParams {
  activePageId: string | null | undefined;
  activeNotebookId: string | null | undefined;
  composerRef: MutableRefObject<AiComposerInputHandle | null>;
  cancelActiveRequest: () => void;
  isStreaming: boolean;
  setComposerFocusToken: React.Dispatch<React.SetStateAction<number>>;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  streamAbortRef: MutableRefObject<AbortController | null>;
}

export function useAiSessionHistory({
  activePageId,
  activeNotebookId,
  composerRef,
  cancelActiveRequest,
  isStreaming,
  setComposerFocusToken,
  setHistoryOpen,
  streamAbortRef,
}: UseAiSessionHistoryParams) {
  const currentSessionIdRef = useRef<string | null>(null);
  const latestMessagesRef = useRef<AiConversationMessage[]>([]);
  const latestStreamPhaseRef = useRef<AIStreamPhase>("connecting");
  const persistSessionSnapshotRef = useRef<typeof persistSessionSnapshot | null>(null);
  const activeLastAgentPlanRef = useRef<AgentPlan | null>(null);
  const activeLastArtifactRef = useRef<AgentArtifact | null>(null);
  const [messages, setMessages] = useState<AiConversationMessage[]>([]);
  const [streamPhase, setStreamPhase] = useState<AIStreamPhase>("connecting");

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
    persistSessionSnapshotRef.current = persistSessionSnapshot;
  }, [persistSessionSnapshot]);
  useEffect(() => {
    activeLastAgentPlanRef.current = activeLastAgentPlan;
  }, [activeLastAgentPlan]);
  useEffect(() => {
    activeLastArtifactRef.current = activeLastArtifact;
  }, [activeLastArtifact]);

  useEffect(() => {
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
      setComposerFocusToken,
    ],
  );

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
    composerRef,
    resetActiveState,
    setComposerFocusToken,
    setHistoryOpen,
  ]);

  const ensureCurrentSessionId = useCallback(() => {
    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = genSessionId();
    }
  }, []);

  const switchMessageVersion = useCallback(
    (messageId: string, versionIndex: number) => {
      setMessages((current) => {
        const i = current.findIndex((m) => m.id === messageId);
        if (i === -1) return current;
        const msg = current[i];
        if (!msg.versions || versionIndex < 0 || versionIndex >= msg.versions.length) return current;
        const v = msg.versions[versionIndex];
        const updated: AiConversationMessage = {
          ...msg,
          text: v.text,
          artifact: v.artifact ?? null,
          agentPlan: v.agentPlan ?? null,
          activeVersionIndex: versionIndex,
        };
        const next = [...current];
        next[i] = updated;
        latestMessagesRef.current = next;
        syncActiveMessages(next, latestStreamPhaseRef.current);
        persistSessionSnapshot(next);
        return next;
      });
    },
    [syncActiveMessages, persistSessionSnapshot],
  );

  return {
    sessions,
    activeSessionId,
    draftContent,
    activeLastWritePlan,
    activeLastAgentPlan,
    activeLastArtifact,
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
  };
}
