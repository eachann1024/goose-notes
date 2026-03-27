import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import type { Editor } from "@tiptap/core";
import { runAITextStream, type AIMessage, type AIStreamPhase } from "@/lib/ai-provider";
import { getAIErrorType, trackEvent } from "@/lib/analytics";
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

type StructuredListType = "bulletList" | "orderedList" | "taskList";

const STRUCTURED_LIST_KEYWORDS: Record<StructuredListType, string[]> = {
  bulletList: ["无序列表", "项目符号列表", "圆点列表", "bulletlist", "bullet"],
  orderedList: ["有序列表", "编号列表", "数字列表", "序号列表", "orderedlist", "numberedlist", "编号", "序号"],
  taskList: ["提醒事项", "提醒列表", "待办事项", "待办列表", "任务列表", "todo", "tasklist", "checklist", "复选框列表"],
};

function detectStructuredListTarget(query: string): StructuredListType | null {
  const normalized = query.toLowerCase().replace(/\s+/g, "");
  let matchedType: StructuredListType | null = null;
  let matchedIndex = -1;

  (Object.entries(STRUCTURED_LIST_KEYWORDS) as Array<[StructuredListType, string[]]>).forEach(
    ([type, keywords]) => {
      keywords.forEach((keyword) => {
        const index = normalized.lastIndexOf(keyword);
        if (index < 0) return;
        if (index > matchedIndex) {
          matchedType = type;
          matchedIndex = index;
        }
      });
    },
  );

  return matchedType;
}

function getSelectionStructure(editor: Editor, from: number, to: number) {
  const listTypes = new Set<StructuredListType>();
  let textblockCount = 0;

  const collectListType = (nodeName: string) => {
    if (nodeName === "bulletList" || nodeName === "orderedList" || nodeName === "taskList") {
      listTypes.add(nodeName);
    }
  };

  const collectAncestorListTypes = ($pos: any) => {
    for (let depth = $pos.depth; depth >= 0; depth -= 1) {
      collectListType($pos.node(depth).type.name);
    }
  };

  collectAncestorListTypes(editor.state.doc.resolve(from));
  collectAncestorListTypes(editor.state.doc.resolve(to));

  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.isTextblock) {
      textblockCount += 1;
    }
    collectListType(node.type.name);
  });

  return { listTypes, textblockCount };
}

function resolveStructuredListIntent(editor: Editor, from: number, to: number, query: string) {
  if (from === to) return null;

  const targetListType = detectStructuredListTarget(query);
  if (!targetListType) return null;

  const { listTypes, textblockCount } = getSelectionStructure(editor, from, to);
  if (!listTypes.size && textblockCount < 2) {
    return null;
  }

  return { targetListType };
}

