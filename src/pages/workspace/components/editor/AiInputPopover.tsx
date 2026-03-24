import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import type { Editor } from "@tiptap/core";
import { runAITextStream, type AIMessage, type AIStreamPhase } from "@/lib/ai-provider";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";

/** 单行行高（px），用于计算 textarea 最多 4 行对应的 max-height */
const LINE_HEIGHT = 20;
const MAX_LINES = 4;

interface AiInputPopoverProps {
  editor: Editor | null;
}

const AI_SYSTEM_PROMPT =
  "你是 Goose Note 内置写作助手。输出必须直接可落文，不要解释，不要加前后缀，不要使用 Markdown 代码围栏。只输出最终文本。";

const STREAM_PHASE_META: Record<AIStreamPhase, { label: string; tone: string; dot: string }> = {
  connecting: {
    label: "正在连接",
    tone: "text-slate-500 dark:text-slate-300",
    dot: "bg-slate-400/70",
  },
  thinking: {
    label: "AI 思考中",
    tone: "text-amber-600 dark:text-amber-300",
    dot: "bg-amber-400/80",
  },
  generating: {
    label: "正在生成",
    tone: "text-sky-600 dark:text-sky-300",
    dot: "bg-sky-400/80",
  },
  finishing: {
    label: "正在整理",
    tone: "text-emerald-600 dark:text-emerald-300",
    dot: "bg-emerald-400/80",
  },
};

function getStreamPreview(streamedContent: string, reasoningText: string, phase: AIStreamPhase) {
  const cleanedText = streamedContent.trim();
  if (cleanedText) {
    return cleanedText;
  }

  const cleanedReasoning = reasoningText.replace(/\s+/g, " ").trim();
  if (cleanedReasoning) {
    return cleanedReasoning;
  }

  if (phase === "connecting") return "正在连接自定义 AI 服务…";
  if (phase === "thinking") return "正在分析上下文与任务要求…";
  if (phase === "generating") return "模型已开始输出，内容会实时出现…";
  return "正在整理最后结果…";
}

