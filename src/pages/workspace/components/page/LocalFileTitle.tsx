/**
 * LocalFileTitle —— local-folder 页面的虚拟文件名大标题。
 *
 * 只渲染 page.localFilePath 非空时。
 * 纯展示层，**不写入 page.content**。
 * 盒模型逐项复刻 BlockNote H1 首块，保证与内部笔记本标题视觉一致：
 *   字号 = 编辑器字号 × 3（跟随 --editor-font-size 设置）、行高 1.5（bn-block-outer）、
 *   上 18px / 下 3px 内边距（heading / bn-block-content）、块底 margin 0.5em（bn-block-outer）。
 *   letter-spacing 不显式设置，与 h1 一样继承 body 的 0.01em。
 *
 * 点击进入行内编辑：Enter/失焦提交，Esc 取消。
 * 提交后调用 usePages.renameLocalPageFile(pageId, newBaseName)。
 * 重名/空名/非法字符 → sonner toast 提示，标题回退原值。
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { usePages } from "@/stores/usePages";
import { sanitizeFilenameSegment, splitFilePath } from "@/lib/local-title-binding";

interface LocalFileTitleProps {
  pageId: string;
  localFilePath: string;
}

export function LocalFileTitle({ pageId, localFilePath }: LocalFileTitleProps) {
  // Derive display name from the current file path (re-derives on pageId change / rename).
  const displayName = (() => {
    const { base } = splitFilePath(localFilePath);
    return base || "无标题";
  })();

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync displayName → editValue when not editing (handles external renames).
  useEffect(() => {
    if (!editing) {
      setEditValue(displayName);
    }
  }, [displayName, editing]);

  const startEditing = useCallback(() => {
    setEditValue(displayName);
    setEditing(true);
  }, [displayName]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditValue(displayName);
  }, [displayName]);

  const commitRename = useCallback(async () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error("文件名不能为空");
      cancelEditing();
      return;
    }

    const sanitized = sanitizeFilenameSegment(trimmed);
    if (!sanitized) {
      toast.error("文件名含非法字符，请重新输入");
      cancelEditing();
      return;
    }

    // No change — skip API call.
    const { base: currentBase } = splitFilePath(localFilePath);
    if (sanitized === currentBase) {
      setEditing(false);
      return;
    }

    setEditing(false);

    try {
      await usePages.getState().renameLocalPageFile(pageId, sanitized);
    } catch (err) {
      toast.error((err as Error).message ?? "重命名失败");
    }
  }, [editValue, localFilePath, pageId, cancelEditing]);

  // Auto-focus input on enter editing mode.
  useEffect(() => {
    if (editing) {
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [editing]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void commitRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEditing();
      }
    },
    [commitRename, cancelEditing],
  );

  if (editing) {
    return (
      <div
        className="local-file-title-wrapper"
        style={{
          paddingTop: 18,
          paddingBottom: 3,
          marginBottom: "calc(var(--editor-font-size, 16px) * 0.5)",
        }}
      >
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            void commitRename();
          }}
          style={{
            fontSize: "calc(var(--editor-font-size, 16px) * 3)",
            fontWeight: 700,
            lineHeight: 1.5,
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            padding: 0,
            margin: 0,
            color: "inherit",
            fontFamily: "inherit",
            // Block-level input, matching the h1 display
            display: "block",
          }}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    );
  }

  return (
    <div
      className="local-file-title-wrapper"
      style={{
        paddingTop: 18,
        paddingBottom: 3,
        marginBottom: "calc(var(--editor-font-size, 16px) * 0.5)",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={startEditing}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEditing();
          }
        }}
        title="点击重命名文件"
        style={{
          fontSize: "calc(var(--editor-font-size, 16px) * 3)",
          fontWeight: 700,
          lineHeight: 1.5,
          cursor: "text",
          wordBreak: "break-word",
          outline: "none",
          // No background/border — purely text, like BlockNote H1
          color: "inherit",
          fontFamily: "inherit",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {displayName}
      </div>
    </div>
  );
}