function applyStructuredListIntent(
  editor: Editor,
  range: { from: number; to: number },
  targetListType: StructuredListType,
) {
  const didSelectRange = editor.chain().focus().setTextSelection(range).run();
  if (!didSelectRange) return "failed" as const;

  if (editor.isActive(targetListType)) {
    return "already-active" as const;
  }

  const didApply =
    targetListType === "bulletList"
      ? editor.chain().focus().toggleBulletList().run()
      : targetListType === "orderedList"
        ? editor.chain().focus().toggleOrderedList().run()
        : editor.chain().focus().toggleTaskList().run();

  return didApply ? ("applied" as const) : ("failed" as const);
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
  const [undoCapsule, setUndoCapsule] = useState<{ x: number; y: number } | null>(null);
  const undoCapsuleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoCapsuleHoveredRef = useRef(false);
  const undoCapsuleRemainingMsRef = useRef(5000);
  const undoCapsuleDeadlineRef = useRef<number | null>(null);

  const clearUndoCapsule = useCallback(() => {
    if (undoCapsuleTimerRef.current) {
      clearTimeout(undoCapsuleTimerRef.current);
      undoCapsuleTimerRef.current = null;
    }
    undoCapsuleHoveredRef.current = false;
    undoCapsuleRemainingMsRef.current = 5000;
    undoCapsuleDeadlineRef.current = null;
    setUndoCapsule(null);
  }, []);

  const scheduleUndoCapsuleHide = useCallback((delay = 5000) => {
    if (undoCapsuleTimerRef.current) {
      clearTimeout(undoCapsuleTimerRef.current);
    }
    undoCapsuleRemainingMsRef.current = delay;
    undoCapsuleDeadlineRef.current = Date.now() + delay;
    undoCapsuleTimerRef.current = setTimeout(() => {
      undoCapsuleTimerRef.current = null;
      undoCapsuleDeadlineRef.current = null;
      undoCapsuleRemainingMsRef.current = 5000;
      if (undoCapsuleHoveredRef.current) return;
      setUndoCapsule(null);
    }, delay);
  }, []);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{
        editor: Editor;
        initialAction?: "polish" | "rewrite" | "generate";
        overrideRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
        triggeredBy?: "space";
      }>;
      if (customEvent.detail.editor === editor) {
        const { to, from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);

        const windowWidth = window.innerWidth;
        const popoverWidth = 220;

        let x = coords.left;
        let y = 0;

        const overrideRect = customEvent.detail.overrideRect;
        if (overrideRect) {
          x = overrideRect.left + (overrideRect.width / 2) - (popoverWidth / 2);
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
        const nextAction = customEvent.detail.initialAction || "generate";
        setInitialAction(nextAction);
        trackEvent("ai_entry_opened", {
          feature: "ai",
          action: "open",
          source: "bubble_menu",
          entry_action: nextAction,
          has_selection: from !== to,
          selection_mode: from !== to ? "has_selection" : "empty_selection",
        });

        if (from !== to) {
          highlightRangeRef.current = { from, to };
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
    clearUndoCapsule();

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
  }, [editor, clearUndoCapsule]);

  const hidePopoverAfterApply = useCallback(() => {
    streamAbortRef.current = null;
    if (autoApplyTimerRef.current) {
      clearTimeout(autoApplyTimerRef.current);
      autoApplyTimerRef.current = null;
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
    editor?.commands.focus();
  }, [editor]);

  const showUndoCapsuleAtSelection = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const endPos = editor.state.selection.to;
    const coords = editor.view.coordsAtPos(endPos);
    setUndoCapsule({ x: coords.right + 10, y: coords.top + ((coords.bottom - coords.top) / 2) });
    scheduleUndoCapsuleHide(5000);
  }, [editor, scheduleUndoCapsuleHide]);

  const handleSubmit = useCallback(async () => {
    if (!editor) return;

    const from = highlightRangeRef.current?.from ?? editor.state.selection.from;
    const to = highlightRangeRef.current?.to ?? editor.state.selection.to;
    const finalQuery = query.trim();

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

    const savedFrom = from;
    const savedTo = to;
    const requestStartedAt = Date.now();
    const aiSettings = useSettings.getState().ai;
    const providerType = aiSettings.useCustomProvider ? aiSettings.customProtocol : "utools";
    const modelId = aiSettings.selectedModelId ?? "";

    try {
      const text = editor.state.doc.textBetween(savedFrom, savedTo, "\n", "\n").trim();
      const structuredListIntent = resolveStructuredListIntent(editor, savedFrom, savedTo, finalQuery);

      if (structuredListIntent) {
        const applyResult = applyStructuredListIntent(editor, { from: savedFrom, to: savedTo }, structuredListIntent.targetListType);

        if (applyResult === "failed") {
          throw new Error("列表类型切换失败");
        }

        if (applyResult === "applied") {
          trackEvent("ai_result_applied", {
            feature: "ai",
            action: "apply",
            result: "success",
            source: "bubble_menu",
            apply_mode: "local_command",
            usage_type: initialAction,
            provider_type: providerType,
            model_id: modelId,
          });
          showUndoCapsuleAtSelection();
        }

        hidePopoverAfterApply();
        return;
      }

      const { $from } = editor.state.doc.resolve(savedFrom) ? { $from: editor.state.doc.resolve(savedFrom) } : { $from: null };
      const blockText = $from ? editor.state.doc.textBetween($from.start(), $from.end(), "\n", "\n").trim() : "";
      const isPartial = text && blockText && text !== blockText;
      const contentScope = !text ? "new_content" : isPartial ? "partial_selection" : "full_block";
      const usageType = initialAction;
      const usageBucket = initialAction === "generate" ? "generate_new_content" : "edit_selected_content";

      trackEvent("ai_request_submitted", {
        feature: "ai",
        action: "submit",
        result: "submitted",
        source: "bubble_menu",
        usage_type: usageType,
        usage_bucket: usageBucket,
        content_scope: contentScope,
        has_selection: savedFrom !== savedTo,
        has_custom_query: Boolean(finalQuery),
        query_length: finalQuery.length,
        provider_type: providerType,
        model_id: modelId,
      });

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

      trackEvent("ai_request_succeeded", {
        feature: "ai",
        action: "success",
        result: "success",
        source: "bubble_menu",
        usage_type: initialAction,
        has_selection: savedFrom !== savedTo,
        duration_ms: Date.now() - requestStartedAt,
        provider_type: providerType,
        model_id: modelId,
        output_length: content.trim().length,
      });

      streamAbortRef.current = null;
      pendingApplyRangeRef.current = { from: savedFrom, to: savedTo };
      setResultContent(content);
      setStatus("review");
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

        showUndoCapsuleAtSelection();

        trackEvent("ai_result_applied", {
          feature: "ai",
          action: "apply",
          result: "success",
          source: "bubble_menu",
          apply_mode: "auto",
          usage_type: initialAction,
          provider_type: providerType,
          model_id: modelId,
        });
        hidePopoverAfterApply();
      }, 300);

    } catch (e: any) {
      if (controller.signal.aborted) {
        return;
      }
      trackEvent("ai_request_failed", {
        feature: "ai",
        action: "fail",
        result: "failed",
        source: "bubble_menu",
        usage_type: initialAction,
        error_type: getAIErrorType(e),
        duration_ms: Date.now() - requestStartedAt,
        has_selection: savedFrom !== savedTo,
        provider_type: providerType,
        model_id: modelId,
      });
      console.error(e);
      closePopover(true);
    }
  }, [editor, query, closePopover, initialAction, hidePopoverAfterApply, showUndoCapsuleAtSelection]);

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

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = LINE_HEIGHT * MAX_LINES + 8;
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
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

    const aiSettings = useSettings.getState().ai;
    const providerType = aiSettings.useCustomProvider ? aiSettings.customProtocol : "utools";
    const modelId = aiSettings.selectedModelId ?? "";

    trackEvent("ai_result_applied", {
      feature: "ai",
      action: "apply",
      result: "success",
      source: "bubble_menu",
      apply_mode: "manual",
      usage_type: initialAction,
      provider_type: providerType,
      model_id: modelId,
    });
    showUndoCapsuleAtSelection();
    hidePopoverAfterApply();
  };

  const handleUndoApply = () => {
    if (!editor) return;
    clearUndoCapsule();
    editor.commands.undo();
  };

  const handleUndoCapsuleMouseEnter = () => {
    undoCapsuleHoveredRef.current = true;
    if (undoCapsuleTimerRef.current) {
      clearTimeout(undoCapsuleTimerRef.current);
      undoCapsuleTimerRef.current = null;
    }
    if (undoCapsuleDeadlineRef.current) {
      undoCapsuleRemainingMsRef.current = Math.max(1, undoCapsuleDeadlineRef.current - Date.now());
      undoCapsuleDeadlineRef.current = null;
    }
  };

  const handleUndoCapsuleMouseLeave = () => {
    undoCapsuleHoveredRef.current = false;
    scheduleUndoCapsuleHide(Math.max(1, undoCapsuleRemainingMsRef.current));
  };

  useEffect(() => {
    autoResize();
  }, [query, streamedContent, reasoningText, status, autoResize]);

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

  useEffect(() => {
    return () => {
      clearUndoCapsule();
    };
  }, [clearUndoCapsule]);

  if (!editor) return null;
  if (!isOpen && !undoCapsule) return null;

  const phaseMeta = STREAM_PHASE_META[streamPhase];
  const streamPreview = getStreamPreview(streamedContent, reasoningText, streamPhase);
  const textareaDisplayValue = status === "idle" ? query : (status === "review" ? resultContent : streamPreview);
  const placeholderText =
    initialAction === "polish"
      ? "输入自定义润色要求..."
      : initialAction === "rewrite"
        ? "输入自定义改写要求..."
        : "让 AI 帮你写点什么...";

  return (
    <>
      {isOpen && createPortal(
        <div
          data-ai-input-popover
          className={cn(
            "fixed z-[20005] flex items-center gap-2 rounded-[22px] border border-border/75 bg-popover px-[10px] py-1.5",
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
          <LucideIcons.Sparkles
            className={cn(
              "h-4 w-4 shrink-0 self-center ml-1",
              status === "streaming"
                ? "text-[#10b981]"
                : "text-[#10b981]",
            )}
          />

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
              "flex-1 self-center resize-none overflow-y-auto bg-transparent text-[12px] leading-[20px] outline-none",
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

          {status === "idle" && (
            <button
              onClick={handleSubmit}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10b981] hover:bg-[#059669] text-white transition-colors"
            >
              <LucideIcons.Check className="h-3 w-3" strokeWidth={3} />
            </button>
          )}

          {status === "streaming" && (
            <span className="flex items-center gap-1 shrink-0 pr-1">
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
      )}

      {undoCapsule && createPortal(
        <button
          type="button"
          data-ai-undo-capsule
          onClick={handleUndoApply}
          onMouseEnter={handleUndoCapsuleMouseEnter}
          onMouseLeave={handleUndoCapsuleMouseLeave}
          onFocus={handleUndoCapsuleMouseEnter}
          onBlur={handleUndoCapsuleMouseLeave}
          style={{ left: undoCapsule.x, top: undoCapsule.y, transform: "translateY(-50%)" }}
          className="fixed z-[20006] inline-flex items-center gap-1.5 rounded-full border border-border/75 bg-popover/95 px-3 py-1.5 text-[12px] font-medium leading-none text-foreground shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-[1px] transition-all duration-150 animate-in fade-in-0 hover:border-border hover:bg-muted/80 dark:border-white/15 dark:bg-[#2f3437]/95 dark:hover:bg-[#3a4044]"
        >
          <LucideIcons.RotateCcw className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>取消应用</span>
        </button>,
        document.body
      )}
    </>
  );
}
