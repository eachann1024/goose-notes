/**
 * IME 会话锁与输入防抖 flush / @/ 探测调度。
 * 被 AiComposerInput 组装，在 mention/skill hook 之后调用。
 * 依赖 editor DOM 是否为空、mention/skill 探测回调。
 */
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { isEditorDomEmpty } from "./composerChipDom";

export function useComposerFlush(options: {
  editorRef: RefObject<HTMLDivElement | null>;
  isComposingRef: RefObject<boolean>;
  detectMention: () => void;
  detectCommand: () => void;
  clearMentionState: () => void;
  clearCommandState: () => void;
  emitCurrentContent: () => void;
  setPlaceholderVisible: (visible: boolean) => void;
}) {
  const {
    editorRef,
    isComposingRef,
    detectMention,
    detectCommand,
    clearMentionState,
    clearCommandState,
    emitCurrentContent,
    setPlaceholderVisible,
  } = options;

  const imeSessionRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRafRef = useRef<number | null>(null);
  const pendingFlushRef = useRef(false);

  const flushComposerSideEffects = useCallback(() => {
    pendingFlushRef.current = false;
    const el = editorRef.current;
    // 先探测 @ /，再 emit，避免菜单被内容同步拖慢
    if (el && !isEditorDomEmpty(el)) {
      detectMention();
      detectCommand();
    } else {
      clearMentionState();
      clearCommandState();
    }
    emitCurrentContent();
  }, [
    editorRef,
    emitCurrentContent,
    detectMention,
    detectCommand,
    clearMentionState,
    clearCommandState,
  ]);

  const cancelFlushTimer = useCallback(() => {
    if (flushTimerRef.current != null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (flushRafRef.current != null) {
      cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }
  }, []);

  const cancelDetectTimer = useCallback(() => {
    if (detectTimerRef.current != null) {
      clearTimeout(detectTimerRef.current);
      detectTimerRef.current = null;
    }
  }, []);

  /**
   * 仅探测 @ / Skill，不写 store。输入 `/` `@` 时用短延迟立刻开菜单，
   * 完整内容 emit 仍走 scheduleFlush 防抖。
   */
  const scheduleDetectOnly = useCallback(
    (delayMs: number) => {
      cancelDetectTimer();
      detectTimerRef.current = setTimeout(() => {
        detectTimerRef.current = null;
        if (imeSessionRef.current || isComposingRef.current) return;
        const el = editorRef.current;
        if (!el || isEditorDomEmpty(el)) {
          clearMentionState();
          clearCommandState();
          return;
        }
        detectMention();
        detectCommand();
      }, delayMs);
    },
    [
      editorRef,
      isComposingRef,
      cancelDetectTimer,
      clearMentionState,
      clearCommandState,
      detectMention,
      detectCommand,
    ],
  );

  /**
   * 防抖 + 双 rAF：删除整行时浏览器先改 DOM，我们等布局稳定再扫，
   * 避免和 contenteditable 内部删除抢主线程。
   */
  const scheduleFlush = useCallback(
    (delayMs: number) => {
      cancelFlushTimer();
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        if (imeSessionRef.current || isComposingRef.current) {
          pendingFlushRef.current = true;
          return;
        }
        flushRafRef.current = requestAnimationFrame(() => {
          flushRafRef.current = requestAnimationFrame(() => {
            flushRafRef.current = null;
            if (imeSessionRef.current || isComposingRef.current) {
              pendingFlushRef.current = true;
              return;
            }
            flushComposerSideEffects();
          });
        });
      }, delayMs);
    },
    [cancelFlushTimer, flushComposerSideEffects, isComposingRef],
  );

  /**
   * 开启 IME 会话：期间禁止一切 setState / 写 store。
   * 只由 compositionend、非 229 按键、blur 结束——绝不用短超时，
   * 否则选词窗停住时会中途 setState，微信输入法直接卡死。
   */
  const touchImeSession = useCallback(() => {
    imeSessionRef.current = true;
    isComposingRef.current = true;
    pendingFlushRef.current = true;
    cancelFlushTimer();
    setPlaceholderVisible(false);
  }, [cancelFlushTimer, isComposingRef, setPlaceholderVisible]);

  const endImeSession = useCallback(() => {
    if (!imeSessionRef.current && !isComposingRef.current) {
      if (pendingFlushRef.current) scheduleFlush(0);
      return;
    }
    imeSessionRef.current = false;
    isComposingRef.current = false;
    // 延后一拍 flush，避开选词提交与 React 同帧
    scheduleFlush(0);
  }, [isComposingRef, scheduleFlush]);

  useEffect(() => {
    return () => {
      cancelFlushTimer();
      cancelDetectTimer();
    };
  }, [cancelFlushTimer, cancelDetectTimer]);

  return {
    imeSessionRef,
    pendingFlushRef,
    flushComposerSideEffects,
    cancelFlushTimer,
    scheduleDetectOnly,
    scheduleFlush,
    touchImeSession,
    endImeSession,
  };
}
