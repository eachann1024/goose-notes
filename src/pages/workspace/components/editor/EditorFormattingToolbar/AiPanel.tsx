import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import { buildAgentPlan, executeAgentPlan } from "@/agent/core/runtime";
import { buildWorkspaceIntentRouterDeps } from "@/agent/core/routerDeps";
import type { AgentArtifact } from "@/agent/core/types";
import type { AIStreamPhase, AIStreamUpdate } from "@/lib/ai-provider";
import { useSettings } from "@/stores/useSettings";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { trackEvent, getAIErrorType } from "@/lib/analytics";
import type { BlockNoteEditor } from "@blocknote/core";

type Phase = "input" | "processing" | "error";

const STREAM_PHASE_LABEL: Record<AIStreamPhase, string> = {
  connecting: "正在连接",
  thinking: "正在思考",
  generating: "正在生成",
  finishing: "正在整理",
};

const TEXTAREA_LINE_HEIGHT = 22;
const TEXTAREA_MIN_ROWS = 3;
const TEXTAREA_MAX_ROWS = 8;
const TEXTAREA_MIN_HEIGHT = TEXTAREA_LINE_HEIGHT * TEXTAREA_MIN_ROWS;
const TEXTAREA_MAX_HEIGHT = TEXTAREA_LINE_HEIGHT * TEXTAREA_MAX_ROWS;

export interface AiPanelProps {
  editor: BlockNoteEditor<any, any, any>;
  savedSelection: { from: number; to: number } | null;
  selectedText: string;
  blockText: string;
  initialAction: "polish" | "rewrite" | "generate";
  onClose: () => void;
}

