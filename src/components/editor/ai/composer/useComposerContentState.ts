import { useCallback, useRef, useState } from "react";
import type { JSONContent } from "@/types";
import { composerDraftHasContent } from "@/stores/useNotebookAiChats";
import { ImageDedupTracker } from "./imageDedup";
import {
  clearComposerImageRegistry,
  gcStaleComposerImages,
  type ComposerImageRegistry,
} from "./composerImageChip";
import {
  buildJsonContentFromTokens,
  buildPayloadFromTokens,
  isComposerPayloadEmpty,
  readTokensFromDom,
} from "./composerTokens";
import { isEditorDomEmpty } from "./composerChipDom";
import type {
  AiComposerInputProps,
  ComposerNativeHandlers,
} from "./composerInputTypes";

export function useComposerContentState(props: AiComposerInputProps) {
  const { initialContent, onContentChange, onIsEmptyChange } = props;
  /**
   * contenteditable 必须命令式挂载：一旦由 React 调和 className/aria，
   * 微信输入法在字一多时必卡。host 只是空壳，真正编辑器永不走 reconcile。
   */
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const liveRegionRef = useRef<HTMLSpanElement | null>(null);
  const nativeHandlersRef = useRef<ComposerNativeHandlers | null>(null);
  /** 标准 composition 标记 */
  const isComposingRef = useRef(false);
  const isEmptyRef = useRef(!composerDraftHasContent(initialContent));
  // Track the most recent content we emitted upward so we can ignore the echo
  // back via `initialContent` — otherwise the sync useEffect rebuilds the DOM
  // on every keystroke, invalidating the live selection and any cached ranges.
  const lastEmittedContentRef = useRef<JSONContent | null | undefined>(
    initialContent,
  );
  const lastReceivedContentRef = useRef(initialContent);
  // imageId → { file, previewUrl }；chip 只携带可序列化 attrs
  const imageRegistryRef = useRef<ComposerImageRegistry>(new Map());
  const imageDedupRef = useRef(new ImageDedupTracker());
  /** body 级图片 hover 预览浮层（命令式，非 React） */
  const imagePreviewElRef = useRef<HTMLDivElement | null>(null);
  const imagePreviewHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const activePreviewImageIdRef = useRef<string | null>(null);
  const activePreviewChipRef = useRef<HTMLElement | null>(null);

  const [isEmpty, setIsEmpty] = useState(() => isEmptyRef.current);

  /** 占位符只用 DOM 显隐，避免 IME 中途 setState 触发 React 重渲染 */
  const setPlaceholderVisible = useCallback((visible: boolean) => {
    const node = placeholderRef.current;
    if (!node) return;
    node.style.display = visible ? "" : "none";
  }, []);

  const syncEmptyState = useCallback(
    (empty: boolean) => {
      setPlaceholderVisible(empty);
      if (isEmptyRef.current === empty) return;
      isEmptyRef.current = empty;
      setIsEmpty(empty);
      onIsEmptyChange?.(empty);
    },
    [onIsEmptyChange, setPlaceholderVisible],
  );

  const gcStaleImages = useCallback((liveIds: Set<string>) => {
    gcStaleComposerImages({
      liveIds,
      registry: imageRegistryRef.current,
      dedup: imageDedupRef.current,
      imagePreviewHideTimerRef,
      activePreviewImageIdRef,
      activePreviewChipRef,
      imagePreviewElRef,
    });
  }, []);

  const emitCurrentContent = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;

    // 整行删光：轻量路径，避免全量 walk + 同帧 setState 堆在 delete 后面
    if (isEditorDomEmpty(el)) {
      syncEmptyState(true);
      if (lastEmittedContentRef.current != null) {
        lastEmittedContentRef.current = null;
        onContentChange?.(null);
      }
      // 图片 GC 放到空闲时段，别堵删除
      const registry = imageRegistryRef.current;
      if (registry.size > 0) {
        const runGc = () => {
          clearComposerImageRegistry({
            registry,
            dedup: imageDedupRef.current,
            imagePreviewHideTimerRef,
            activePreviewImageIdRef,
            activePreviewChipRef,
            imagePreviewElRef,
          });
        };
        if (typeof requestIdleCallback === "function") {
          requestIdleCallback(runGc, { timeout: 800 });
        } else {
          setTimeout(runGc, 0);
        }
      }
      return;
    }

    const tokens = readTokensFromDom(el);
    const liveIds = new Set(
      tokens
        .filter((token) => token.type === "image")
        .map((token) => token.image.imageId),
    );
    // 删除后的 GC 异步做，减少主线程尖峰
    if (liveIds.size < imageRegistryRef.current.size) {
      const snapshot = new Set(liveIds);
      const runGc = () => gcStaleImages(snapshot);
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(runGc, { timeout: 800 });
      } else {
        setTimeout(runGc, 0);
      }
    }

    const payload = buildPayloadFromTokens(tokens);
    const empty = isComposerPayloadEmpty(payload);
    syncEmptyState(empty);
    const nextContent = buildJsonContentFromTokens(tokens);
    lastEmittedContentRef.current = nextContent;
    onContentChange?.(nextContent);
  }, [onContentChange, syncEmptyState, gcStaleImages]);

  return {
    editorHostRef,
    editorRef,
    placeholderRef,
    liveRegionRef,
    nativeHandlersRef,
    isComposingRef,
    isEmptyRef,
    lastEmittedContentRef,
    lastReceivedContentRef,
    imageRegistryRef,
    imageDedupRef,
    imagePreviewElRef,
    imagePreviewHideTimerRef,
    activePreviewImageIdRef,
    activePreviewChipRef,
    isEmpty,
    setIsEmpty,
    setPlaceholderVisible,
    syncEmptyState,
    emitCurrentContent,
  };
}

export type ComposerContentState = ReturnType<typeof useComposerContentState>;
