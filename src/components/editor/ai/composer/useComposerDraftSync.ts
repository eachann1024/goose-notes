import { useEffect } from "react";
import { placeCaretInEditor } from "./composerChipDom";
import {
  buildPayloadFromTokens,
  isComposerPayloadEmpty,
  readTokensFromDom,
  setDomFromJsonContent,
} from "./composerTokens";
import type { AiComposerInputProps } from "./composerInputTypes";
import type { ComposerContentState } from "./useComposerContentState";

export function useComposerDraftSync(
  props: AiComposerInputProps,
  state: ComposerContentState,
  syncReferenceTitles: () => void,
) {
  const { initialContent, autoFocusToken, onIsEmptyChange } = props;
  const {
    editorRef,
    lastReceivedContentRef,
    lastEmittedContentRef,
    imageRegistryRef,
    isEmptyRef,
    setIsEmpty,
  } = state;
  // ── sync initialContent → DOM ────────────────────────────────────────────

  useEffect(() => {
    // 回调变化不是新草稿，不能用挂载时的 seed 覆盖切页后的引用或未发送文本。
    if (initialContent === lastReceivedContentRef.current) return;
    lastReceivedContentRef.current = initialContent;
    // Skip the echo of our own emission — the DOM is already up to date and
    // rebuilding it would wipe the live text node our cached range points at.
    if (initialContent === lastEmittedContentRef.current) return;
    lastEmittedContentRef.current = initialContent;
    const el = editorRef.current;
    if (!el) return;
    setDomFromJsonContent(el, initialContent, imageRegistryRef.current);
    syncReferenceTitles();
    const tokens = readTokensFromDom(el);
    const empty = isComposerPayloadEmpty(buildPayloadFromTokens(tokens));
    isEmptyRef.current = empty;
    setIsEmpty(empty);
    onIsEmptyChange?.(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent, syncReferenceTitles]);

  // ── auto-focus ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoFocusToken <= 0) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    placeCaretInEditor(el, false);
  }, [autoFocusToken]);
}
