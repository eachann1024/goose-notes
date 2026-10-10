import { useLayoutEffect, useRef, useState } from "react";

export function PendingCreateNameInput({
  id,
  kind,
  onCommit,
  onCancel,
}: {
  id: string;
  kind: "folder" | "file";
  onCommit?: (id: string, name: string) => void;
  onCancel?: (id: string) => void;
}) {
  const defaultName = kind === "folder" ? "新建文件夹" : "未命名";
  const [value, setValue] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const committedRef = useRef(false);
  const readyToCommitBlurRef = useRef(false);

  useLayoutEffect(() => {
    const focusInput = (shouldSelect: boolean) => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      if (shouldSelect) input.select();
    };

    focusInput(true);
    const raf = window.requestAnimationFrame(() => {
      if (document.activeElement !== inputRef.current) {
        focusInput(true);
      }
    });
    const timer = window.setTimeout(() => {
      readyToCommitBlurRef.current = true;
      if (document.activeElement !== inputRef.current) {
        focusInput(true);
      }
    }, 280);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    const next = value.trim();
    if (!next) {
      committedRef.current = true;
      onCancel?.(id);
      return;
    }
    committedRef.current = true;
    onCommit?.(id, next);
  };

  return (
    <span className="relative z-20 flex min-w-0 flex-1 items-center">
      <input
        ref={inputRef}
        className="h-[22px] w-full min-w-0 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 text-sm leading-5 text-foreground outline-none focus:border-[hsl(var(--ring))]"
        value={value}
        placeholder={defaultName}
        draggable={false}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={() => {
          if (!readyToCommitBlurRef.current) {
            window.requestAnimationFrame(() => {
              inputRef.current?.focus();
              inputRef.current?.select();
            });
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            if (committedRef.current) return;
            committedRef.current = true;
            onCancel?.(id);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={kind === "folder" ? "文件夹名称" : "文件名称"}
      />
    </span>
  );
}
