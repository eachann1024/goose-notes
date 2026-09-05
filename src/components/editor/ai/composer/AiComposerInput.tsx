/**
 * AI 输入框组装：contenteditable 宿主、@ / Skill、图片 chip、提交。
 * 被 notebook-ai Composer 使用。
 * 依赖本目录 guards / chip / tokens / flush / images / native editor。
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { isImeKeyboardEvent } from "@/hooks/useImeInput";
import {
  type AiComposerPayload,
  type AiFileReferenceAttrs,
} from "./referenceLookup";
import {
  appendSelectionQuoteToDom,
  type AiSelectionQuoteAttrs,
} from "./selectionQuote";
import { ComposerSuggestionsList } from "@/components/editor/ai/composer/ComposerSuggestionsList";
import {
  createChipElement,
  useReferenceMentions,
} from "./useReferenceMentions";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import { useSettings } from "@/stores/useSettings";
import { composerDraftHasContent } from "@/stores/useNotebookAiChats";
import {
  ensureComposerCaretAnchors,
  navigateComposerChipArrow,
  placeCaretAfterNode,
  pruneEmptyComposerTextNodes,
  useSkillCommands,
} from "./useSkillCommands";
import { SkillSuggestionsList } from "./SkillSuggestionsList";
import type { JSONContent } from "@/types";
import { ImageDedupTracker } from "./imageDedup";
import { warmLocalSkillsCache } from "@/lib/notebook-ai/localContext";
import { FullscreenPreview } from "@/components/preview/FullscreenPreview";
import { extractClipboardImageFiles } from "@/components/editor/utils/pasteClipboardImage";
import {
  COMPOSER_CHIP_DELETE_FLUSH_MS,
  COMPOSER_DELETE_FLUSH_MS,
  COMPOSER_INPUT_FLUSH_MS,
  isComposerDeleteInputType,
  shouldProcessComposerInput,
} from "./composerInputGuards";
import {
  cleanupOrphanComposerZwspNodes,
  editorHasComposerChips,
  getComposerChipAfterCaret,
  getComposerChipBeforeCaret,
  isEditorDomEmpty,
  placeCaretInEditor,
  rangeContainsComposerChip,
  removeComposerChipsIntersectingRange,
  resolveComposerBeforeInputDelete,
  selectionCoversEntireEditor,
} from "./composerChipDom";
import {
  clearComposerImageRegistry,
  gcStaleComposerImages,
  getPreviewableImageChip,
  parseImageChipAttrs,
  type ComposerImageRegistry,
} from "./composerImageChip";
import {
  buildJsonContentFromTokens,
  buildPayloadFromTokens,
  isComposerPayloadEmpty,
  inspectDefaultComposerTokens,
  buildComposerDraftFromReference,
  readTokensFromDom,
  setDomFromJsonContent,
} from "./composerTokens";
import { insertComposerLineBreak } from "./composerEditorDom";
import {
  type AiComposerInputHandle,
  type AiComposerInputProps,
  type ComposerNativeHandlers,
} from "./composerInputTypes";
import { useComposerFlush } from "./useComposerFlush";
import { useComposerImages } from "./useComposerImages";
import { useComposerEditor } from "./useComposerNativeEditor";

export {
  COMPOSER_CHIP_DELETE_FLUSH_MS,
  COMPOSER_DELETE_FLUSH_MS,
  COMPOSER_INPUT_FLUSH_MS,
  isComposerDeleteInputType,
  shouldProcessComposerInput,
} from "./composerInputGuards";
export {
  COMPOSER_CHIP_SELECTOR,
  editorHasComposerChips,
  getComposerChipAfterCaret,
  getComposerChipBeforeCaret,
  isComposerChipElement,
  rangeContainsComposerChip,
  resolveComposerBeforeInputDelete,
  selectionCoversEntireEditor,
  type ComposerBeforeInputDeleteAction,
} from "./composerChipDom";
export type {
  ComposerImageEntry,
  ComposerImageRegistry,
} from "./composerImageChip";
export type { AiComposerInputHandle } from "./composerInputTypes";

export const AiComposerInput = forwardRef<
  AiComposerInputHandle,
  AiComposerInputProps
>(
  (
    {
      placeholder,
      placeholderOverlayText,
      autoFocusToken,
      onSubmit,
      onEscape,
      initialContent,
      onContentChange,
      onIsEmptyChange,
      onMultilineChange,
      onLayoutMeasure,
      className,
      onReferenceAdded,
      searchPages,
      referencePlacement = "inline",
      variant = "compact",
      compactWidthClass,
      disabled,
      maxImageBytes,
      maxImageCount,
      onImageRejected,
      notebookId,
      onSlashCommand,
    },
    ref,
  ) => {
    const { onOpenPage } = useEditorPageContext();
    const readLocalSkills = useSettings((state) => state.ai.readLocalSkills);
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
    // imageId → { file, previewUrl }；chip 只携带可序列化 attrs
    const imageRegistryRef = useRef<ComposerImageRegistry>(new Map());
    const imageDedupRef = useRef(new ImageDedupTracker());
    /** body 级图片 hover 预览浮层（命令式，非 React） */
    const imagePreviewElRef = useRef<HTMLDivElement | null>(null);
    const imagePreviewHideTimerRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);
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
          el.style.setProperty("--ai-composer-h", "24px");
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
              (item): item is { file: File; previewUrl: string } =>
                item !== null,
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
        setPlaceholderVisible,
      ],
    );

    // ── sync initialContent → DOM ────────────────────────────────────────────

    useEffect(() => {
      // Skip the echo of our own emission — the DOM is already up to date and
      // rebuilding it would wipe the live text node our cached range points at.
      if (initialContent === lastEmittedContentRef.current) return;
      lastEmittedContentRef.current = initialContent;
      const el = editorRef.current;
      if (!el) return;
      setDomFromJsonContent(el, initialContent, imageRegistryRef.current);
      const tokens = readTokensFromDom(el);
      const empty = isComposerPayloadEmpty(buildPayloadFromTokens(tokens));
      isEmptyRef.current = empty;
      setIsEmpty(empty);
      onIsEmptyChange?.(empty);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialContent]);

    // ── auto-focus ───────────────────────────────────────────────────────────

    useEffect(() => {
      if (autoFocusToken <= 0) return;
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      placeCaretInEditor(el, false);
    }, [autoFocusToken]);

    // ── native input / keyboard（挂到命令式节点上，不经 React 合成事件） ──

    /**
     * 有 chip 时拦截原生删除：旧 Chromium 对 contenteditable=false 节点
     * 走 deleteByCut / 跨边界删除极易卡死。IME 会话绝不拦截。
     */
    const handleBeforeInputNative = useCallback(
      (event: Event) => {
        const native = event as InputEvent;
        const inputType = native.inputType ?? "";
        if (!isComposerDeleteInputType(inputType)) return;

        const imeActive =
          imeSessionRef.current ||
          isComposingRef.current ||
          native.isComposing === true ||
          inputType === "deleteCompositionText" ||
          inputType === "deleteByComposition";

        const el = editorRef.current;
        if (!el) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (
          !el.contains(range.commonAncestorContainer) &&
          el !== range.commonAncestorContainer
        ) {
          // 选区不在编辑器内
          if (!el.contains(range.startContainer)) return;
        }

        const hasChips = editorHasComposerChips(el);
        const coversEntire = selectionCoversEntireEditor(el, range);
        const containsChip = rangeContainsComposerChip(range, el);
        const chipBefore = getComposerChipBeforeCaret(el, range);
        const chipAfter = getComposerChipAfterCaret(el, range);

        const action = resolveComposerBeforeInputDelete({
          inputType,
          imeActive,
          hasChips,
          selectionCoversEntire: coversEntire,
          rangeCollapsed: range.collapsed,
          rangeContainsChip: containsChip,
          chipBeforeCaret: Boolean(chipBefore),
          chipAfterCaret: Boolean(chipAfter),
        });

        if (action === "ignore") return;

        event.preventDefault();

        if (action === "clear-editor") {
          el.innerHTML = "";
          placeCaretInEditor(el, true);
          setPlaceholderVisible(true);
          scheduleFlush(COMPOSER_CHIP_DELETE_FLUSH_MS);
          return;
        }

        if (action === "delete-selection-chips") {
          removeComposerChipsIntersectingRange(el, range);
          try {
            // chip 摘掉后再删文本；包 try 防 range 失效
            if (!range.collapsed) range.deleteContents();
          } catch {
            // ignore
          }
          cleanupOrphanComposerZwspNodes(el);
          setPlaceholderVisible(isEditorDomEmpty(el));
          scheduleFlush(COMPOSER_CHIP_DELETE_FLUSH_MS);
          return;
        }

        if (action === "remove-chip-before" && chipBefore) {
          chipBefore.remove();
          cleanupOrphanComposerZwspNodes(el);
          setPlaceholderVisible(isEditorDomEmpty(el));
          scheduleFlush(COMPOSER_CHIP_DELETE_FLUSH_MS);
          return;
        }

        if (action === "remove-chip-after" && chipAfter) {
          chipAfter.remove();
          cleanupOrphanComposerZwspNodes(el);
          setPlaceholderVisible(isEditorDomEmpty(el));
          scheduleFlush(COMPOSER_CHIP_DELETE_FLUSH_MS);
        }
      },
      [imeSessionRef, scheduleFlush, setPlaceholderVisible],
    );

    const handleInputNative = useCallback(
      (event: Event) => {
        const native = event as InputEvent;
        const inputType = native.inputType ?? "";
        // 组合态删除仍属 IME，不能当普通 delete 去 flush
        const looksLikeImeInput =
          native.isComposing === true ||
          inputType === "insertCompositionText" ||
          inputType === "deleteCompositionText" ||
          inputType === "insertFromComposition" ||
          inputType === "deleteByComposition";

        if (looksLikeImeInput) {
          touchImeSession();
          return;
        }

        if (
          !shouldProcessComposerInput({
            isComposingFlag: isComposingRef.current,
            imeSessionActive: imeSessionRef.current,
            inputEventIsComposing: native.isComposing,
          })
        ) {
          pendingFlushRef.current = true;
          return;
        }

        // 只动 DOM 占位，不 setState；整行删光立刻显示占位
        const el = editorRef.current;
        if (el && isEditorDomEmpty(el)) {
          setPlaceholderVisible(true);
          clearMentionState();
          clearCommandState();
          scheduleFlush(COMPOSER_DELETE_FLUSH_MS);
          return;
        }
        setPlaceholderVisible(false);
        const isDelete = isComposerDeleteInputType(inputType);
        const deleteDelay =
          el && editorHasComposerChips(el)
            ? COMPOSER_CHIP_DELETE_FLUSH_MS
            : COMPOSER_DELETE_FLUSH_MS;
        scheduleFlush(isDelete ? deleteDelay : COMPOSER_INPUT_FLUSH_MS);
        // 非删除：立刻探测 @ /，菜单不跟 200ms 内容防抖绑死
        if (!isDelete) {
          scheduleDetectOnly(0);
        }
      },
      [
        imeSessionRef,
        pendingFlushRef,
        scheduleFlush,
        scheduleDetectOnly,
        setPlaceholderVisible,
        touchImeSession,
        clearMentionState,
        clearCommandState,
      ],
    );

    const handleKeyDownNative = useCallback(
      (event: KeyboardEvent) => {
        if (isImeKeyboardEvent(event)) {
          touchImeSession();
          return;
        }

        if (isComposingRef.current || imeSessionRef.current) {
          endImeSession();
          if (event.key === "Escape") {
            event.preventDefault();
            onEscape();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
            return;
          }
        }

        // mention/command 仍吃 React 风格事件；用最小 shim 复用现有逻辑
        const reactLike = {
          key: event.key,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          preventDefault: () => event.preventDefault(),
          stopPropagation: () => event.stopPropagation(),
          nativeEvent: event,
        } as unknown as React.KeyboardEvent<HTMLDivElement>;

        if (handleMentionKeyDown(reactLike)) return;
        if (handleCommandKeyDown(reactLike)) return;

        if (event.key === "Escape") {
          event.preventDefault();
          onEscape();
          return;
        }

        // 左右方向键：一次跨过一个 chip（原子跳），避免 ZWSP 双档/双锚点连按 3 下。
        if (
          (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.ctrlKey
        ) {
          const el = editorRef.current;
          if (el && editorHasComposerChips(el)) {
            const handled = navigateComposerChipArrow(
              el,
              event.key === "ArrowLeft" ? "left" : "right",
              getComposerChipBeforeCaret,
              getComposerChipAfterCaret,
            );
            if (handled) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
          }
        }

        if (event.key !== "Enter") return;

        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          const el = editorRef.current;
          if (!el) return;
          if (insertComposerLineBreak(el)) {
            scheduleFlush(0);
          }
          return;
        }

        cancelFlushTimer();
        flushComposerSideEffects();
        event.preventDefault();
        onSubmit();
      },
      [
        imeSessionRef,
        handleMentionKeyDown,
        handleCommandKeyDown,
        onSubmit,
        onEscape,
        touchImeSession,
        endImeSession,
        scheduleFlush,
        cancelFlushTimer,
        flushComposerSideEffects,
      ],
    );

    const handleClickNative = useCallback(
      (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const removeBtn = target.closest<HTMLElement>("[data-ai-image-remove]");
        if (removeBtn) {
          event.preventDefault();
          // 移除前先关预览，避免悬空浮层
          hideImagePreview();
          removeImageChip(removeBtn.dataset.aiImageRemove!);
          return;
        }
        const imageChip = getPreviewableImageChip(target);
        if (imageChip?.dataset.aiImagePreviewable === "true") {
          event.preventDefault();
          const attrs = parseImageChipAttrs(imageChip);
          const entry = attrs
            ? imageRegistryRef.current.get(attrs.imageId)
            : null;
          if (attrs && entry) {
            // 悬停浮层与全屏同时在场会互相遮挡
            hideImagePreview();
            setImagePreviewContent({
              kind: "image",
              data: entry.file,
              fileName: attrs.fileName,
            });
          }
          return;
        }
        const mentionChip = target.closest<HTMLElement>("[data-ai-mention-id]");
        const mentionId = mentionChip?.dataset.aiMentionId;
        if (mentionId) {
          event.preventDefault();
          onOpenPage(mentionId);
        }
      },
      [hideImagePreview, onOpenPage, removeImageChip, setImagePreviewContent],
    );

    const handleBlurNative = useCallback(() => {
      endImeSession();
      handleMentionBlur();
      clearCommandState();
      // 失焦时关掉图片预览，避免浮层悬空
      hideImagePreview();
    }, [endImeSession, handleMentionBlur, clearCommandState, hideImagePreview]);

    /**
     * 焦点在 contenteditable 内时粘贴：命令式节点不走 React 冒泡时 dock onPaste 可能丢。
     * Mac 截图常只有 clipboardData.items，此处与 dock 共用 extractClipboardImageFiles。
     */
    const handlePasteNative = useCallback(
      (event: ClipboardEvent) => {
        if (disabled) return;
        const imageFiles = extractClipboardImageFiles(event.clipboardData);
        if (imageFiles.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        insertImages(imageFiles);
      },
      [disabled, insertImages],
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

    return (
      <div
        className={cn(
          "relative min-w-0",
          className ?? "flex-1",
          variant === "panel" ? "w-full px-0" : compactWidthClass,
        )}
      >
        {placeholderOverlayText || placeholder ? (
          <div
            ref={placeholderRef}
            className={cn(
              "pointer-events-none absolute left-0 right-0 z-[1] text-muted-foreground opacity-70",
              variant === "panel"
                ? "top-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-6"
                : "top-0 pr-8 text-[12px] leading-[20px]",
            )}
            style={isEmpty ? undefined : { display: "none" }}
          >
            {placeholderOverlayText ?? placeholder}
          </div>
        ) : null}

        {/* 空壳：真正 contenteditable 在 useLayoutEffect 里 append，React 永不 reconcile 它 */}
        <div ref={editorHostRef} className="relative min-w-0" />
        <span
          ref={liveRegionRef}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
          data-ai-composer-live=""
        />

        {mention.active && mention.anchorRect ? (
          <ComposerSuggestionsList
            items={mentionItems}
            activeIndex={mention.activeIndex}
            listKey={mention.query}
            anchorRect={mention.anchorRect}
            onSelect={insertMention}
            onMouseDownCapture={cancelMentionBlurTimer}
          />
        ) : null}

        {command.active && command.anchorRect ? (
          <SkillSuggestionsList
            items={commandItems}
            activeIndex={command.activeIndex}
            listKey={command.query}
            anchorRect={command.anchorRect}
            onSelect={insertCommand}
          />
        ) : null}

        <FullscreenPreview
          open={Boolean(imagePreviewContent)}
          content={imagePreviewContent}
          title={imagePreviewContent?.fileName}
          onClose={() => setImagePreviewContent(null)}
        />
      </div>
    );
  },
);

AiComposerInput.displayName = "AiComposerInput";
