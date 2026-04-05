import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  buildAgentPlan,
  executeAgentPlan,
} from "@/agent/core/runtime";
import type { AIStreamPhase } from "@/lib/ai-provider";
import { getAIErrorType, trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";
import { AiComposerInput, type AiComposerInputHandle } from "./ai-composer/AiComposerInput";
import {
  getAiReferenceStats,
} from "./ai-composer/referenceLookup";
import { STREAM_PHASE_META } from "./ai-popover/constants";
import { getStreamPreview } from "./ai-popover/streamPreview";
import { applyStructuredListIntent, resolveStructuredListIntent } from "./ai-popover/structuredList";

interface AiInputPopoverProps {
  editor: Editor | null;
}

interface AiInlineAnchorState {
  anchorId: string | null;
  anchorPos: number | null;
}

const AI_INPUT_INLINE_ANCHOR_KEY = new PluginKey<AiInlineAnchorState>(
  "goose-note-ai-input-inline-anchor",
);

export function AiInputPopover({ editor }: AiInputPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [renderMode, setRenderMode] = useState<"floating" | "inline">("floating");
  const [initialAction, setInitialAction] = useState<"polish" | "rewrite" | "generate">("generate");
  const composerInputRef = useRef<AiComposerInputHandle | null>(null);
  const inlineAnchorIdRef = useRef<string | null>(null);
  const [inlineAnchorElement, setInlineAnchorElement] = useState<HTMLElement | null>(null);
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const [status, setStatus] = useState<"idle" | "streaming" | "review" | "error">("idle");
  const [streamPhase, setStreamPhase] = useState<AIStreamPhase>("connecting");
  const [streamedContent, setStreamedContent] = useState("");
  const [reasoningText, setReasoningText] = useState("");
  const [resultContent, setResultContent] = useState("");
  const highlightRangeRef = useRef<{ from: number; to: number } | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);
  const pendingApplyRangeRef = useRef<{ from: number; to: number } | null>(null);
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

  const clearInlineAnchor = useCallback(() => {
    inlineAnchorIdRef.current = null;
    setInlineAnchorElement(null);

    if (!editor || editor.isDestroyed) return;

    const pluginState = AI_INPUT_INLINE_ANCHOR_KEY.getState(editor.state);
    if (!pluginState?.anchorId && pluginState?.anchorPos == null) return;

    editor.view.dispatch(
      editor.state.tr.setMeta(AI_INPUT_INLINE_ANCHOR_KEY, { clear: true }),
    );
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const inlineAnchorPlugin = new Plugin<AiInlineAnchorState>({
      key: AI_INPUT_INLINE_ANCHOR_KEY,
      state: {
        init: () => ({ anchorId: null, anchorPos: null }),
        apply: (tr, pluginState) => {
          const meta = tr.getMeta(AI_INPUT_INLINE_ANCHOR_KEY) as
            | { anchorId?: string | null; anchorPos?: number | null; clear?: boolean }
            | undefined;

          if (meta?.clear) {
            return { anchorId: null, anchorPos: null };
          }

          if (meta && ("anchorId" in meta || "anchorPos" in meta)) {
            return {
              anchorId: meta.anchorId ?? null,
              anchorPos: typeof meta.anchorPos === "number" ? meta.anchorPos : null,
            };
          }

          if (!tr.docChanged || pluginState.anchorPos == null) {
            return pluginState;
          }

          return {
            ...pluginState,
            anchorPos: tr.mapping.map(pluginState.anchorPos),
          };
        },
      },
      props: {
        decorations: (state) => {
          const pluginState = AI_INPUT_INLINE_ANCHOR_KEY.getState(state);
          if (!pluginState?.anchorId || pluginState.anchorPos == null) {
            return DecorationSet.empty;
          }

          const anchor = document.createElement("div");
          anchor.className = "ai-input-inline-anchor";
          anchor.setAttribute("contenteditable", "false");
          anchor.setAttribute("data-ai-input-inline-anchor", pluginState.anchorId);

          return DecorationSet.create(state.doc, [
            Decoration.widget(pluginState.anchorPos, anchor, {
              side: -1,
              key: `${pluginState.anchorId}:${pluginState.anchorPos}`,
            }),
          ]);
        },
      },
    });

    editor.registerPlugin(inlineAnchorPlugin);

    return () => {
      try {
        editor.unregisterPlugin(AI_INPUT_INLINE_ANCHOR_KEY);
      } catch {
        // ignore unregister errors
      }
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !isOpen || renderMode !== "inline") return;
    const anchorId = inlineAnchorIdRef.current;
    if (!anchorId) return;

    const syncAnchorElement = () => {
      const nextAnchor = editor.view.dom.querySelector(
        `[data-ai-input-inline-anchor="${anchorId}"]`,
      ) as HTMLElement | null;
      setInlineAnchorElement(nextAnchor);
    };

    syncAnchorElement();
    const frameId = window.requestAnimationFrame(syncAnchorElement);
    const observer = new MutationObserver(syncAnchorElement);
    observer.observe(editor.view.dom, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [editor, isOpen, renderMode]);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{
        editor: Editor;
        initialAction?: "polish" | "rewrite" | "generate";
        overrideRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
        triggeredBy?: "space";
      }>;
      if (customEvent.detail.editor !== editor) return;

      const { to, from } = editor.state.selection;
      const shouldRenderInline = customEvent.detail.triggeredBy === "space";

      if (shouldRenderInline) {
        const anchorId = `ai-inline-anchor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        inlineAnchorIdRef.current = anchorId;
        setRenderMode("inline");
        setInlineAnchorElement(null);
        editor.view.dispatch(
          editor.state.tr.setMeta(AI_INPUT_INLINE_ANCHOR_KEY, {
            anchorId,
            anchorPos: from,
          }),
        );
      } else {
        clearInlineAnchor();
        setRenderMode("floating");

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
        }

        setPosition({ x, y });
      }

      setIsOpen(true);
      isOpenRef.current = true;
      setStatus("idle");
      setStreamPhase("connecting");
      setStreamedContent("");
      setReasoningText("");
      setResultContent("");
      const nextAction = customEvent.detail.initialAction || "generate";
      setInitialAction(nextAction);
      setComposerFocusToken((value) => value + 1);
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
        composerInputRef.current?.clear();
        composerInputRef.current?.focus();
      }, 50);
    };

    document.addEventListener("open-ai-input-popover", handleOpen);
    return () => document.removeEventListener("open-ai-input-popover", handleOpen);
  }, [editor, clearInlineAnchor]);

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
    composerInputRef.current?.clear();
    pendingApplyRangeRef.current = null;
    setRenderMode("floating");
    clearInlineAnchor();
    if (restoreSelection) {
      editor?.commands.focus();
    }
  }, [editor, clearInlineAnchor, clearUndoCapsule]);

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
    composerInputRef.current?.clear();
    setRenderMode("floating");
    clearInlineAnchor();
    editor?.commands.focus();
  }, [editor, clearInlineAnchor]);

  const showUndoCapsuleAtSelection = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const endPos = editor.state.selection.to;
    const coords = editor.view.coordsAtPos(endPos);
    setUndoCapsule({ x: coords.right + 10, y: coords.top + ((coords.bottom - coords.top) / 2) });
    scheduleUndoCapsuleHide(5000);
  }, [editor, scheduleUndoCapsuleHide]);

  const handleReferenceAdded = useCallback((reference: {
    sourceType: "app-page" | "local-file";
  }) => {
    trackEvent("ai_reference_added", {
      feature: "ai",
      action: "reference_add",
      result: "success",
      source: "bubble_menu",
      reference_source_type: reference.sourceType,
      reference_scope: "ai_input",
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!editor) return;

    const from = highlightRangeRef.current?.from ?? editor.state.selection.from;
    const to = highlightRangeRef.current?.to ?? editor.state.selection.to;
    const composerPayload = composerInputRef.current?.getPayload() ?? {
      promptText: "",
      freeformText: "",
      references: [],
      tokens: [],
    };
    const finalQuery = composerPayload.promptText.trim();
    const freeformQuery = composerPayload.freeformText.trim();

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
      if (!freeformQuery && !text && initialAction === "generate") {
        closePopover();
        return;
      }

      const structuredListIntent = resolveStructuredListIntent(editor, savedFrom, savedTo, finalQuery);

      if (structuredListIntent) {
        const applyResult = applyStructuredListIntent(
          editor,
          { from: savedFrom, to: savedTo },
          structuredListIntent.targetListType,
        );

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

      const { $from } = editor.state.doc.resolve(savedFrom)
        ? { $from: editor.state.doc.resolve(savedFrom) }
        : { $from: null };
      const blockText = $from ? editor.state.doc.textBetween($from.start(), $from.end(), "\n", "\n").trim() : "";
      const isPartial = text && blockText && text !== blockText;
      const contentScope = !text ? "new_content" : isPartial ? "partial_selection" : "full_block";
      const usageType = initialAction;
      const usageBucket = initialAction === "generate" ? "generate_new_content" : "edit_selected_content";
      const referenceStats = getAiReferenceStats(composerPayload.references);
      const agentContext = {
        surface: "inline" as const,
        payload: composerPayload,
        selectionText: text,
        blockText,
        initialAction,
      };
      const planning = await buildAgentPlan(agentContext);
      const submitPlan = planning.plan ?? null;
      const submitArtifact = planning.artifact ?? null;
      const capabilityId = planning.intent.capabilityId;
      const artifactType = planning.intent.artifactType;
      const intentClassification = planning.parsed.intentClassification;

      if (intentClassification) {
        trackEvent("ai_intent_classified", {
          feature: "ai_intent_router",
          source: intentClassification.source,
          verdict: intentClassification.verdict,
          confidence: intentClassification.confidence,
          reason: intentClassification.reason,
          provider_type: providerType,
          model_id: modelId,
          surface: "inline",
          target_type: planning.intent.targetType,
          capability_id: capabilityId,
          has_reference: composerPayload.references.length > 0,
        });
      }

      trackEvent("ai_request_submitted", {
        feature: "ai",
        action: "submit",
        result: "submitted",
        source: "bubble_menu",
        usage_type: usageType,
        usage_bucket: usageBucket,
        content_scope: contentScope,
        has_selection: savedFrom !== savedTo,
        has_custom_query: Boolean(freeformQuery),
        query_length: freeformQuery.length,
        reference_count: referenceStats.referenceCount,
        app_reference_count: referenceStats.appReferenceCount,
        local_reference_count: referenceStats.localReferenceCount,
        provider_type: providerType,
        model_id: modelId,
        capability_id: capabilityId,
        artifact_type: artifactType,
      });

      trackEvent("agent_capability_matched", {
        feature: "agent_runtime",
        capability_id: capabilityId,
        artifact_type: artifactType,
        target_type: planning.intent.targetType,
      });

      if (referenceStats.referenceCount > 0) {
        trackEvent("ai_reference_submitted", {
          feature: "ai",
          action: "reference_submit",
          result: "submitted",
          source: "bubble_menu",
          reference_count: referenceStats.referenceCount,
          app_reference_count: referenceStats.appReferenceCount,
          local_reference_count: referenceStats.localReferenceCount,
        });
      }

      if (!submitPlan) {
        const immediateText =
          submitArtifact?.type === "text_response"
            ? submitArtifact.text.trim()
            : "";
        if (!immediateText) {
          closePopover();
          return;
        }

        setResultContent(immediateText);
        setStatus("review");
        trackEvent("agent_artifact_rendered", {
          feature: "agent_runtime",
          capability_id: capabilityId,
          artifact_type: submitArtifact?.type ?? artifactType,
          target_type: planning.intent.targetType,
        });

        autoApplyTimerRef.current = setTimeout(() => {
          if (!editor || editor.isDestroyed) return;
          const range = { from: savedFrom, to: savedTo };
          if (range.from !== range.to) {
            editor
              .chain()
              .focus()
              .setTextSelection({ from: range.from, to: range.to })
              .deleteSelection()
              .insertContent(immediateText)
              .run();
          } else {
            editor.chain().focus().insertContent(immediateText).run();
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
        return;
      }

      trackEvent("agent_plan_built", {
        feature: "agent_runtime",
        capability_id: capabilityId,
        artifact_type: submitPlan.artifactType,
        target_type: submitPlan.targetType,
      });

      const result = await executeAgentPlan({
        settings: useSettings.getState().ai,
        context: agentContext,
        parsed: planning.parsed,
        plan: submitPlan,
        requestOverrides: {
          selectedModelId: modelId,
        },
        abortSignal: controller.signal,
        onUpdate: (update) => {
          if (activeRequestIdRef.current !== requestId) return;
          setStreamPhase(update.phase);
          setStreamedContent(update.text);
          setReasoningText(update.reasoningText);
        },
      });
      const content =
        result.artifact.type === "text_response"
          ? result.artifact.text.trim()
          : result.rawText.trim();
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
        output_length: content.length,
      });

      trackEvent("agent_artifact_rendered", {
        feature: "agent_runtime",
        capability_id: result.plan.capabilityId,
        artifact_type: result.artifact.type,
        target_type: result.plan.targetType,
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
            .insertContent(content)
            .run();
        } else {
          editor.chain().focus().insertContent(content).run();
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
      setResultContent(e instanceof Error ? e.message : "请求失败");
      setStatus("error");
    }
  }, [editor, closePopover, initialAction, hidePopoverAfterApply, showUndoCapsuleAtSelection]);

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
    if (!isOpen) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("[data-ai-input-popover]") ||
        target.closest("[data-ai-reference-menu]")
      ) {
        return;
      }
      closePopover(true);
    };

    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, [isOpen, closePopover]);

  useEffect(() => {
    return () => {
      clearUndoCapsule();
      clearInlineAnchor();
    };
  }, [clearInlineAnchor, clearUndoCapsule]);

  if (!editor) return null;
  if (!isOpen && !undoCapsule) return null;

  const phaseMeta = STREAM_PHASE_META[streamPhase];
  const streamPreview = getStreamPreview(streamedContent, reasoningText, streamPhase);
  const previewText = status === "review" ? resultContent : streamPreview;
  const placeholderText =
    initialAction === "polish"
      ? "输入自定义润色要求..."
      : initialAction === "rewrite"
        ? "输入自定义改写要求..."
        : "让 AI 帮你写点什么...";

  const popoverContent = (
    <div
      data-ai-input-popover
      data-ai-input-mode={renderMode}
      className={cn(
        "flex items-center gap-1.5 rounded-[22px] border border-border/75 bg-popover",
        "shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] animate-in fade-in-0 zoom-in-95 duration-100",
        "dark:border-white/15 dark:bg-[#2f3437]",
        renderMode === "inline"
          ? "relative z-10 my-2 w-[360px] max-w-[min(520px,calc(100vw-56px))]"
          : "fixed z-[20005] min-w-[380px] max-w-[520px] w-max",
        status === "idle" ? "px-2 py-1.5" : "px-3 py-1.5",
      )}
      style={renderMode === "floating" ? { left: position.x, top: position.y } : undefined}
      onMouseDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (
          target.closest("[contenteditable='true']") ||
          target.closest("[data-ai-reference-menu]")
        ) {
          return;
        }
        event.preventDefault();
      }}
    >
      <LucideIcons.Sparkles className="h-4 w-4 shrink-0 self-center text-[#10b981]" />

      {status === "idle" ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <AiComposerInput
            ref={composerInputRef}
            placeholder={placeholderText}
            autoFocusToken={composerFocusToken}
            onSubmit={handleSubmit}
            onEscape={() => closePopover(true)}
            onReferenceAdded={handleReferenceAdded}
            compactWidthClass="flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#10b981] text-white transition-colors hover:bg-[#059669]"
          >
            <LucideIcons.Check className="h-3 w-3" strokeWidth={3} />
          </button>
        </div>
      ) : status === "error" ? (
        <div className="relative min-w-0 flex-1 flex items-center gap-2 pr-6">
          <span className="text-[12px] font-medium text-destructive leading-5 truncate flex-1" title={resultContent}>
            {resultContent}
          </span>
          <button
            onClick={() => {
              setStatus("idle");
              setComposerFocusToken(v => v + 1);
              setTimeout(() => {
                composerInputRef.current?.focus();
              }, 50);
            }}
            className="absolute right-0 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="返回编辑"
          >
            <LucideIcons.RotateCcw className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "min-h-[20px] max-h-[88px] overflow-y-auto whitespace-pre-wrap break-words rounded-md text-[12px] leading-[20px] text-foreground/80",
            status === "streaming" && phaseMeta.tone,
          )}
        >
          {previewText}
        </div>
      )}

      {status === "streaming" && (
        <span className="flex shrink-0 items-center gap-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <span
              key={`wave-dot-${index}`}
              className={cn("ai-stream-wave-dot h-1.5 w-1.5 rounded-full", phaseMeta.dot)}
              style={{ animationDelay: `${index * 0.14}s` }}
            />
          ))}
        </span>
      )}
    </div>
  );

  return (
    <>
      {isOpen && renderMode === "inline" && inlineAnchorElement && createPortal(popoverContent, inlineAnchorElement)}
      {isOpen && renderMode === "floating" && createPortal(popoverContent, document.body)}

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
        document.body,
      )}
    </>
  );
}
