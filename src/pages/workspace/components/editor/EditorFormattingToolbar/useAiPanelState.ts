import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { buildAgentPlan, executeAgentPlan } from "@/agent/core/runtime";
import { buildWorkspaceIntentRouterDeps } from "@/agent/core/routerDeps";
import type { AgentArtifact } from "@/agent/core/types";
import type { AIStreamPhase, AIStreamUpdate } from "@/lib/ai-provider";
import { trackEvent, getAIErrorType } from "@/lib/analytics";
import { useSettings } from "@/stores/useSettings";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import type { BlockNoteEditor } from "@blocknote/core";

export type AiPanelPhase = "input" | "processing" | "error";


interface UseAiPanelStateParams {
  editor: BlockNoteEditor<any, any, any>;
  savedSelection: { from: number; to: number } | null;
  selectedText: string;
  blockText: string;
  initialAction: "polish" | "rewrite" | "generate";
  onClose: () => void;
}

export function useAiPanelState({
  editor,
  savedSelection,
  selectedText,
  blockText,
  initialAction,
  onClose,
}: UseAiPanelStateParams) {
  const [phase, setPhase] = useState<AiPanelPhase>("input");
  const [streamPhase, setStreamPhase] =
    useState<AIStreamPhase>("connecting");
  const [streamText, setStreamText] = useState("");
  const [reasoningText, setReasoningText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
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
    // 追踪 IME 合成状态，合成期间不拦截 pointerdown（避免干扰候选词选择）
    const ta = textareaRef.current;
    const onCompositionStart = () => { isComposingRef.current = true; };
    const onCompositionEnd = () => { isComposingRef.current = false; };
    ta?.addEventListener("compositionstart", onCompositionStart);
    ta?.addEventListener("compositionend", onCompositionEnd);
    return () => {
      ta?.removeEventListener("compositionstart", onCompositionStart);
      ta?.removeEventListener("compositionend", onCompositionEnd);
    };
  }, []);

  useEffect(() => {
    // 必须用 pointerdown + capture：BlockNote 的 FormattingToolbarExtension
    // 在 editor DOM 上注册了冒泡阶段的 pointerdown 监听，会立即
    // setState(false) 把整个 formatting toolbar 卸载（连带 AiPanel）。
    // 只有在 capture 阶段拦截 pointerdown 并 stopPropagation，才能
    // 阻止它生效；preventDefault 同时阻止后续 mousedown 派发。
    //
    // 注意：用 queryRef 读取最新 query 值，避免把 query 放入依赖导致
    // 每次打字都 teardown/re-attach 全局 capture 监听（IME 高频输入时会卡死）。
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-ai-inline-input]")) return;
      if (target.closest("[data-formatting-toolbar]")) return;
      // IME 合成期间不拦截，让候选词选择正常工作
      if (isComposingRef.current) return;

      const shouldBlock = phase === "processing" || (textareaRef.current?.value.trim().length ?? 0) > 0;
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
  }, [phase]);

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
    const text = (textareaRef.current?.value ?? "").trim();
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

  return {
    phase,
    streamPhase,
    streamText,
    reasoningText,
    errorMessage,
    textareaRef,
    outputScrollRef,
    handleSubmit,
    handleRetry,
    handleCancel,
  };
}

function applyReplacement(
  editor: BlockNoteEditor<any, any, any>,
  savedSel: { from: number; to: number } | null,
  text: string,
) {
  try {
    const view = (editor as any)._tiptapEditor?.view;
    if (!view) return;

    if (savedSel) {
      const { state } = view;
      const from = Math.min(savedSel.from, state.doc.content.size);
      const to = Math.min(savedSel.to, state.doc.content.size);
      view.dispatch(state.tr.delete(from, to));
    }

    view.focus();
    editor.pasteMarkdown(text);
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
