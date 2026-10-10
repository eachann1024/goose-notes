import { useCallback } from "react";
import { isImeKeyboardEvent } from "@/hooks/useImeInput";
import {
  editorHasComposerChips,
  getComposerChipBeforeCaret,
  getComposerChipAfterCaret,
} from "./composerChipDom";
import { navigateComposerChipArrow } from "./composerCaret";
import { insertComposerLineBreak } from "./composerEditorDom";
import type { AiComposerInputProps } from "./composerInputTypes";
import type { ComposerContentState } from "./useComposerContentState";
import type { useComposerFlush } from "./useComposerFlush";

type SuggestionKeyboardHandler = (
  event: React.KeyboardEvent<HTMLDivElement>,
) => boolean;
export function useComposerKeyboard(
  props: AiComposerInputProps,
  state: ComposerContentState,
  flush: ReturnType<typeof useComposerFlush>,
  handleMentionKeyDown: SuggestionKeyboardHandler,
  handleCommandKeyDown: SuggestionKeyboardHandler,
) {
  const { onSubmit, onEscape } = props;
  const { editorRef, isComposingRef } = state;
  const {
    imeSessionRef,
    touchImeSession,
    endImeSession,
    scheduleFlush,
    cancelFlushTimer,
    flushComposerSideEffects,
  } = flush;
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

  return handleKeyDownNative;
}
