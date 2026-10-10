import { useImperativeHandle, type ForwardedRef } from "react";
import type {
  AiComposerInputHandle,
  AiComposerInputProps,
} from "./composerInputTypes";
import type { AiComposerPayload } from "./referenceLookup";
import { placeCaretInEditor } from "./composerChipDom";
import { buildPayloadFromTokens, readTokensFromDom } from "./composerTokens";
import type { ComposerContentState } from "./useComposerContentState";
import type { ComposerReferences } from "./useComposerReferences";
import type { useComposerImages } from "./useComposerImages";

export function useComposerInputHandle(
  ref: ForwardedRef<AiComposerInputHandle>,
  props: AiComposerInputProps,
  state: ComposerContentState,
  references: ComposerReferences,
  images: ReturnType<typeof useComposerImages>,
  clearMentionState: () => void,
  clearCommandState: () => void,
) {
  const {
    onIsEmptyChange,
    onMultilineChange,
    onLayoutMeasure,
    onContentChange,
  } = props;
  const {
    editorRef,
    lastEmittedContentRef,
    imageRegistryRef,
    isEmptyRef,
    setIsEmpty,
    setPlaceholderVisible,
  } = state;
  const {
    syncReferenceTitles,
    insertReference,
    appendSelectionQuote,
    replaceDefaultPageReference,
  } = references;
  const { releaseAllImages, insertImages } = images;
  useImperativeHandle(
    ref,
    () => ({
      getEditorEl: () => editorRef.current,
      focus: () => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        placeCaretInEditor(el, false);
      },
      clear: () => {
        const el = editorRef.current;
        if (!el) return;
        el.innerHTML = "";
        el.style.removeProperty("--ai-composer-h");
        el.dataset.multiline = "false";
        lastEmittedContentRef.current = null;
        releaseAllImages();
        setPlaceholderVisible(true);
        isEmptyRef.current = true;
        setIsEmpty(true);
        clearMentionState();
        clearCommandState();
        onIsEmptyChange?.(true);
        onMultilineChange?.(false);
        onLayoutMeasure?.();
        onContentChange?.(null);
      },
      getPayload: (): AiComposerPayload => {
        syncReferenceTitles();
        const el = editorRef.current;
        if (!el)
          return {
            promptText: "",
            freeformText: "",
            references: [],
            images: [],
            skills: [],
            tokens: [],
          };
        return buildPayloadFromTokens(readTokensFromDom(el));
      },
      resolveImages: (payload: AiComposerPayload) =>
        payload.images
          .map((attrs) => {
            const entry = imageRegistryRef.current.get(attrs.imageId);
            return entry
              ? { file: entry.file, previewUrl: entry.previewUrl }
              : null;
          })
          .filter(
            (item): item is { file: File; previewUrl: string } => item !== null,
          ),
      insertImages,
      insertReference,
      appendSelectionQuote,
      replaceDefaultPageReference,
    }),
    [
      clearMentionState,
      clearCommandState,
      onIsEmptyChange,
      onMultilineChange,
      onLayoutMeasure,
      onContentChange,
      releaseAllImages,
      insertImages,
      insertReference,
      appendSelectionQuote,
      replaceDefaultPageReference,
      syncReferenceTitles,
      setPlaceholderVisible,
    ],
  );
}
