import { useCallback } from "react";
import {
  buildNotebookAiUserMessage,
  getCurrentNotebookAiPageId,
} from "@/lib/notebook-ai/context";
import { sanitizeNotebookAiMessages } from "@/lib/notebook-ai/messageUtils";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import type { AiComposerPayload } from "@/components/editor/ai/composer/referenceLookup";
import type { NotebookAiImageAttachment } from "../Composer";
import type { NotebookAiPanelSelectionCapture } from "../useNotebookAiPanel";
import { createImageFileList } from "./helpers";
import type { SessionState } from "./useSessionState";

export function useSendMessage(state: SessionState) {
  const {
    isBusy,
    unavailableReason,
    notebookId,
    conversationId,
    messages,
    requestCurrentPageIdRef,
    setMessages,
    clearError,
    sendMessage,
  } = state;
  const send = useCallback(
    (
      payload: AiComposerPayload,
      imageAttachments: NotebookAiImageAttachment[],
      options?: {
        capturedSelection?: NotebookAiPanelSelectionCapture | null;
        onConsumeCapturedSelection?: () => void;
      },
    ) => {
      if (isBusy || unavailableReason) return false;

      const displayText = payload.promptText.trim();
      const hasQuotes =
        (payload.selectionQuotes?.length ?? 0) > 0 ||
        payload.tokens.some((token) => token.type === "selectionQuote");
      if (!displayText && imageAttachments.length === 0 && !hasQuotes)
        return false;
      const requestPayload = displayText
        ? payload
        : {
            ...payload,
            promptText: "请分析用户上传的图片。",
            freeformText: "",
          };

      const currentPageId = getCurrentNotebookAiPageId(notebookId);
      const { modelText, metadata } = buildNotebookAiUserMessage({
        payload: requestPayload,
        notebookId,
        currentPageId,
        useImplicitPage: false,
      });
      metadata.displayText = displayText || "已上传图片";
      metadata.createdAt = Date.now();
      metadata.imageAttachments = imageAttachments.map(({ file }) => ({
        filename: file.name,
        mediaType: file.type || "image/*",
      }));
      if (metadata.diagnostics) {
        metadata.diagnostics.imageCount = imageAttachments.length;
      }
      const cleanedMessages = sanitizeNotebookAiMessages(messages);
      const onConsumeCapturedSelection = options?.onConsumeCapturedSelection;

      requestCurrentPageIdRef.current = currentPageId;
      if (cleanedMessages !== messages) {
        setMessages(cleanedMessages);
        useNotebookAiChats
          .getState()
          .setMessages(notebookId, conversationId, cleanedMessages);
      }

      clearError();
      void sendMessage({
        text: modelText,
        files: createImageFileList(imageAttachments),
        metadata,
      });
      onConsumeCapturedSelection?.();
      return true;
    },
    [
      isBusy,
      unavailableReason,
      notebookId,
      conversationId,
      messages,
      setMessages,
      clearError,
      sendMessage,
    ],
  );

  return send;
}
