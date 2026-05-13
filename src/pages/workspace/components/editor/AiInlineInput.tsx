import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiSessions } from "@/stores/useAiSessions";
import { OPEN_AI_WORKSPACE_EVENT } from "../ai/events";
import type { BlockNoteEditor } from "@blocknote/core";

interface AiInlineInputState {
  open: boolean;
  x: number;
  y: number;
  selectedText: string;
  initialAction: "polish" | "rewrite" | "generate";
}

const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT_ESTIMATE = 44;

export function AiInlineInput() {
  const [state, setState] = useState<AiInlineInputState>({
    open: false,
    x: 0,
    y: 0,
    selectedText: "",
    initialAction: "generate",
  });
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const computePosition = useCallback(
    (editor: BlockNoteEditor, overrideRect?: DOMRect) => {
      let x = 0;
      let y = 0;

      if (overrideRect) {
        x = overrideRect.left + overrideRect.width / 2 - POPOVER_WIDTH / 2;
        y = overrideRect.top - POPOVER_HEIGHT_ESTIMATE - 8;
        if (y < 10) {
          y = overrideRect.bottom + 8;
        }
      } else {
        // 优先使用选中文本的 rect（最准确）
        const domSelection = window.getSelection();
        let textRect: DOMRect | null = null;
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          if (!range.collapsed) {
            textRect = range.getBoundingClientRect();
          }
        }

        if (textRect && textRect.width > 0) {
          x = textRect.left + textRect.width / 2 - POPOVER_WIDTH / 2;
          y = textRect.top - POPOVER_HEIGHT_ESTIMATE - 8;
          if (y < 10) {
            y = textRect.bottom + 8;
          }
        } else {
          // fallback 到当前 block 的 rect
          let targetBlock = editor.getTextCursorPosition().block;
          const editorSelection = editor.getSelection();
          if (editorSelection && editorSelection.blocks.length > 0) {
            targetBlock = editorSelection.blocks[0];
          }

          const blockEl = document.querySelector(
            `[data-id="${targetBlock.id}"]`,
          ) as HTMLElement | null;

          if (blockEl) {
            const rect = blockEl.getBoundingClientRect();
            x = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
            y = rect.top - POPOVER_HEIGHT_ESTIMATE - 8;
            if (y < 10) {
              y = rect.bottom + 8;
            }
          } else {
            x = window.innerWidth / 2 - POPOVER_WIDTH / 2;
            y = window.innerHeight / 2 - POPOVER_HEIGHT_ESTIMATE / 2;
          }
        }
      }

      // 边界保护
      x = Math.max(12, Math.min(x, window.innerWidth - POPOVER_WIDTH - 12));
      y = Math.max(12, Math.min(y, window.innerHeight - POPOVER_HEIGHT_ESTIMATE - 12));

      return { x, y };
    },
    [],
  );

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{
        editor: BlockNoteEditor;
        initialAction?: "polish" | "rewrite" | "generate";
        overrideRect?: DOMRect;
      }>;

      const editor = customEvent.detail?.editor;
      if (!editor) return;

      const { x, y } = computePosition(editor, customEvent.detail?.overrideRect);

      let selectedText = "";
      try {
        selectedText = editor.getSelectedText() || "";
      } catch {
        /* ignore */
      }

      setQuery("");
      setState({
        open: true,
        x,
        y,
        selectedText,
        initialAction: customEvent.detail?.initialAction || "generate",
      });

      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    };

    document.addEventListener("open-ai-input-popover", handleOpen);
    return () => document.removeEventListener("open-ai-input-popover", handleOpen);
  }, [computePosition]);

  const closeInput = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
    setQuery("");
  }, []);

  const handleSubmit = useCallback(() => {
    const text = query.trim();
    const { selectedText, initialAction } = stateRef.current;

    if (!text && !selectedText) {
      closeInput();
      return;
    }

    // 构建提示词
    let prompt = text;
    if (selectedText) {
      if (initialAction === "polish") {
        prompt = text
          ? `润色要求：${text}\n\n原文：${selectedText}`
          : `请润色下面这段文字：\n${selectedText}`;
      } else if (initialAction === "rewrite") {
        prompt = text
          ? `改写要求：${text}\n\n原文：${selectedText}`
          : `请改写下面这段文字：\n${selectedText}`;
      } else if (text) {
        prompt = `${text}\n\n参考内容：\n${selectedText}`;
      } else {
        prompt = `请处理下面这段文字：\n${selectedText}`;
      }
    }

    // 设置 draft 并打开 AI Workspace
    const draftContent = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph" as const,
          content: [{ type: "text" as const, text: prompt }],
        },
      ],
    };

    useAiSessions.getState().setDraftContent(draftContent);
    useAiSessions.getState().resetActiveState();

    window.dispatchEvent(
      new CustomEvent(OPEN_AI_WORKSPACE_EVENT, {
        detail: { source: "inline_input" as const },
      }),
    );

    closeInput();
  }, [query, closeInput]);

  // 全局点击关闭
  useEffect(() => {
    if (!state.open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-ai-inline-input]")) return;
      closeInput();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [state.open, closeInput]);

  // Escape 关闭
  useEffect(() => {
    if (!state.open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeInput();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [state.open, closeInput]);

  if (!state.open) return null;

  const placeholderMap = {
    polish: "输入润色要求，或直接回车...",
    rewrite: "输入改写要求，或直接回车...",
    generate: "让 AI 帮你写点什么...",
  };

  return createPortal(
    <div
      data-ai-inline-input
      className={cn(
        "fixed z-[20005] flex items-center gap-2 rounded-xl border border-border/70 bg-popover px-3 py-2 shadow-[0_12px_32px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.06)]",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        "dark:border-white/10 dark:bg-[#2f3437]",
      )}
      style={{
        left: state.x,
        top: state.y,
        width: POPOVER_WIDTH,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <LucideIcons.Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholderMap[state.initialAction]}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
          query.trim()
            ? "bg-emerald-500 text-white hover:bg-emerald-600"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
        )}
      >
        <LucideIcons.ArrowUp className="h-3 w-3" />
      </button>
    </div>,
    document.body,
  );
}