export function AiPanel({
  editor,
  savedSelection,
  selectedText,
  blockText,
  initialAction,
  onClose,
}: AiPanelProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [query, setQuery] = useState("");
  const [streamPhase, setStreamPhase] = useState<AIStreamPhase>("connecting");
  const [streamText, setStreamText] = useState("");
  const [reasoningText, setReasoningText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingAccRef = useRef<{
    text: string;
    phase: AIStreamPhase;
    reasoningText: string;
  }>({ text: "", phase: "connecting", reasoningText: "" });
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const outputScrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(
      Math.max(ta.scrollHeight, TEXTAREA_MIN_HEIGHT),
      TEXTAREA_MAX_HEIGHT,
    );
    ta.style.height = `${next}px`;
    ta.style.overflowY =
      ta.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
  }, [query]);

  useEffect(() => {
    if (phase !== "processing") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [phase]);

  useEffect(() => {
    // 必须用 pointerdown + capture：BlockNote 的 FormattingToolbarExtension
    // 在 editor DOM 上注册了冒泡阶段的 pointerdown 监听，会立即
    // setState(false) 把整个 formatting toolbar 卸载（连带 AiPanel）。
    // 只有在 capture 阶段拦截 pointerdown 并 stopPropagation，才能
    // 阻止它生效；preventDefault 同时阻止后续 mousedown 派发。
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-ai-inline-input]")) return;
      if (target.closest("[data-formatting-toolbar]")) return;

      const shouldBlock = phase === "processing" || query.trim().length > 0;
      if (shouldBlock) {
        e.preventDefault();
        e.stopPropagation();
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }
      closeRef.current();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [phase, query]);

  useLayoutEffect(() => {
    if (phase !== "processing") return;
    const el = outputScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [phase, streamText, reasoningText]);

  useEffect(() => {
    if (phase !== "processing") return;
    const el = outputScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    Array.from(el.children).forEach((child) => ro.observe(child));
    return () => ro.disconnect();
  }, [phase]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = query.trim();
    if (!text && !selectedText) {
      onClose();
      return;
    }

    setPhase("processing");
    setStreamPhase("connecting");
    setStreamText("");
    setReasoningText("");
    setErrorMessage("");
    streamingAccRef.current = {
      text: "",
      phase: "connecting",
      reasoningText: "",
    };

    const aiSettings = useSettings.getState().ai;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const activePageId = useTabs.getState().activeTabId;
    const page = activePageId
      ? usePages.getState().pages[activePageId]
      : undefined;
    const originPageId = activePageId ?? undefined;
    const originNotebookId = page?.workspaceId ?? undefined;

    const payload = {
      promptText: text || selectedText,
      freeformText: text || selectedText,
      references: [] as any[],
      tokens: [],
    };

    const agentContext = {
      surface: "inline" as const,
      payload,
      originPageId,
      originNotebookId,
      selectionText: selectedText,
      blockText,
      initialAction,
    };

    const routerDeps = buildWorkspaceIntentRouterDeps({
      settings: aiSettings,
      messages: [],
      originPageId,
      originNotebookId,
    });

    const requestStartedAt = Date.now();
    const providerType = aiSettings.useCustomProvider
      ? aiSettings.customProtocol
      : "utools";
    const modelId = aiSettings.selectedModelId ?? "";

    try {
      const planning = await buildAgentPlan(agentContext, routerDeps);
      if (!planning.plan) {
        const fallbackText =
          planning.artifact?.type === "text_response"
            ? planning.artifact.text.trim()
            : "";
        if (fallbackText && savedSelection) {
          applyReplacement(editor, savedSelection, fallbackText);
        }
        onClose();
        return;
      }

      trackEvent("ai_request_submitted", {
        feature: "ai",
        action: "submit",
        result: "submitted",
        source: "inline_editor",
        provider_type: providerType,
        model_id: modelId,
        capability_id: planning.intent?.capabilityId,
      });

      const result = await executeAgentPlan({
        settings: aiSettings,
        plan: planning.plan,
        context: agentContext,
        parsed: planning.parsed,
        historyMessages: [],
        abortSignal: controller.signal,
        onUpdate: (update: AIStreamUpdate) => {
          streamingAccRef.current = {
            text: update.text,
            phase: update.phase,
            reasoningText: update.reasoningText,
          };
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(() => {
              rafRef.current = null;
              const acc = streamingAccRef.current;
              setStreamPhase(acc.phase);
              setStreamText(acc.text);
              setReasoningText(acc.reasoningText);
            });
          }
        },
      });

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      trackEvent("ai_request_succeeded", {
        feature: "ai",
        action: "success",
        result: "success",
        source: "inline_editor",
        duration_ms: Date.now() - requestStartedAt,
        provider_type: providerType,
        model_id: modelId,
        capability_id: result.plan.capabilityId,
      });

      const outputText = extractOutputText(result.artifact);
      if (outputText && savedSelection) {
        applyReplacement(editor, savedSelection, outputText);
      }
      onClose();
    } catch (err: unknown) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // 用户主动取消：回到输入态，保留 query，允许再次点击发送。
      if (err instanceof DOMException && err.name === "AbortError") {
        setPhase("input");
        setStreamText("");
        setReasoningText("");
        setStreamPhase("connecting");
        return;
      }

      const errMsg = err instanceof Error ? err.message : "请求失败，请重试";
      trackEvent("ai_request_failed", {
        feature: "ai",
        action: "fail",
        result: "failed",
        source: "inline_editor",
        error_type: getAIErrorType(err),
        duration_ms: Date.now() - requestStartedAt,
        provider_type: providerType,
        model_id: modelId,
      });

      setPhase("error");
      setErrorMessage(errMsg);
    }
  }, [
    query,
    selectedText,
    blockText,
    initialAction,
    editor,
    savedSelection,
    onClose,
  ]);

  const handleRetry = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const placeholder =
    initialAction === "polish"
      ? "告诉 AI 怎么润色，或直接按回车..."
      : initialAction === "rewrite"
        ? "告诉 AI 怎么改写，或直接按回车..."
        : "让 AI 帮你写点什么...";

  const showSpinner =
    phase === "processing" &&
    (streamPhase === "connecting" || streamPhase === "finishing");

  const canSubmit = phase === "input" && query.trim().length > 0;
  const isProcessing = phase === "processing";

  return (
    <div data-ai-inline-input className="flex w-full flex-col">
      <div className="flex items-start gap-2 px-2 py-1.5">
        <div className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center">
          {isProcessing ? (
            <AiGradientIcon className="h-3.5 w-3.5" />
          ) : (
            <LucideIcons.Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          )}
        </div>

        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isProcessing}
            placeholder={placeholder}
            rows={TEXTAREA_MIN_ROWS}
            className={cn(
              "block w-full resize-none rounded-md bg-transparent px-2 pt-1.5 pb-9 text-[13px] leading-[22px] text-foreground outline-none placeholder:text-muted-foreground/55",
              "disabled:opacity-60",
            )}
            style={{
              minHeight: TEXTAREA_MIN_HEIGHT,
              maxHeight: TEXTAREA_MAX_HEIGHT,
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isProcessing) void handleSubmit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
          />
          <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LucideIcons.X className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (isProcessing) {
                  handleCancel();
                } else {
                  void handleSubmit();
                }
              }}
              disabled={!isProcessing && !canSubmit}
              aria-label={isProcessing ? "取消" : "发送"}
              className={cn(
                "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                isProcessing
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : canSubmit
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "bg-muted/70 text-muted-foreground/60",
              )}
            >
              {isProcessing ? (
                <LucideIcons.Square className="h-2.5 w-2.5 fill-current" />
              ) : (
                <LucideIcons.ArrowUp className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {(phase === "processing" || phase === "error") && (
        <div className="border-t border-border/40">
          {phase === "processing" && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex-1 text-[12px] font-medium text-muted-foreground">
                {STREAM_PHASE_LABEL[streamPhase]}
              </span>
              {showSpinner ? (
                <LucideIcons.LoaderCircle className="h-3 w-3 shrink-0 animate-spin text-muted-foreground/60" />
              ) : (
                <div className="flex items-center gap-0.5">
                  <span
                    className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: "0ms", animationDuration: "1s" }}
                  />
                  <span
                    className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/50"
                    style={{
                      animationDelay: "200ms",
                      animationDuration: "1s",
                    }}
                  />
                  <span
                    className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/50"
                    style={{
                      animationDelay: "400ms",
                      animationDuration: "1s",
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {phase === "processing" && (
            <div
              ref={outputScrollRef}
              className="max-h-[240px] overflow-y-auto px-3 pb-2"
            >
              {reasoningText && (
                <div
                  className={cn(
                    "whitespace-pre-wrap break-words text-[11px] italic leading-5 text-muted-foreground/70 transition-opacity",
                    streamPhase === "thinking" || streamPhase === "connecting"
                      ? "opacity-100"
                      : "opacity-60",
                  )}
                >
                  {reasoningText}
                </div>
              )}
              {streamText && (
                <div
                  className={cn(
                    "whitespace-pre-wrap break-words text-[13px] leading-6 text-foreground",
                    reasoningText ? "mt-2 border-t border-border/30 pt-2" : "",
                  )}
                >
                  {streamText}
                </div>
              )}
              {!streamText && !reasoningText && (
                <div className="text-[11px] italic text-muted-foreground/50">
                  AI 正在准备回复...
                </div>
              )}
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col gap-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <LucideIcons.AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                <span className="flex-1 text-[12px] font-medium text-destructive">
                  请求失败
                </span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LucideIcons.RotateCcw className="h-3 w-3" />
                  重试
                </button>
              </div>
              {errorMessage && (
                <div className="whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground">
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function applyReplacement(
  editor: BlockNoteEditor<any, any, any>,
  savedSel: { from: number; to: number } | null,
  text: string,
) {
  try {
    const view = (editor as any)._tiptapEditor?.view;
    if (!view) return;
    const { state } = view;
    if (savedSel) {
      const from = Math.min(savedSel.from, state.doc.content.size);
      const to = Math.min(savedSel.to, state.doc.content.size);
      view.dispatch(state.tr.insertText(text, from, to));
    } else {
      const { from } = state.selection;
      view.dispatch(state.tr.insertText(text, from, from));
    }
  } catch {
    /* editor may be unmounted */
  }
}

function extractOutputText(
  artifact: AgentArtifact | null | undefined,
): string {
  if (!artifact) return "";
  if (artifact.type === "text_response") return artifact.text?.trim() ?? "";
  if (artifact.type === "markdown_note")
    return artifact.plan?.outputMarkdown?.trim() ?? "";
  return "";
}
