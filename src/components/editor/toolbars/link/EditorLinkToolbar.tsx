import type { LinkToolbarProps } from "@blocknote/react";
import { useBlockNoteEditor } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEditorPlatform } from "@/components/editor/platform/context";
import { useEditorSettings } from "@/components/editor/platform/hostContext";

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
  const { openLinksInHost } = useEditorSettings();
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(url);
  const [editText, setEditText] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditUrl(url);
    setEditText(text);
  }, [url, text]);

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
    if (target) {
      void platform.shell.openUrl(target, openLinksInHost);
    }
  }, [url, platform, openLinksInHost]);

  const startEditing = useCallback(() => {
    if (!editor.isEditable) return;
    setEditing(true);
    setToolbarPositionFrozen?.(true);
  }, [editor.isEditable, setToolbarPositionFrozen]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditUrl(url);
    setEditText(text);
    setToolbarPositionFrozen?.(false);
  }, [url, text, setToolbarPositionFrozen]);

  if (editing) {
    return (
      <div
        data-goose-link-toolbar
        data-goose-link-toolbar-editing=""
        className="flex w-[480px] max-w-[min(480px,80vw)] items-center gap-1.5"
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
            className="goose-link-toolbar-input"
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
            className="goose-link-toolbar-input"
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
          <Button size="sm" className="goose-link-toolbar-form-button" onClick={handleSave}>
            保存
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="goose-link-toolbar-form-button"
            onClick={cancelEditing}
          >
            取消
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-goose-link-toolbar
      className="flex items-center"
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {editor.isEditable ? (
        <button
          type="button"
          onClick={startEditing}
          className="goose-link-toolbar-control"
        >
          <LucideIcons.Pencil />
          编辑
        </button>
      ) : null}
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
        className="goose-link-toolbar-control"
      >
        <LucideIcons.ExternalLink />
        打开
      </button>
      {editor.isEditable ? (
        <button
          type="button"
          onClick={handleDelete}
          className="goose-link-toolbar-control goose-link-toolbar-control-danger"
        >
          <LucideIcons.Unlink />
          移除
        </button>
      ) : null}
    </div>
  );
}
