import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "@/components/ui/sonner";
import {
  getPageTitle,
  UNTITLED_PAGE_TITLE,
  withInternalPageTitle,
} from "@/components/editor/utils/page-title";
import { extractTitleFromContent } from "@/components/editor/utils/content-text-extractor";
import { usePages } from "@/stores/usePages";
import type { Page } from "@/types";
import {
  completePageTitleFocus,
  isPageTitleFocusRequested,
  subscribePageTitleFocus,
} from "@/lib/page-title-focus";
import { useImeInput } from "@/hooks/useImeInput";
import { splitFilePath } from "@/lib/local-title-binding";
import {
  shouldStartWindowDrag,
  startWindowDragging,
} from "@/lib/electron/windowDrag";
import { localPageHasPersistableContent } from "@/lib/unsavedLocalPage";

interface SingleTabTitleProps {
  page: Page;
  /** Electron 顶栏：闲置按住拖窗口，单击才进入编辑。uTools 页头不传。 */
  idleWindowDrag?: boolean;
  /** tab-pill：嵌在标签页里改名，外观跟普通标签文字一致。 */
  surface?: "page-header" | "tab-pill";
}

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;

const TITLE_IDLE_CLASS =
  "inline-flex h-8 items-center rounded-[7px] border border-transparent bg-transparent px-2 text-sm font-semibold leading-8 text-foreground no-underline outline-none transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]";

const TITLE_INPUT_CLASS = `${TITLE_IDLE_CLASS} focus:border-primary/45 focus:bg-[hsl(var(--goose-editor-bg))] focus:text-[var(--goose-interactive-selected-fg)] focus:ring-2 focus:ring-primary/15 caret-[var(--goose-interactive-selected-fg)]`;

const TITLE_TAB_IDLE_CLASS =
  "inline-flex h-8 min-w-0 w-full flex-1 items-center truncate bg-transparent px-0 text-sm leading-8 text-inherit no-underline outline-none";

const TITLE_TAB_INPUT_CLASS = `${TITLE_TAB_IDLE_CLASS} caret-[var(--goose-interactive-selected-fg)] focus:text-[var(--goose-interactive-selected-fg)]`;

/**
 * 铺满主栏剩余宽度（到右侧 AI / 菜单为止）。
 * Electron 拖窗口会丢掉 input 的 size 固有宽，必须写死 w-full，不能随文字收缩。
 */
const TITLE_SIZE_FILL = "min-w-0 w-full flex-1";

export function SingleTabTitle({
  page,
  idleWindowDrag = false,
  surface = "page-header",
}: SingleTabTitleProps) {
  const currentTitle = getPageTitle(page);
  const locked = Boolean(page.isLocked || page.trashedAt);
  const [initiallyFocused] = useState(() =>
    isPageTitleFocusRequested(page.id),
  );
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
  const committingRef = useRef(false);
  const skipNextBlurCommitRef = useRef(false);

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

  const commit = useCallback(async (moveToBody = false) => {
    if (locked || committingRef.current) return;
    const nextTitle = valueRef.current.trim() || UNTITLED_PAGE_TITLE;
    if (INVALID_FILENAME_CHARS.test(nextTitle)) {
      toast.error('标题不能包含 \\ / : * ? " < > |');
      inputRef.current?.focus();
      return;
    }
    const storedTitle = page.localFilePath
      ? currentTitle
      : extractTitleFromContent(page.content).trim();
    if (nextTitle === currentTitle && storedTitle === currentTitle) {
      setValue(nextTitle);
      if (moveToBody) {
        window.dispatchEvent(new CustomEvent("goose-note:focus-editor-body"));
      }
      return;
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
            toast.error("创建文件失败");
            inputRef.current?.focus();
            return;
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
        window.dispatchEvent(new CustomEvent("goose-note:focus-editor-body"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("重命名失败", { description: message });
      inputRef.current?.focus();
    } finally {
      committingRef.current = false;
    }
  }, [currentTitle, locked, page, setValue, valueRef]);

  const sizeClass = TITLE_SIZE_FILL;
  const inTab = surface === "tab-pill";
  const idleClass = inTab ? TITLE_TAB_IDLE_CLASS : TITLE_IDLE_CLASS;
  const inputClass = inTab ? TITLE_TAB_INPUT_CLASS : TITLE_INPUT_CLASS;
  const lockedClass = inTab
    ? `${sizeClass} inline-flex h-8 items-center truncate px-0 text-sm leading-8 text-inherit no-underline`
    : `${sizeClass} inline-flex h-8 items-center truncate px-2 text-sm font-semibold leading-8 text-foreground no-underline`;

  if (locked) {
    return (
      <span className={lockedClass} title={currentTitle}>
        {currentTitle}
      </span>
    );
  }

  const exitEditing = () => {
    if (idleWindowDrag) setEditing(false);
  };

  const beginEditing = () => {
    if (windowDragStartedRef.current) return;
    setEditing(true);
  };

  const onIdlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    windowDragStartedRef.current = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (ev: PointerEvent) => {
      if (windowDragStartedRef.current) return;
      if (!shouldStartWindowDrag(startX, startY, ev.clientX, ev.clientY)) return;
      windowDragStartedRef.current = true;
      window.removeEventListener("pointermove", onMove);
      void startWindowDragging();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  if (idleWindowDrag && !editing) {
    return (
      <button
        type="button"
        data-electron-no-drag
        aria-label="笔记标题"
        title="点击编辑笔记标题"
        className={`${idleClass} ${sizeClass} truncate text-left ${inTab ? "cursor-text" : "cursor-default"}`}
        onPointerDown={onIdlePointerDown}
        onClick={beginEditing}
      >
        {value || currentTitle}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      {...imeInputProps}
      size={1}
      data-page-title-field
      autoFocus={idleWindowDrag}
      onBlur={() => {
        if (isComposing()) return;
        // 新建页切换期间编辑器会短暂抢焦；聚焦请求尚未完成时忽略这次
        // 程序性 blur，避免把空输入提前恢复为“未命名”。
        if (isPageTitleFocusRequested(page.id)) return;
        if (skipNextBlurCommitRef.current) {
          skipNextBlurCommitRef.current = false;
          exitEditing();
          return;
        }
        void commit().then(() => {
          if (document.activeElement === inputRef.current) return;
          exitEditing();
        });
      }}
      onKeyDown={(event) => {
        if (isComposing(event)) return;
        if (event.key === "Enter") {
          event.preventDefault();
          skipNextBlurCommitRef.current = true;
          event.currentTarget.blur();
          void commit(true);
          exitEditing();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(currentTitle);
          skipNextBlurCommitRef.current = true;
          event.currentTarget.blur();
          exitEditing();
        }
      }}
      aria-label="笔记标题"
      title="点击编辑笔记标题"
      spellCheck={false}
      autoComplete="off"
      className={`${inputClass} ${sizeClass} box-border`}
    />
  );
}
