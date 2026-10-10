import { useCallback } from "react";
import { isComposerPayloadEmpty } from "@/components/editor/ai/composer/composerTokens";
import { normalizeAiComposerPayload } from "@/components/editor/ai/composer/referenceLookup";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import { matchComposerPayloadSlashCommand } from "@/lib/notebook-ai/composerSlashCommands";
import type { ComposerProps } from "./types";
import type { ComposerSurfaceState } from "./useComposerSurface";
export function useComposerSubmission(
  props: ComposerProps,
  surface: ComposerSurfaceState,
  cancelPendingDraftPersist: () => void,
) {
  const { disabled, isStreaming, onSend, onSlashCommand, notebookId } = props;
  const { inputRef, setIsEmpty, collapseChrome, setAutoFocusToken } = surface;
  const handleSubmit = useCallback(() => {
    if (disabled || isStreaming) return;
    const input = inputRef.current;
    const payload = input?.getPayload();
    if (!payload) return;

    const images = input?.resolveImages(payload) ?? [];
    const slashCommand = matchComposerPayloadSlashCommand(payload);
    if (slashCommand && images.length === 0) {
      input?.clear();
      cancelPendingDraftPersist();
      useNotebookAiChats.getState().clearComposerDraft(notebookId);
      setIsEmpty(true);
      collapseChrome();
      setAutoFocusToken((token) => token + 1);
      onSlashCommand?.(slashCommand);
      return;
    }

    if (isComposerPayloadEmpty(payload) && images.length === 0) return;

    const normalized = normalizeAiComposerPayload(payload);
    const accepted = onSend(normalized.payload, images);
    if (accepted === false) return;

    input?.clear();
    cancelPendingDraftPersist();
    useNotebookAiChats.getState().clearComposerDraft(notebookId);
    setIsEmpty(true);
    collapseChrome();
    setAutoFocusToken((token) => token + 1);
  }, [
    disabled,
    isStreaming,
    onSend,
    onSlashCommand,
    notebookId,
    cancelPendingDraftPersist,
    collapseChrome,
  ]);

  return handleSubmit;
}
