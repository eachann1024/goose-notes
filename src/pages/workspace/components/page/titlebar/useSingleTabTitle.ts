import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { getPageTitle, UNTITLED_PAGE_TITLE, withInternalPageTitle } from "@/components/editor/utils/page-title";
import { extractTitleFromContent } from "@/components/editor/utils/content-text-extractor";
import { usePages } from "@/stores/usePages";
import type { Page } from "@/types";
import { completePageTitleFocus, isPageTitleFocusRequested, subscribePageTitleFocus } from "@/lib/page-title-focus";
import { useImeInput } from "@/hooks/useImeInput";
import { splitFilePath } from "@/lib/local-title-binding";
import { localPageHasPersistableContent } from "@/lib/unsavedLocalPage";

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;

export function useSingleTabTitle(page: Page, idleWindowDrag: boolean) {
  const currentTitle = getPageTitle(page);
  const locked = Boolean(page.isLocked || page.trashedAt);
  const [initiallyFocused] = useState(() => isPageTitleFocusRequested(page.id));
  const newTitleRequestedRef = useRef(initiallyFocused);
  const [editing, setEditing] = useState(
    () => idleWindowDrag && isPageTitleFocusRequested(page.id),
  );
  const windowDragStartedRef = useRef(false);
  const {
    value,
    valueRef,
    setValue,
    isComposing,
    inputProps: imeInputProps,
  } = useImeInput(initiallyFocused ? "" : currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<CanvasRenderingContext2D | null>(null);
  const committingRef = useRef(false);
  const skipNextBlurCommitRef = useRef(false);

  const syncCaret = useCallback(() => {
    const input = inputRef.current;
    const caret = caretRef.current;
    if (!input || !caret) return;
    const position = input.selectionStart;
    if (
      document.activeElement !== input ||
      position === null ||
      position !== input.selectionEnd
    ) {
      caret.hidden = true;
      return;
    }
    const measure =
      measureRef.current ?? document.createElement("canvas").getContext("2d");
    if (!measure) return; // Canvas 不可用时保留原生光标。
    measureRef.current = measure;
    // ponytail: 当前只测单行 LTR 文件名；支持双向文本时改用 DOM 镜像定位。
    const style = getComputedStyle(input);
    measure.font = style.font;
    const tracking = parseFloat(style.letterSpacing) || 0;
    const offset =
      input.offsetLeft +
      parseFloat(style.paddingLeft) +
      measure.measureText(input.value.slice(0, position)).width +
      tracking * position -
      input.scrollLeft;
    caret.style.left = `${Math.max(input.offsetLeft, Math.min(offset, input.offsetLeft + input.clientWidth - 5))}px`;
    input.style.caretColor = "transparent";
    caret.hidden = false;
  }, []);

  useLayoutEffect(syncCaret, [syncCaret, value, editing]);

  const focusAsNewPage = useCallback(() => {
    setValue("");
  }, [setValue]);

  useLayoutEffect(() => {
    let focusFrame: number | null = null;
    let retryTimer: number | null = null;
    const stopAutoFocusOnUserPointerDown = (event: PointerEvent) => {
      if (!isPageTitleFocusRequested(page.id)) return;
      const input = inputRef.current;
      if (
        input &&
        event.target instanceof Node &&
        input.contains(event.target)
      ) {
        return;
      }

      // 挂载期的定时重试只用于抵抗编辑器自身的程序性 focus。
      // 用户已经主动点击正文或其他控件时，应立即尊重这次选择，避免后续重试抢回标题。
      completePageTitleFocus(page.id);
    };
    const focusOnce = () => {
      if (locked) return true;
      if (!isPageTitleFocusRequested(page.id)) return true;
      const input = inputRef.current;
      if (!input?.isConnected) return false;
      input.focus({ preventScroll: true });
      if (document.activeElement !== input) return false;
      // 首次真正聚焦成功就结束请求；之后不再用定时器反复 focus，
      // 因此组件重渲染或用户转去正文都不会产生第二次可见焦点框。
      completePageTitleFocus(page.id);
      return true;
    };
    const scheduleFocus = () => {
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      focusFrame = window.requestAnimationFrame(() => {
        focusFrame = null;
        focusAsNewPage();
        if (focusOnce()) return;
        // 仅当首帧 DOM 尚未可聚焦时兜底一次；成功过的 input 永不重试。
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          focusOnce();
        }, 50);
      });
    };

    document.addEventListener(
      "pointerdown",
      stopAutoFocusOnUserPointerDown,
      true,
    );
    const unsubscribe = subscribePageTitleFocus((pageId) => {
      if (locked) return;
      if (pageId === page.id && isPageTitleFocusRequested(page.id)) {
        newTitleRequestedRef.current = true;
        if (idleWindowDrag) setEditing(true);
        scheduleFocus();
      }
    });
    // pendingPageId 是 React 外部状态：请求可能发生在 render 与本 layout effect
    // 订阅建立之间。订阅后立即补读一次，避免错过已经派发的事件；StrictMode
    // 重挂载时也会从当前 pending 恢复，但成功聚焦后请求已完成，不会重复 focus。
    if (locked) {
      completePageTitleFocus(page.id);
    } else if (isPageTitleFocusRequested(page.id)) {
      newTitleRequestedRef.current = true;
      if (idleWindowDrag) setEditing(true);
      scheduleFocus();
    }
    return () => {
      unsubscribe();
      document.removeEventListener(
        "pointerdown",
        stopAutoFocusOnUserPointerDown,
        true,
      );
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [focusAsNewPage, idleWindowDrag, locked, page.id]);

  const commit = useCallback(async (moveToBody = false): Promise<boolean> => {
    if (locked || committingRef.current) return false;
    if (
      moveToBody &&
      newTitleRequestedRef.current &&
      (page.localFilePath || page.localUnsaved) &&
      !valueRef.current.trim()
    ) {
      toast.error("笔记标题不能为空");
      inputRef.current?.focus();
      return false;
    }
    const nextTitle = valueRef.current.trim() || UNTITLED_PAGE_TITLE;
    if (INVALID_FILENAME_CHARS.test(nextTitle)) {
      toast.error('标题不能包含 \\ / : * ? " < > | 等特殊字符');
      inputRef.current?.focus();
      return false;
    }
    const storedTitle = page.localFilePath
      ? currentTitle
      : extractTitleFromContent(page.content).trim();
    if (nextTitle === currentTitle && storedTitle === currentTitle) {
      setValue(nextTitle);
      if (moveToBody) {
        skipNextBlurCommitRef.current = true;
        window.dispatchEvent(new CustomEvent("goose-note:focus-editor-body"));
      }
      newTitleRequestedRef.current = false;
      return true;
    }

    committingRef.current = true;
    try {
      if (page.localFilePath) {
        await usePages.getState().renameLocalPageFile(page.id, nextTitle);
        const latestPath =
          usePages.getState().pages[page.id]?.localFilePath ?? null;
        const finalTitle = latestPath
          ? splitFilePath(latestPath).base || nextTitle
          : nextTitle;
        setValue(finalTitle);
      } else if (page.localUnsaved) {
        if (
          nextTitle === UNTITLED_PAGE_TITLE &&
          !localPageHasPersistableContent(page.content)
        ) {
          setValue(nextTitle);
        } else {
          const ok = await usePages
            .getState()
            .materializeUnsavedLocalPage(page.id, { title: nextTitle });
          if (!ok) {
            toast.error("创建笔记失败，请重试");
            inputRef.current?.focus();
            return false;
          }
          const latestPath =
            usePages.getState().pages[page.id]?.localFilePath ?? null;
          setValue(
            latestPath
              ? splitFilePath(latestPath).base || nextTitle
              : nextTitle,
          );
        }
      } else {
        usePages.getState().updatePage(page.id, {
          content: withInternalPageTitle(page.content, nextTitle),
        });
        setValue(nextTitle);
      }
      if (moveToBody) {
        skipNextBlurCommitRef.current = true;
        window.dispatchEvent(new CustomEvent("goose-note:focus-editor-body"));
      }
      newTitleRequestedRef.current = false;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("重命名失败", { description: message });
      inputRef.current?.focus();
      return false;
    } finally {
      committingRef.current = false;
    }
  }, [currentTitle, locked, page, setValue, valueRef]);

  return {
    currentTitle, locked, editing,
    setEditing, windowDragStartedRef, value,
    setValue, isComposing, imeInputProps,
    inputRef, caretRef, skipNextBlurCommitRef,
    newTitleRequestedRef, syncCaret, commit,
  };
}
