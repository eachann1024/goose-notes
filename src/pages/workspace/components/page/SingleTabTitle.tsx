import { type PointerEvent as ReactPointerEvent } from "react";
import type { Page } from "@/types";
import { isPageTitleFocusRequested } from "@/lib/page-title-focus";
import { endWindowDragging, shouldStartWindowDrag, startWindowDragging } from "@/lib/electron/windowDrag";

import { useSingleTabTitle } from "./titlebar/useSingleTabTitle";

interface SingleTabTitleProps {
  page: Page;
  /** Electron 顶栏：闲置按住拖窗口，单击才进入编辑。Electron 页头不传。 */
  idleWindowDrag?: boolean;
  /** tab-pill：嵌在标签页里改名，外观跟普通标签文字一致。 */
  surface?: "page-header" | "tab-pill";
}
const TITLE_IDLE_CLASS =
  "inline-flex h-8 items-center rounded-[7px] border border-transparent bg-transparent px-2 text-sm font-semibold leading-8 text-foreground no-underline outline-none transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]";

const TITLE_INPUT_CLASS = `${TITLE_IDLE_CLASS} focus:border-primary/45 focus:bg-[hsl(var(--goose-editor-bg))] focus:text-[var(--goose-interactive-selected-fg)] caret-[var(--goose-accent-focus)]`;

const TITLE_TAB_IDLE_CLASS =
  "inline-flex h-8 min-w-0 w-full flex-1 items-center truncate bg-transparent px-0 text-sm leading-8 text-inherit no-underline outline-none";

const TITLE_TAB_INPUT_CLASS = `${TITLE_TAB_IDLE_CLASS} caret-[var(--goose-accent-focus)] focus:text-[var(--goose-interactive-selected-fg)]`;

/** 标题铺满标签页，闲置时仍可拖动窗口。 */
const TITLE_SIZE_FILL = "min-w-0 w-full flex-1";

export function SingleTabTitle({
  page,
  idleWindowDrag = false,
  surface = "page-header",
}: SingleTabTitleProps) {
  const {
    currentTitle, locked, editing,
    setEditing, windowDragStartedRef, value,
    setValue, isComposing, imeInputProps,
    inputRef, caretRef, skipNextBlurCommitRef,
    newTitleRequestedRef, syncCaret, commit,
  } = useSingleTabTitle(page, idleWindowDrag);

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
    event.stopPropagation();
    windowDragStartedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (ev: PointerEvent) => {
      if (windowDragStartedRef.current) return;
      if (!shouldStartWindowDrag(startX, startY, ev.clientX, ev.clientY))
        return;
      windowDragStartedRef.current = true;
      window.removeEventListener("pointermove", onMove);
      void startWindowDragging();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (windowDragStartedRef.current) void endWindowDragging();
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
        data-electron-option-drag
        aria-label="笔记标题"
        title="点击编辑笔记标题"
        className={`${idleClass} ${sizeClass} truncate text-left cursor-pointer`}
        onPointerDown={onIdlePointerDown}
        onClick={beginEditing}
      >
        {value || currentTitle}
      </button>
    );
  }

  return (
    <span className="page-title-edit-shell">
      <input
        ref={inputRef}
        data-goose-inline-input=""
        value={value}
        {...imeInputProps}
        size={1}
        data-page-title-field
        autoFocus={idleWindowDrag}
        onFocus={syncCaret}
        onSelect={syncCaret}
        onKeyUp={syncCaret}
        onScroll={syncCaret}
        onBlur={() => {
          if (caretRef.current) caretRef.current.hidden = true;
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
            void commit(true).then((saved) => {
              if (saved) exitEditing();
            });
          } else if (event.key === "Escape") {
            event.preventDefault();
            setValue(currentTitle);
            skipNextBlurCommitRef.current = true;
            event.currentTarget.blur();
            exitEditing();
          }
        }}
        aria-label="笔记标题"
        placeholder={
          newTitleRequestedRef.current
            ? "输入笔记标题，按 Enter 进入正文"
            : "输入笔记标题，按 Enter 返回正文"
        }
        title="点击编辑笔记标题"
        spellCheck={false}
        autoComplete="off"
        className={`${inputClass} ${sizeClass} box-border`}
      />
      <span
        ref={caretRef}
        className="page-title-caret"
        aria-hidden="true"
        hidden
      />
    </span>
  );
}
