import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { getPageTitle, withInternalPageTitle } from "@/components/editor/utils/page-title";
import { toast } from "@/components/ui/sonner";
import { usePages } from "@/stores/usePages";
import type { Page } from "@/types";
import "./sidebar-inline-rename.css";

export const SidebarRenameContext = createContext<{
  page: Page;
  renaming: boolean;
  setRenaming: (value: boolean) => void;
  rowRef: RefObject<HTMLDivElement | null>;
} | null>(null);

export function SidebarInlineRename({ children }: { children: ReactNode }) {
  const context = useContext(SidebarRenameContext);
  return context?.renaming ? <RenameInput context={context} /> : children;
}

function RenameInput({ context }: { context: NonNullable<React.ContextType<typeof SidebarRenameContext>> }) {
  const { page, setRenaming, rowRef } = context;
  const original = page.isFolder && page.localFilePath
    ? page.localFilePath.split(/[\\/]/).pop() || ""
    : getPageTitle(page);
  const [value, setValue] = useState(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState({ position: original.length, scroll: 0, visible: true });
  const [imeActive, setImeActive] = useState(false);
  // ponytail: mirror handles left-to-right names; bidi and IME keep the native caret.
  const nativeCaret = imeActive || /[\u0590-\u08ff\u200e-\u200f\u202a-\u202e\u2066-\u2069\ufb1d-\ufeff]/.test(value);
  const syncCaret = () => {
    const input = inputRef.current;
    if (input) setCaret({
      position: input.selectionStart ?? input.value.length,
      scroll: input.scrollLeft,
      visible: document.activeElement === input && input.selectionStart === input.selectionEnd,
    });
  };
  const committing = useRef(false);
  const finished = useRef(false);
  const composing = useRef(false);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.scrollLeft = input.scrollWidth;
    syncCaret();
  }, []);

  const finish = (restoreFocus: boolean) => {
    finished.current = true;
    setRenaming(false);
    if (restoreFocus) {
      const row = rowRef.current;
      const target = row?.querySelector<HTMLElement>(".main-tree-row > [tabindex], .sidebar-tree-row[tabindex]");
      (target ?? row)?.focus({ preventScroll: true });
    }
  };

  const commit = async () => {
    if (committing.current || finished.current || composing.current) return;
    const next = value.trim();
    if (!next || next === original) {
      finish(document.activeElement === inputRef.current);
      return;
    }
    // eslint-disable-next-line no-control-regex -- 文件名校验需要明确拒绝控制字符。
    if (/[\\/:*?"<>|\x00-\x1f\x7f]/.test(next) || /^\.+$/.test(next)) {
      setError("名称不能包含路径分隔符或非法字符");
      toast.error("名称不能包含路径分隔符或非法字符");
      return;
    }
    committing.current = true;
    setBusy(true);
    try {
      const live = usePages.getState().pages[page.id];
      if (!live || live.trashedAt) throw new Error("该项目已不存在");
      if (live.localFilePath) {
        await usePages.getState().renameLocalPageFile(live.id, next);
      } else {
        usePages.getState().updatePage(live.id, {
          content: withInternalPageTitle(live.content, next),
        });
      }
      finish(document.activeElement === inputRef.current);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "重命名失败";
      setError(message);
      toast.error(message);
    } finally {
      committing.current = false;
      setBusy(false);
    }
  };

  return (
    <span className="relative z-20 flex h-full min-w-0 flex-1 items-center">
    <input
      ref={inputRef}
      data-goose-inline-input=""
      className="relative z-20 h-full w-full min-w-0 flex-1 cursor-text select-text"
      style={{ font: "inherit", lineHeight: "inherit", color: "inherit", caretColor: nativeCaret ? "var(--goose-accent-focus)" : "transparent",
        background: "transparent", border: 0, borderRadius: 0, padding: 0, margin: 0,
        outline: "none", boxShadow: "none" }}
      aria-label="重命名，Enter 确认，Escape 取消"
      aria-invalid={!!error}
      aria-description={error || "Tab 或点击其他位置保存；空名称保留原名"}
      aria-busy={busy}
      value={value}
      readOnly={busy}
      spellCheck={false}
      autoComplete="off"
      draggable={false}
      onChange={(event) => { setValue(event.target.value); setError(""); syncCaret(); }}
      onSelect={syncCaret}
      onScroll={syncCaret}
      onFocus={syncCaret}
      onCompositionStart={() => { composing.current = true; setImeActive(true); }}
      onCompositionEnd={() => { composing.current = false; setImeActive(false); syncCaret(); }}
      onBlur={() => { syncCaret(); void commit(); }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || composing.current) return;
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          if (!committing.current) finish(true);
        }
      }}
      onKeyUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onDragStart={(event) => event.preventDefault()}
    />
    {!nativeCaret && !busy && caret.visible && (
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre">
        <span className="flex items-center" style={{ transform: `translateX(-${caret.scroll}px)` }}>
          <span style={{ color: "transparent" }}>{value.slice(0, caret.position)}</span>
          <span key={`${value}:${caret.position}`} className="sidebar-rename-caret" />
        </span>
      </span>
    )}
    </span>
  );
}