export function AiInputPopover({ editor }: AiInputPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const [initialAction, setInitialAction] = useState<"polish" | "rewrite" | "generate">("generate");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<"idle" | "streaming" | "review">("idle");
  const [streamPhase, setStreamPhase] = useState<AIStreamPhase>("connecting");
  const [streamedContent, setStreamedContent] = useState("");
  const [reasoningText, setReasoningText] = useState("");
  const [resultContent, setResultContent] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const highlightRangeRef = useRef<{ from: number; to: number } | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const pendingApplyRangeRef = useRef<{ from: number; to: number } | null>(null);
  /** 自动 apply 计时器 */
  const autoApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setStreamPhase("connecting");
        setStreamedContent("");
        setReasoningText("");
        setResultContent("");
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
          textareaRef.current?.focus();
        }, 50);
      }
    };
    document.addEventListener("open-ai-input-popover", handleOpen);
    return () => document.removeEventListener("open-ai-input-popover", handleOpen);
  }, [editor]);

  const closePopover = useCallback((restoreSelection: boolean = true) => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    if (autoApplyTimerRef.current) {
      clearTimeout(autoApplyTimerRef.current);
      autoApplyTimerRef.current = null;
    }

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
    setStreamPhase("connecting");
    setStreamedContent("");
    setReasoningText("");
    setResultContent("");
    setQuery("");
    pendingApplyRangeRef.current = null;
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

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    const controller = new AbortController();
    streamAbortRef.current = controller;

    setStatus("streaming");
    setStreamPhase("connecting");
    setStreamedContent("");
    setReasoningText("");
    setResultContent("");
    pendingApplyRangeRef.current = { from, to };

    try {
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

      const content = await runAITextStream(useSettings.getState().ai, [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ] satisfies AIMessage[], {
        abortSignal: controller.signal,
        onUpdate: (update) => {
          if (activeRequestIdRef.current !== requestId) return;
          setStreamPhase(update.phase);
          setStreamedContent(update.text);
          setReasoningText(update.reasoningText);
        },
      });
      if (!content) throw new Error("AI 没有返回可用内容");
      if (activeRequestIdRef.current !== requestId) return;

      streamAbortRef.current = null;
      pendingApplyRangeRef.current = { from: savedFrom, to: savedTo };
      setResultContent(content);
      setStatus("review");
      // 所有内容显示后 0.3 秒自动应用到编辑器
      autoApplyTimerRef.current = setTimeout(() => {
        if (!editor || editor.isDestroyed) return;
        const range = { from: savedFrom, to: savedTo };
        if (range.from !== range.to) {
          editor
            .chain()
            .focus()
            .setTextSelection({ from: range.from, to: range.to })
            .deleteSelection()
            .insertContent(content.trim())
            .run();
        } else {
          editor.chain().focus().insertContent(content.trim()).run();
        }
        highlightRangeRef.current = null;
        pendingApplyRangeRef.current = null;
        setIsOpen(false);
        isOpenRef.current = false;
        setStatus("idle");
        setStreamPhase("connecting");
        setStreamedContent("");
        setReasoningText("");
        setResultContent("");
        setQuery("");
        autoApplyTimerRef.current = null;
      }, 300);

    } catch (e: any) {
      if (controller.signal.aborted) {
        return;
      }
      console.error(e);
      closePopover(true);
    }
  }, [editor, query, closePopover, initialAction]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposing) return;
    if (e.key === "Enter" && !e.shiftKey && status === "idle") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePopover(true);
    }
  };

  /** 自动撑高 textarea，最多 MAX_LINES 行 */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = LINE_HEIGHT * MAX_LINES + 8; // +8 for padding
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
    // 新内容超出时滚动到底部
    el.scrollTop = el.scrollHeight;
  }, []);

  const handleDiscard = () => {
    setStatus("idle");
    setStreamPhase("connecting");
    setStreamedContent("");
    setReasoningText("");
    setResultContent("");
    textareaRef.current?.focus();
  };

  const handleAccept = () => {
    if (!editor) return;

    const range = pendingApplyRangeRef.current ?? highlightRangeRef.current;
    const content = resultContent.trim();
    if (!content) {
      closePopover(true);
      return;
    }

    if (range) {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: range.from, to: range.to })
        .deleteSelection()
        .insertContent(content)
        .run();
    } else {
      editor.chain().focus().insertContent(content).run();
    }

    highlightRangeRef.current = null;
    pendingApplyRangeRef.current = null;
    closePopover(false);
  };

  /** textarea 内容变化时自动撑高 */
  useEffect(() => {
    autoResize();
  }, [query, streamedContent, reasoningText, status, autoResize]);

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

  const phaseMeta = STREAM_PHASE_META[streamPhase];
  /** 输入框在思考/生成时显示的文案 */
  const streamPreview = getStreamPreview(streamedContent, reasoningText, streamPhase);
  /** textarea 展示的内容：idle 用用户输入，其他用流式内容 */
  const textareaDisplayValue = status === "idle" ? query : (status === "review" ? resultContent : streamPreview);
  const placeholderText =
    initialAction === "polish"
      ? "输入自定义润色要求..."
      : initialAction === "rewrite"
        ? "输入自定义改写要求..."
        : "让 AI 帮你写点什么...";

  return createPortal(
    <div
      data-ai-input-popover
      className={cn(
        "fixed z-[20005] flex items-center gap-1 rounded-[22px] border border-border/75 bg-popover p-1 pl-2.5",
        "shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] animate-in fade-in-0 zoom-in-95 duration-100",
        "dark:border-white/15 dark:bg-[#2f3437]",
      )}
      style={{ left: position.x, top: position.y }}
      onMouseDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("textarea, [contenteditable='true']")) return;
        event.preventDefault();
      }}
    >
      {/* 图标：思考中时 pulse，否则绿色 */}
      <LucideIcons.Sparkles
        className={cn(
          "h-3 w-3 shrink-0 self-center",
          status === "streaming"
            ? "text-sky-500 animate-pulse"
            : "text-[#10b981]",
        )}
      />

      {/* 统一输入区：idle 可编辑，streaming/review 只读展示流式内容 */}
      <textarea
        ref={textareaRef}
        value={textareaDisplayValue}
        readOnly={status !== "idle"}
        rows={1}
        onChange={(e) => {
          if (status !== "idle") return;
          setQuery(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={placeholderText}
        className={cn(
          "flex-1 resize-none overflow-y-auto bg-transparent text-[12px] leading-5 outline-none",
          "placeholder:text-muted-foreground/60 scrollbar-hide",
          status === "idle"
            ? "w-[160px] sm:w-[180px] text-foreground"
            : "w-[220px] text-foreground/80",
        )}
        style={{
          minHeight: `${LINE_HEIGHT}px`,
          maxHeight: `${LINE_HEIGHT * MAX_LINES + 8}px`,
        }}
      />

      {/* 提交按钮 / 点点动效 */}
      {status === "idle" && (
        <button
          onClick={handleSubmit}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10b981] hover:bg-[#059669] text-white transition-colors"
        >
          <LucideIcons.Check className="h-3 w-3" strokeWidth={3} />
        </button>
      )}

      {status === "streaming" && (
        <span className="flex items-center gap-1 shrink-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <span
              key={`wave-dot-${index}`}
              className={cn("ai-stream-wave-dot h-1.5 w-1.5 rounded-full", phaseMeta.dot)}
              style={{ animationDelay: `${index * 0.14}s` }}
            />
          ))}
        </span>
      )}
    </div>,
    document.body
  );
}
