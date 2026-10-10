import { useCallback, useEffect } from "react";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import {
  buildAiFileReferenceAttrs,
  type AiFileReferenceAttrs,
} from "./referenceLookup";
import {
  appendSelectionQuoteToDom,
  type AiSelectionQuoteAttrs,
} from "./selectionQuote";
import { createChipElement } from "./useReferenceMentions";
import {
  ensureComposerCaretAnchors,
  pruneEmptyComposerTextNodes,
  placeCaretAfterNode,
} from "./composerCaret";
import {
  inspectDefaultComposerTokens,
  buildComposerDraftFromReference,
  readTokensFromDom,
  setDomFromJsonContent,
} from "./composerTokens";
import type { ComposerContentState } from "./useComposerContentState";

export function useComposerReferences(state: ComposerContentState) {
  const { editorRef, liveRegionRef, imageRegistryRef, emitCurrentContent } =
    state;
  // 引用以稳定 pageId 为准；更名后同步更新 chip、草稿和发送内容，不重建编辑器选区。
  const syncReferenceTitles = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const pages = usePages.getState().pages;
    const notebooks = useNotebooks.getState().notebooks;
    let changed = false;
    for (const chip of el.querySelectorAll<HTMLElement>(
      "[data-ai-mention-attrs]",
    )) {
      try {
        const attrs = JSON.parse(
          chip.dataset.aiMentionAttrs!,
        ) as AiFileReferenceAttrs;
        const page = pages[attrs.pageId];
        if (!page) continue;
        const current = buildAiFileReferenceAttrs(page, notebooks);
        if (
          attrs.titleSnapshot === current.titleSnapshot &&
          attrs.localFilePath === current.localFilePath
        )
          continue;
        const next = { ...attrs, ...current };
        chip.dataset.aiMentionAttrs = JSON.stringify(next);
        chip.textContent = `@${next.titleSnapshot}`;
        changed = true;
      } catch {
        // 破损的旧 chip 交由原有解析逻辑处理。
      }
    }
    if (changed) emitCurrentContent();
  }, [emitCurrentContent]);

  useEffect(
    () => usePages.subscribe(syncReferenceTitles),
    [syncReferenceTitles],
  );

  const insertReference = useCallback(
    (reference: AiFileReferenceAttrs) => {
      const el = editorRef.current;
      if (!el) return;

      const selection = window.getSelection();
      const inside =
        selection &&
        selection.rangeCount > 0 &&
        (el === selection.anchorNode || el.contains(selection.anchorNode));
      if (!inside) {
        el.focus();
        const endRange = document.createRange();
        endRange.selectNodeContents(el);
        endRange.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(endRange);
      }

      const range = window.getSelection()!.getRangeAt(0);
      range.deleteContents();

      // 间距靠 CSS；ZWSP 锚点保证旧 Chromium 光标可见。
      const chip = createChipElement(reference);
      range.insertNode(chip);
      pruneEmptyComposerTextNodes(el);
      ensureComposerCaretAnchors(el);
      placeCaretAfterNode(chip);

      emitCurrentContent();
    },
    [emitCurrentContent],
  );

  const appendSelectionQuote = useCallback(
    (
      quote: AiSelectionQuoteAttrs,
      options?: { restoreCaret?: boolean; animate?: boolean },
    ): "appended" | "duplicate" | "skipped" => {
      const el = editorRef.current;
      if (!el) return "skipped";

      const active = document.activeElement;
      const composerFocused = Boolean(
        active && (el === active || el.contains(active)),
      );

      const result = appendSelectionQuoteToDom(el, quote, {
        animate: options?.animate === true,
        restoreCaret: options?.restoreCaret ?? composerFocused,
        liveRegion: liveRegionRef.current,
      });
      if (result === "appended") {
        emitCurrentContent();
      }
      return result;
    },
    [emitCurrentContent],
  );

  const replaceDefaultPageReference = useCallback(
    (reference: AiFileReferenceAttrs): "applied" | "already" | "skipped" => {
      const el = editorRef.current;
      if (!el) return "skipped";

      const { replaceable, solePageId } = inspectDefaultComposerTokens(
        readTokensFromDom(el),
      );
      if (!replaceable) return "skipped";
      if (solePageId === reference.pageId) return "already";

      const next = buildComposerDraftFromReference(reference);
      setDomFromJsonContent(el, next, imageRegistryRef.current);
      const chip = el.querySelector("[data-ai-mention-attrs]");
      if (chip) placeCaretAfterNode(chip);
      emitCurrentContent();
      return "applied";
    },
    [emitCurrentContent],
  );

  return {
    syncReferenceTitles,
    insertReference,
    appendSelectionQuote,
    replaceDefaultPageReference,
  };
}

export type ComposerReferences = ReturnType<typeof useComposerReferences>;
