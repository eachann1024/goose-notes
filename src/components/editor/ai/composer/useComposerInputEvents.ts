import { useCallback } from "react";
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
import type { ComposerContentState } from "./useComposerContentState";
import type { useComposerFlush } from "./useComposerFlush";

export function useComposerInputEvents(
  state: ComposerContentState,
  flush: ReturnType<typeof useComposerFlush>,
  clearMentionState: () => void,
  clearCommandState: () => void,
) {
  const { editorRef, isComposingRef, setPlaceholderVisible } = state;
  const {
    imeSessionRef,
    pendingFlushRef,
    scheduleFlush,
    scheduleDetectOnly,
    touchImeSession,
  } = flush;
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

  return { handleBeforeInputNative, handleInputNative };
}
