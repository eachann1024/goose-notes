import { useEffect, useImperativeHandle, type Ref } from "react";
import { toast } from "@/components/ui/sonner";
import {
  APPEND_COMPOSER_SELECTION_EVENT,
  SELECTION_QUOTE_DUPLICATE_TOAST,
  buildSelectionQuoteAttrs,
  consumePendingAppendComposerSelections,
  shouldDeferPendingSelectionQuote,
  type AppendComposerSelectionDetail,
} from "@/components/editor/ai/composer/selectionQuote";
import type { AiFileReferenceAttrs } from "@/components/editor/ai/composer/referenceLookup";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import type { ComposerProps, ComposerHandle } from "./types";
import type { ComposerSurfaceState } from "./useComposerSurface";
export function useComposerSelectionHandle(
  { notebookId, conversationId }: ComposerProps,
  { inputRef }: ComposerSurfaceState,
  ref: Ref<ComposerHandle>,
) {
  useEffect(() => {
    let cancelled = false;
    const applyDetail = (detail: AppendComposerSelectionDetail) => {
      if (
        shouldDeferPendingSelectionQuote({
          composerConversationId: conversationId,
          activeConversationId: useNotebookAiChats
            .getState()
            .getActiveConversationId(notebookId),
        })
      ) {
        return false;
      }
      const attrs = buildSelectionQuoteAttrs({
        pageId: detail?.pageId ?? "",
        pageTitle: detail?.pageTitle ?? "",
        text: detail?.text ?? "",
      });
      if (!attrs) return true;
      const result = inputRef.current?.appendSelectionQuote(attrs, {
        animate: detail.animate === true,
        restoreCaret: false,
      });
      if (result === "duplicate") {
        toast(SELECTION_QUOTE_DUPLICATE_TOAST);
        inputRef.current?.focus();
        return true;
      }
      if (result === "appended") {
        inputRef.current?.focus();
        return true;
      }
      return false;
    };
    const flushPending = () => {
      const run = (tries: number) => {
        if (cancelled) return;
        const remaining = consumePendingAppendComposerSelections(applyDetail);
        if (remaining > 0 && tries > 0) {
          window.requestAnimationFrame(() => run(tries - 1));
        }
      };
      run(8);
    };
    window.addEventListener(APPEND_COMPOSER_SELECTION_EVENT, flushPending);
    flushPending();
    return () => {
      cancelled = true;
      window.removeEventListener(APPEND_COMPOSER_SELECTION_EVENT, flushPending);
    };
  }, [conversationId, notebookId]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      insertReference: (reference: AiFileReferenceAttrs) => {
        inputRef.current?.insertReference(reference);
      },
      replaceDefaultPageReference: (reference: AiFileReferenceAttrs) =>
        inputRef.current?.replaceDefaultPageReference(reference) ?? "skipped",
      appendSelectionQuote: (quote, options) =>
        inputRef.current?.appendSelectionQuote(quote, options) ?? "skipped",
    }),
    [],
  );
}
