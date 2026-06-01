import type { LinkToolbarProps } from "@blocknote/react";
import { useBlockNoteEditor } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEditorPlatform } from "@/components/editor/platform/context";

function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function EditorLinkToolbar({
  url,
  text,
  range,
  setToolbarOpen,
  setToolbarPositionFrozen,
}: LinkToolbarProps) {
  const editor = useBlockNoteEditor();
  const platform = useEditorPlatform();
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(url);
  const [editText, setEditText] = useState(text);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditUrl(url);
    setEditText(text);
  }, [url, text]);

  // hover 显示链接工具栏时延迟出现，避免鼠标划过链接立即弹出
  useEffect(() => {
    if (editing) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const timer = window.setTimeout(() => setVisible(true), 450);
    return () => window.clearTimeout(timer);
  }, [editing, url, range.from]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    const trimmedUrl = editUrl.trim();
    if (trimmedUrl) {
      editor.editLink(trimmedUrl, editText.trim() || text, range.from);
    }
    setEditing(false);
    setToolbarPositionFrozen?.(false);
  }, [editUrl, editText, text, range, editor, setToolbarPositionFrozen]);

  const handleDelete = useCallback(() => {
    editor.deleteLink(range.from);
    setToolbarOpen?.(false);
  }, [editor, range, setToolbarOpen]);

  const handleOpen = useCallback(() => {
    const target = normalizeExternalUrl(url);
    if (target) void platform.shell.openUrl(target, false);
  }, [url, platform]);

  const startEditing = useCallback(() => {
    setEditing(true);
    setToolbarPositionFrozen?.(true);
  }, [setToolbarPositionFrozen]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditUrl(url);
    setEditText(text);
    setToolbarPositionFrozen?.(false);
  }, [url, text, setToolbarPositionFrozen]);

  if (editing) {
    return (
      <div
        className="flex w-[80vw] max-w-[720px] items-center gap-1.5 rounded-lg border border-border/80 bg-popover p-2 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/15 dark:bg-[#2f3437]"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("input, textarea")) return;
          e.preventDefault();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Input
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="链接文字"
            className="h-7 w-full rounded-md text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                inputRef.current?.blur();
                handleSave();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEditing();
              }
            }}
          />
          <Input
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder="https://..."
            className="h-7 w-full rounded-md text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEditing();
              }
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleSave}
          >
            保存
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={cancelEditing}
          >
            取消
          </Button>
        </div>
      </div>
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-border/80 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/15 dark:bg-[#2f3437]"
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={startEditing}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-foreground/90 hover:bg-muted"
      >
        <LucideIcons.Pencil className="h-3.5 w-3.5" />
        编辑
      </button>
      <button
        type="button"
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          handleOpen();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          handleOpen();
        }}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-foreground/90 hover:bg-muted"
      >
        <LucideIcons.ExternalLink className="h-3.5 w-3.5" />
        打开
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
      >
        <LucideIcons.Unlink className="h-3.5 w-3.5" />
        移除
      </button>
    </div>
  );
}
