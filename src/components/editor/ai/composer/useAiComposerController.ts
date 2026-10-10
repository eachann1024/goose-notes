import { useEffect, type ForwardedRef } from "react";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import { useSettings } from "@/stores/useSettings";
import { warmLocalSkillsCache } from "@/lib/notebook-ai/localContext";
import type {
  AiComposerInputHandle,
  AiComposerInputProps,
} from "./composerInputTypes";
import { useReferenceMentions } from "./useReferenceMentions";
import { useSkillCommands } from "./useSkillCommands";
import { useComposerFlush } from "./useComposerFlush";
import { useComposerImages } from "./useComposerImages";
import { useComposerEditor } from "./useComposerNativeEditor";
import { useComposerContentState } from "./useComposerContentState";
import { useComposerReferences } from "./useComposerReferences";
import { useComposerInputHandle } from "./useComposerInputHandle";
import { useComposerDraftSync } from "./useComposerDraftSync";
import { useComposerInputEvents } from "./useComposerInputEvents";
import { useComposerKeyboard } from "./useComposerKeyboard";
import { useComposerInteractions } from "./useComposerInteractions";

export function useAiComposerController(
  props: AiComposerInputProps,
  ref: ForwardedRef<AiComposerInputHandle>,
) {
  const { onOpenPage } = useEditorPageContext();
  const readLocalSkills = useSettings((state) => state.ai.readLocalSkills);
  const {
    onReferenceAdded,
    searchPages,
    referencePlacement = "inline",
    notebookId,
    onSlashCommand,
    maxImageBytes,
    maxImageCount,
    onImageRejected,
    disabled,
    variant = "compact",
    onIsEmptyChange,
    onMultilineChange,
    onLayoutMeasure,
  } = props;
  const state = useComposerContentState(props);
  const {
    editorHostRef,
    editorRef,
    placeholderRef,
    liveRegionRef,
    nativeHandlersRef,
    isComposingRef,
    isEmptyRef,
    lastEmittedContentRef,
    imageRegistryRef,
    imageDedupRef,
    imagePreviewElRef,
    imagePreviewHideTimerRef,
    activePreviewImageIdRef,
    activePreviewChipRef,
    isEmpty,
    setIsEmpty,
    setPlaceholderVisible,
    emitCurrentContent,
  } = state;
  const {
    mention,
    mentionItems,
    detectMention,
    insertMention,
    handleMentionKeyDown,
    handleMentionBlur,
    cancelMentionBlurTimer,
    clearMentionState,
  } = useReferenceMentions({
    editorRef,
    isComposingRef,
    onContentMutation: emitCurrentContent,
    onReferenceAdded,
    searchPages,
    referencePlacement,
  });

  const {
    command,
    items: commandItems,
    detectCommand,
    insertCommand,
    handleCommandKeyDown,
    clearCommandState,
  } = useSkillCommands({
    editorRef,
    isComposingRef,
    notebookId,
    enabled: true,
    includeSkills: readLocalSkills,
    onContentMutation: emitCurrentContent,
    onBuiltinCommand: onSlashCommand,
  });

  const {
    imeSessionRef,
    pendingFlushRef,
    flushComposerSideEffects,
    cancelFlushTimer,
    scheduleDetectOnly,
    scheduleFlush,
    touchImeSession,
    endImeSession,
  } = useComposerFlush({
    editorRef,
    isComposingRef,
    detectMention,
    detectCommand,
    clearMentionState,
    clearCommandState,
    emitCurrentContent,
    setPlaceholderVisible,
  });

  // 空闲预热本地 Skill 列表，避免首次输入 `/` 同步读盘卡住
  useEffect(() => {
    if (!readLocalSkills) return;
    const warm = () => {
      try {
        warmLocalSkillsCache();
      } catch {
        // 预热失败不影响输入
      }
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warm, { timeout: 1500 });
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(warm, 0);
    return () => clearTimeout(timer);
  }, [readLocalSkills]);

  const {
    imagePreviewContent,
    setImagePreviewContent,
    hideImagePreview,
    cancelImagePreviewHide,
    releaseAllImages,
    removeImageChip,
    insertImages,
    handleImagePreviewOver,
    handleImagePreviewOut,
  } = useComposerImages({
    editorRef,
    imageRegistryRef,
    imageDedupRef,
    imagePreviewElRef,
    imagePreviewHideTimerRef,
    activePreviewImageIdRef,
    activePreviewChipRef,
    onContentMutation: emitCurrentContent,
    maxImageBytes,
    maxImageCount,
    onImageRejected,
  });

  const references = useComposerReferences(state);
  const images = {
    imagePreviewContent,
    setImagePreviewContent,
    hideImagePreview,
    cancelImagePreviewHide,
    releaseAllImages,
    removeImageChip,
    insertImages,
    handleImagePreviewOver,
    handleImagePreviewOut,
  };
  useComposerInputHandle(
    ref,
    props,
    state,
    references,
    images,
    clearMentionState,
    clearCommandState,
  );
  useComposerDraftSync(props, state, references.syncReferenceTitles);
  const flush = {
    imeSessionRef,
    pendingFlushRef,
    flushComposerSideEffects,
    cancelFlushTimer,
    scheduleDetectOnly,
    scheduleFlush,
    touchImeSession,
    endImeSession,
  };
  const { handleBeforeInputNative, handleInputNative } = useComposerInputEvents(
    state,
    flush,
    clearMentionState,
    clearCommandState,
  );
  const handleKeyDownNative = useComposerKeyboard(
    props,
    state,
    flush,
    handleMentionKeyDown,
    handleCommandKeyDown,
  );
  const { handleClickNative, handleBlurNative, handlePasteNative } =
    useComposerInteractions(
      props,
      state,
      images,
      onOpenPage,
      endImeSession,
      handleMentionBlur,
      clearCommandState,
    );
  // 始终指向最新 handler，mount 时只绑一次原生监听
  nativeHandlersRef.current = {
    onBeforeInput: handleBeforeInputNative,
    onInput: handleInputNative,
    onKeyDown: handleKeyDownNative,
    onClick: handleClickNative,
    onMouseOver: handleImagePreviewOver,
    onMouseOut: handleImagePreviewOut,
    onPaste: handlePasteNative,
    onBlur: handleBlurNative,
    onCompositionStart: () => {
      touchImeSession();
    },
    onCompositionEnd: () => {
      endImeSession();
    },
  };

  useComposerEditor({
    editorHostRef,
    editorRef,
    variant,
    disabled,
    lastEmittedContentRef,
    imageRegistryRef,
    nativeHandlersRef,
    imagePreviewElRef,
    imagePreviewHideTimerRef,
    activePreviewImageIdRef,
    activePreviewChipRef,
    setPlaceholderVisible,
    isEmptyRef,
    setIsEmpty,
    onIsEmptyChange,
    onMultilineChange,
    onLayoutMeasure,
  });

  return {
    editorHostRef,
    placeholderRef,
    liveRegionRef,
    isEmpty,
    mention,
    mentionItems,
    insertMention,
    cancelMentionBlurTimer,
    command,
    commandItems,
    insertCommand,
    imagePreviewContent,
    setImagePreviewContent,
  };
}
