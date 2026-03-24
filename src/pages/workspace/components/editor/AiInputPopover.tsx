import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import type { Editor } from "@tiptap/core";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";

interface AiInputPopoverProps {
  editor: Editor | null;
}

export function AiInputPopover({ editor }: AiInputPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const [initialAction, setInitialAction] = useState<"polish" | "rewrite" | "generate">("generate");
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "review">("idle");
  const [isComposing, setIsComposing] = useState(false);
  const highlightRangeRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{
        editor: Editor;
        initialAction?: "polish" | "rewrite" | "generate";
        overrideRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
        triggeredBy?: "space";
      }>;
      if (customEvent.detail.editor === editor) {
        
        // Calculate coordinates based on selection
        const { to, from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        
        const windowWidth = window.innerWidth;
        const popoverWidth = 220; // estimate max width of mini popover
        
        let x = coords.left;
        let y = 0;

        const overrideRect = customEvent.detail.overrideRect;
        if (overrideRect) {
          x = overrideRect.left + (overrideRect.width / 2) - (popoverWidth / 2);
          // Place exactly at the bubble menu toolbar position
          y = overrideRect.top;
          if (y < 60) {
            y = overrideRect.bottom + 8;
          }
          if (x + popoverWidth > windowWidth - 16) {
            x = windowWidth - popoverWidth - 16;
          } else if (x < 16) {
            x = 16;
          }
        } else {
          // Fallback if no override rect provided
          if (x + popoverWidth > windowWidth - 16) {
            x = windowWidth - popoverWidth - 16;
          }
          const isSelection = from !== to;
          y = coords.top - (isSelection ? 85 : 42); 
          if (y < 60) {
            y = coords.bottom + (isSelection ? 45 : 8);
          }

          if (customEvent.detail.triggeredBy === "space") {
            x -= 25;
            y += 10;
          }
        }

        setPosition({ x, y });

        setIsOpen(true);
        isOpenRef.current = true;
        setStatus("idle");
        setQuery("");
        setInitialAction(customEvent.detail.initialAction || "generate");
        
        if (from !== to) {
          highlightRangeRef.current = { from, to };
          // 仅折叠选区以隐藏气泡菜单，保留原范围供后续恢复/替换
          editor.chain().setTextSelection(to).run();
        } else {
          highlightRangeRef.current = null;
        }

        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      }
    };
    document.addEventListener("open-ai-input-popover", handleOpen);
    return () => document.removeEventListener("open-ai-input-popover", handleOpen);
  }, [editor]);

  const closePopover = useCallback((restoreSelection: boolean = true) => {
    if (highlightRangeRef.current) {
      if (restoreSelection && editor && !editor.isDestroyed) {
        editor.chain()
          .setTextSelection({ from: highlightRangeRef.current.from, to: highlightRangeRef.current.to })
          .run();
      }
      highlightRangeRef.current = null;
    }

    setIsOpen(false);
    isOpenRef.current = false;
    setStatus("idle");
    setQuery("");
    if (restoreSelection) {
      editor?.commands.focus();
    }
  }, [editor]);

  const handleSubmit = useCallback(async () => {
    if (!editor) return;

    // From highlight range, not current collapsed selection.
    const from = highlightRangeRef.current?.from ?? editor.state.selection.from;
    const to = highlightRangeRef.current?.to ?? editor.state.selection.to;
    const finalQuery = query.trim();

    // 如果是输入状态且没有输入内容、也没有选中文字，且不是特定的操作
    if (!finalQuery && initialAction === "generate") {
      closePopover();
      return;
    }

    setStatus("loading");

    try {
      const support = (window as any).utools?.ai;
      if (!support) {
        closePopover();
        return;
      }

      const modelId = useSettings.getState().ai.selectedModelId || "deepseek-v3";
      // 在读取文本前先快照范围，避免后续操作影响 ref
      const savedFrom = from;
      const savedTo = to;
      const text = editor.state.doc.textBetween(savedFrom, savedTo, "\n", "\n").trim();

      // 获取选区所在段落的完整文本作为上下文，防止 AI 脱离语境过度发散
      const { $from } = editor.state.doc.resolve(savedFrom) ? { $from: editor.state.doc.resolve(savedFrom) } : { $from: null };
      const blockText = $from ? editor.state.doc.textBetween($from.start(), $from.end(), "\n", "\n").trim() : "";
      // 判断是否为部分选中（选中内容 ≠ 段落全文）
      const isPartial = text && blockText && text !== blockText;
      
      let prompt = finalQuery;
      if (text) {
        if (!finalQuery) {
          if (initialAction === "polish") {
            prompt = isPartial
              ? `完整句子是：「${blockText}」\n其中「${text}」需要润色。请只输出润色后用来替换「${text}」的文字，保持与前后文衔接自然，不要输出完整句子，不要解释。`
              : `请润色下面这段中文，保留原意，只输出润色结果：\n\n${text}`;
          } else if (initialAction === "rewrite") {
            prompt = isPartial
              ? `完整句子是：「${blockText}」\n其中「${text}」需要改写得更正式。请只输出改写后用来替换「${text}」的文字，保持与前后文衔接自然，不要输出完整句子，不要解释。`
              : `请将下面内容改写得更正式、更适合文档语气，只输出改写结果：\n\n${text}`;
          } else {
            prompt = `请处理这段文本，只输出处理结果：\n\n${text}`;
          }
        } else {
          prompt = isPartial
            ? `完整句子是：「${blockText}」\n其中「${text}」需要处理。任务：${finalQuery}\n请只输出用来替换「${text}」的文字，不要输出完整句子，不要解释。`
            : `针对以下文本执行任务：${finalQuery}\n\n文本：${text}`;
        }
      }

      // system prompt 约束输出格式，防止 AI 加解释、前后缀
      const systemPrompt = "你是 Goose Note 内置写作助手。输出必须直接可落文，不要解释，不要加前后缀，不要使用 Markdown 代码围栏。只输出最终文本。";

      const result = await support({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      });

      const content = result?.content?.trim();
      if (!content) throw new Error("AI 没有返回可用内容");

      // 清除高亮 ref，防止 closePopover 尝试恢复旧选区
      highlightRangeRef.current = null;

      if (savedFrom !== savedTo) {
        // 精确选中原始选区后替换内容，不碰其余格式
        editor
          .chain()
          .focus()
          .setTextSelection({ from: savedFrom, to: savedTo })
          .deleteSelection()
          .insertContent(content)
          .run();
      } else {
        editor.chain().focus().insertContent(content).run();
      }

      setStatus("review");

    } catch (e: any) {
      console.error(e);
      closePopover(true);
    }
  }, [editor, query, closePopover, initialAction]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposing) return;
    if (e.key === "Enter" && status === "idle") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePopover(true);
    }
  };

  const handleDiscard = () => {
    editor?.commands.undo();
    closePopover(true);
  };

  const handleAccept = () => {
    closePopover(false);
  };

  // 依赖全局点击关闭面板，但排除自身和编辑面板
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-ai-input-popover]")) return;
      closePopover(true);
    };

    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, [isOpen, closePopover]);

  if (!editor || !isOpen) return null;

  return createPortal(
    <div
      data-ai-input-popover
      className={cn(
        "fixed z-[20005] flex items-center gap-1 rounded-full border border-border/75 bg-popover p-1 pl-2.5",
        "shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] animate-in fade-in-0 zoom-in-95 duration-100",
        "dark:border-white/15 dark:bg-[#2f3437]",
      )}
      style={{ left: position.x, top: position.y }}
      onMouseDownCapture={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("input, textarea, [contenteditable='true']")) {
            return;
          }
          event.preventDefault(); // keep editor focused by preventing default
      }}
    >
      <LucideIcons.Sparkles
        className={cn(
          "h-3 w-3 shrink-0",
          status === "loading"
            ? "text-blue-500 animate-pulse"
            : "text-[#10b981]",
        )}
      />
      
      {status === "idle" && (
        <>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={
              initialAction === "polish"
                ? "输入自定义润色要求..."
                : initialAction === "rewrite"
                  ? "输入自定义改写要求..."
                  : "让 AI 帮你写点什么..."
            }
            className="flex-1 bg-transparent w-[160px] sm:w-[180px] text-[12px] outline-none placeholder:text-muted-foreground/60 text-foreground"
          />
          <button
            onClick={handleSubmit}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10b981] hover:bg-[#059669] text-white transition-colors"
          >
            <LucideIcons.Check className="h-3 w-3" strokeWidth={3} />
          </button>
        </>
      )}

      {status === "loading" && (
        <span className="flex-1 w-[160px] sm:w-[180px] text-[12px] text-muted-foreground ml-1">
          AI 正在思考中...
        </span>
      )}

      {status === "review" && (
        <>
          <span className="flex-1 w-[110px] text-[11px] text-foreground font-medium ml-0.5">
            AI 结果已生成
          </span>
          <button
            onClick={handleDiscard}
            className="flex px-2 h-5 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-[10px] font-medium transition-colors"
          >
            撤回
          </button>
          <button
            onClick={handleAccept}
            className="flex px-2 h-5 shrink-0 items-center justify-center rounded-full bg-[#10b981] hover:bg-[#059669] text-[10px] text-white font-medium transition-colors"
          >
            应用
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
