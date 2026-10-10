/** AI 会话在 Workspace 常驻，面板开关不改变请求生命周期。 */
import { useMemo, type ReactNode, type RefObject } from "react";
import type { EditorRef } from "@/components/editor/core/Editor";
import { NotebookAiAssistantRuntimeProvider } from "./AssistantUiRuntimeProvider";
import { NotebookAiSessionContext } from "./session/context";
import type { NotebookAiSessionValue } from "./session/types";
import { useSessionState } from "./session/useSessionState";
import { useStreamLifecycle } from "./session/useStreamLifecycle";
import { useSendMessage } from "./session/useSendMessage";
import { useConversationActions } from "./session/useConversationActions";
import { useConversationCompaction } from "./session/useConversationCompaction";
import { useBatchApprovalActions } from "./session/useBatchApprovalActions";
export { useNotebookAiSession } from "./session/context";
export {
  NOTEBOOK_AI_PLACEHOLDER_HINTS,
  formatNotebookAiChatError,
} from "./session/helpers";
export type { NotebookAiSessionValue } from "./session/types";

interface NotebookAiSessionProviderProps {
  notebookId: string;
  editorRef?: RefObject<EditorRef | null>;
  children: ReactNode;
}

export function NotebookAiSessionProvider({
  notebookId,
  children,
}: NotebookAiSessionProviderProps) {
  const state = useSessionState(notebookId);
  const {
    conversationId,
    messages,
    status,
    error,
    clearError,
    isStreaming,
    isBusy,
    unavailableReason,
    placeholderIndex,
    composerRevision,
    suppressDefaultPageSeed,
  } = state;
  const stopAll = useStreamLifecycle(state);
  const send = useSendMessage(state);
  const {
    newConversation,
    ensureFreshConversation,
    selectConversation,
    deleteConversation,
    searchPages,
  } = useConversationActions(state);
  const compactConversation = useConversationCompaction(state);
  const { onBatchApproval, onBatchUndo } = useBatchApprovalActions(state);
  const value = useMemo<NotebookAiSessionValue>(
    () => ({
      notebookId,
      conversationId,
      messages,
      status,
      error,
      clearError,
      stop: stopAll,
      isStreaming,
      isBusy,
      unavailableReason,
      placeholderIndex,
      composerRevision,
      suppressDefaultPageSeed,
      send,
      newConversation,
      ensureFreshConversation,
      compactConversation,
      selectConversation,
      deleteConversation,
      searchPages,
      onBatchApproval,
      onBatchUndo,
    }),
    [
      notebookId,
      conversationId,
      messages,
      status,
      error,
      clearError,
      stopAll,
      isStreaming,
      isBusy,
      unavailableReason,
      placeholderIndex,
      composerRevision,
      suppressDefaultPageSeed,
      send,
      newConversation,
      ensureFreshConversation,
      compactConversation,
      selectConversation,
      deleteConversation,
      searchPages,
      onBatchApproval,
      onBatchUndo,
    ],
  );

  return (
    <NotebookAiAssistantRuntimeProvider
      messages={messages}
      isRunning={isBusy}
      isDisabled={Boolean(unavailableReason)}
      onCancel={stopAll}
    >
      <NotebookAiSessionContext.Provider value={value}>
        {children}
      </NotebookAiSessionContext.Provider>
    </NotebookAiAssistantRuntimeProvider>
  );
}
