import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import {
  AIExtension,
  getDefaultAIMenuItems,
  type AIMenuProps,
  type AIMenuSuggestionItem,
  useAIDictionary,
} from "@blocknote/xl-ai";
import { Square } from "lucide-react";
import { RiSparkling2Fill } from "react-icons/ri";
import { SelectionActions } from "@/pages/workspace/components/notebook-ai/beautiful-ui/SelectionActions";
import { toast } from "@/components/ui/sonner";
import {
  applyBlockTypeTransformToEditor,
  coerceGeneratedBlocksToExpectedType,
  createBlockTypeTransformSelectionSnapshot,
  getBlockTypeTransformTargetLabel,
  resolveBlockTypeTransformIntent,
  resolveGeneratedBlockStructureExpectation,
  validateGeneratedBlockStructure,
  type BlockTypeTransformBlock,
} from "@/lib/ai-write";
import {
  applyMarkdownToInlineTarget,
  restoreBlocks,
  serializeInlineEditTarget,
  snapshotBlocks,
} from "@/lib/notebook-ai/inlineMarkdownApply";
import { runInlineMarkdownRewrite } from "@/components/editor/ai/transport/runInlineMarkdownRewrite";
import {
  useEditorPageContext,
  useEditorSettings,
} from "@/components/editor/platform/hostContext";
import type { AISettingsLike } from "@/lib/ai-provider/types";
import {
  formatAiMenuError,
  isMissingTargetBlockError,
} from "./formatAiMenuError";
import {
  GoosePromptSuggestionMenu,
  type GooseAiMenuTag,
} from "./GoosePromptSuggestionMenu";
import { composeInlineBusyTicker } from "./inlineBusyTicker";

/** idle 态的 5 个改写 tag：全部走 markdown 改写路径。 */
const IDLE_REWRITE_TAGS: Array<{ key: string; label: string; prompt: string }> =
  [
    {
      key: "jargon",
      label: "工作黑话",
      prompt: "把选中文字改写成工作黑话，保留原意。",
    },
    {
      key: "simplify",
      label: "精简表达",
      prompt: "精简选中文字，保留关键信息。",
    },
    {
      key: "to-english",
      label: "翻译成英文",
      prompt: "将选中文字翻译成英文。",
    },
    {
      key: "to-chinese",
      label: "翻译成中文",
      prompt: "将选中文字翻译成中文。",
    },
    {
      key: "colloquial",
      label: "口语化",
      prompt: "把选中文字改得更口语、自然。",
    },
  ];

/** 这些默认项会走 xl-ai HTML update，块 id 一变就半替换失败。改走 markdown 整段替换。 */
const MARKDOWN_REWRITE_ITEM_PROMPTS: Record<string, string> = {
  improve_writing: "润色选中文字，保留原意。",
  fix_spelling: "修正选中文字的拼写和语法。",
  simplify: "精简选中文字，保留关键信息。",
  continue_writing: "继续往后写，保持语气和结构。需要列表或待办时每行一个独立项。",
  summarize: "总结当前内容。若有要点或待办，每行一项。",
  action_items: "列出待办事项，每项独立一行。",
};

type AiMenuStatus =
  | "user-input"
  | "thinking"
  | "ai-writing"
  | "error"
  | "user-reviewing"
  | "closed";

function isBusyStatus(status: AiMenuStatus) {
  return status === "thinking" || status === "ai-writing";
}

function documentSignature(document: unknown): string {
  try {
    return JSON.stringify(document);
  } catch {
    return "";
  }
}

function formatAiErrorMessage(error: unknown): string {
  return formatAiMenuError(error);
}

function truncateErrorMessage(message: string, maxLen = 40): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function resolveInlineModelId(ai: {
  workspaceSelectedModelId?: string | null;
  selectedModelId?: string | null;
  customModelOptions?: Array<{ id: string }>;
}): string {
  const options = ai.customModelOptions ?? [];
  const ws = ai.workspaceSelectedModelId?.trim();
  const wsOk = !!ws && options.some((o) => o.id === ws);
  return (
    (wsOk ? ws : null) || ai.selectedModelId?.trim() || options[0]?.id || ""
  );
}

/**
 * 行内 AI 菜单：确定性块转换离线执行；其余自由提示走 agent 对齐的 markdown 改写。
 * 拒绝草稿仍走 xl-ai reject-and-continue，保留提示词。
 */
export function GooseAIMenu(props: AIMenuProps) {
  const editor = useBlockNoteEditor();
  const ai = useExtension(AIExtension);
  const { page } = useEditorPageContext();
  const { ai: aiSettings } = useEditorSettings();
  const dict = useAIDictionary();
  const [prompt, setPrompt] = useState("");
  /** 本地 markdown 改写忙态（不依赖 xl-ai status）。 */
  const [isLocalRewriting, setIsLocalRewriting] = useState(false);
  /** 忙态单行 ticker：思考优先，新内容盖住旧内容。 */
  const [busyTickerText, setBusyTickerText] = useState("");
  const busyTickerRef = useRef("");
  const busyTickerRafRef = useRef(0);
  /** 最近一次用户提交 / 动作的提示词，拒绝后写回输入框，不被忙态清空。 */
  const lastPromptRef = useRef("");
  /** 拒绝后重开菜单时跳过一次「进入 user-input 的清空逻辑」。 */
  const restorePromptAfterRejectRef = useRef(false);
  const localAbortRef = useRef<AbortController | null>(null);

  const aiResponseStatus = useExtensionState(AIExtension, {
    selector: (state) =>
      (state.aiMenuState !== "closed"
        ? state.aiMenuState.status
        : "closed") as AiMenuStatus,
  });

  const aiErrorRaw = useExtensionState(AIExtension, {
    selector: (state) => {
      const menuState = state.aiMenuState;
      if (menuState === "closed" || menuState.status !== "error") {
        return null;
      }
      return menuState.error ?? null;
    },
  });

  const aiErrorMessage = formatAiErrorMessage(aiErrorRaw);

  const isBusy = isBusyStatus(aiResponseStatus) || isLocalRewriting;

  const flushBusyTicker = useCallback((text: string) => {
    busyTickerRef.current = text;
    if (busyTickerRafRef.current) return;
    busyTickerRafRef.current = requestAnimationFrame(() => {
      busyTickerRafRef.current = 0;
      setBusyTickerText(busyTickerRef.current);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (busyTickerRafRef.current) {
        cancelAnimationFrame(busyTickerRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isBusy) return;
    busyTickerRef.current = "";
    setBusyTickerText("");
  }, [isBusy]);

  // busy → user-reviewing：提示用户必须接受才会写入；若文档签名未变则提示无改动
  const prevAiStatusRef = useRef<AiMenuStatus>("closed");
  const busyDocSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevAiStatusRef.current;
    const next = aiResponseStatus;

    if (isBusyStatus(next) && !isBusyStatus(prev)) {
      busyDocSignatureRef.current = documentSignature(editor.document);
    }

    if (next === "user-reviewing" && isBusyStatus(prev)) {
      const before = busyDocSignatureRef.current;
      const after = documentSignature(editor.document);
      const noPendingChanges =
        before != null && before !== "" && before === after;

      if (noPendingChanges) {
        toast.info(
          "AI 未产生可应用的修改（可能因选区限制或模型未调用编辑工具）",
        );
      } else {
        const acceptLabel = dict.ai_menu.actions.accept.title || "接受";
        const rejectLabel = dict.ai_menu.actions.revert.title || "拒绝";
        toast.success(
          `已生成修改草稿，请点${acceptLabel}以写入，或点${rejectLabel}丢弃`,
        );
      }
      busyDocSignatureRef.current = null;
    }

    if (next === "closed" || next === "user-input" || next === "error") {
      busyDocSignatureRef.current = null;
    }

    prevAiStatusRef.current = next;
  }, [
    aiResponseStatus,
    dict.ai_menu.actions.accept.title,
    dict.ai_menu.actions.revert.title,
    editor,
  ]);

  const rememberPrompt = useCallback((text: string) => {
    lastPromptRef.current = text;
  }, []);

  const setPromptRemembering = useCallback((text: string) => {
    if (text.trim()) {
      lastPromptRef.current = text;
    }
    setPrompt(text);
  }, []);

  /**
   * 拒绝 AI 草稿：还原文档，菜单回到输入态，并保留用户原先输入的提示词。
   * xl-ai 的 rejectChanges 会 close 菜单，因此需要立刻在同 block 重开。
   */
  const handleRejectAndContinue = useCallback(() => {
    const menuState = ai.store.state.aiMenuState;
    if (menuState === "closed") return;
    const blockId = menuState.blockId;
    const keep = lastPromptRef.current;

    restorePromptAfterRejectRef.current = true;
    ai.rejectChanges();

    // reject 会 close；下一帧（或微任务）再 open，恢复输入与焦点
    requestAnimationFrame(() => {
      try {
        ai.openAIMenuAtBlock(blockId);
        setPrompt(keep);
      } catch {
        restorePromptAfterRejectRef.current = false;
      }
    });
  }, [ai]);

  // 进入 error 时 toast 一次；块丢失则立刻丢掉半成品建议标记
  useEffect(() => {
    if (aiResponseStatus !== "error") return;
    const message = aiErrorMessage || dict.ai_menu.status.error;
    toast.error(message);
    if (isMissingTargetBlockError(aiErrorRaw)) {
      handleRejectAndContinue();
    }
  }, [
    aiResponseStatus,
    aiErrorMessage,
    aiErrorRaw,
    dict.ai_menu.status.error,
    handleRejectAndContinue,
  ]);

  const reopenMenuWithPrompt = useCallback(
    (keep: string) => {
      restorePromptAfterRejectRef.current = true;
      const menuState = ai.store.state.aiMenuState;
      const blockId =
        menuState !== "closed"
          ? menuState.blockId
          : (() => {
              try {
                return editor.getTextCursorPosition().block.id;
              } catch {
                return undefined;
              }
            })();
      if (!blockId) {
        setPrompt(keep);
        return;
      }
      requestAnimationFrame(() => {
        try {
          ai.openAIMenuAtBlock(blockId);
          setPrompt(keep);
        } catch {
          restorePromptAfterRejectRef.current = false;
          setPrompt(keep);
        }
      });
    },
    [ai, editor],
  );

  const handleManualPromptSubmit = useCallback(
    async (userPrompt: string) => {
      rememberPrompt(userPrompt);
      // 纯「改为无序列表」可离线转换；含「多行/生成/列出」等需要扩成多项时走 markdown 内核
      const wantsMultiItemStructure =
        /多行|多条|多项|生成|列出|展开|拆成|拆分|写成列表|改写成列表/i.test(
          userPrompt,
        );
      const transformIntent = wantsMultiItemStructure
        ? null
        : resolveBlockTypeTransformIntent(userPrompt);
      if (transformIntent) {
        let menuClosed = false;
        try {
          if (page.isLocked || page.trashedAt) {
            throw new Error("当前页面不可编辑，未转换待办事项。");
          }
          if (page.localFilePath && page.localReadState === "error") {
            throw new Error("本地页面读取失败，未转换待办事项。");
          }
          const snapshot = createBlockTypeTransformSelectionSnapshot(editor, {
            pageId: page.id,
            protectFirstTitle: !page.localFilePath,
          });
          ai.closeAIMenu();
          menuClosed = true;
          const result = applyBlockTypeTransformToEditor(
            editor,
            snapshot,
            transformIntent,
          );
          const targetLabel = getBlockTypeTransformTargetLabel(result.target);
          toast.success(`已转换为 ${result.convertedCount} 个${targetLabel}块`);
        } catch (error) {
          const targetLabel = getBlockTypeTransformTargetLabel(transformIntent);
          toast.error(
            error instanceof Error && error.message
              ? error.message
              : `转换为${targetLabel}失败，内容未修改。`,
          );
        } finally {
          if (!menuClosed) ai.closeAIMenu();
        }
        return;
      }

      // —— agent 对齐的 markdown 改写（含结构生成 / 多行列表扩写）——
      const structureExpectation =
        resolveGeneratedBlockStructureExpectation(userPrompt);
      const keepPrompt = userPrompt;

      if (page.isLocked || page.trashedAt) {
        toast.error("当前页面不可编辑。");
        return;
      }
      if (page.localFilePath && page.localReadState === "error") {
        toast.error("本地页面读取失败，无法改写。");
        return;
      }

      let target;
      try {
        target = serializeInlineEditTarget(editor as never);
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "无法定位要改写的内容。",
        );
        return;
      }

      const modelId = resolveInlineModelId(aiSettings);
      if (!modelId) {
        toast.error("请先选择模型后再使用行内 AI");
        return;
      }

      localAbortRef.current?.abort();
      const abortController = new AbortController();
      localAbortRef.current = abortController;
      setIsLocalRewriting(true);
      flushBusyTicker("");

      try {
        const newMarkdown = await runInlineMarkdownRewrite({
          settings: aiSettings as AISettingsLike,
          modelId,
          userPrompt,
          oldMarkdown: target.oldMarkdown,
          abortSignal: abortController.signal,
          onUpdate: (update) => {
            flushBusyTicker(composeInlineBusyTicker(update));
          },
        });

        const beforeBlocks = structuredClone(
          editor.document,
        ) as BlockTypeTransformBlock[];
        const blockSnapshot = snapshotBlocks(
          editor as never,
          target.sourceBlockIds,
        );

        const applyResult = applyMarkdownToInlineTarget(
          editor as never,
          newMarkdown,
          {
            sourceBlockIds: target.sourceBlockIds,
          },
        );

        if (structureExpectation) {
          let validation = validateGeneratedBlockStructure({
            beforeBlocks,
            afterBlocks: editor.document as BlockTypeTransformBlock[],
            expectation: structureExpectation,
          });
          if (!validation.ok && applyResult.newBlockIds.length > 0) {
            const failedReason = validation.reason;
            try {
              coerceGeneratedBlocksToExpectedType(
                editor as never,
                applyResult.newBlockIds,
                structureExpectation,
              );
              validation = validateGeneratedBlockStructure({
                beforeBlocks,
                afterBlocks: editor.document as BlockTypeTransformBlock[],
                expectation: structureExpectation,
              });
            } catch {
              validation = {
                ok: false,
                reason: failedReason,
                pseudoMarkers: [],
              };
            }
          }
          if (!validation.ok) {
            try {
              restoreBlocks(
                editor as never,
                blockSnapshot,
                applyResult.newBlockIds,
              );
            } catch {
              try {
                editor.undo?.();
              } catch {
                /* ignore */
              }
            }
            toast.error(validation.reason);
            reopenMenuWithPrompt(keepPrompt);
            return;
          }
        }

        toast.success(
          `已改写 ${applyResult.blockCount} 个块（替换 ${applyResult.replacedCount} 个源块）`,
        );
        ai.closeAIMenu();
      } catch (error) {
        if (abortController.signal.aborted) {
          toast.info("已停止");
          reopenMenuWithPrompt(keepPrompt);
          return;
        }
        const message = formatAiErrorMessage(error);
        toast.error(message || "改写失败，内容未修改。");
        reopenMenuWithPrompt(keepPrompt);
      } finally {
        if (localAbortRef.current === abortController) {
          localAbortRef.current = null;
        }
        setIsLocalRewriting(false);
      }
    },
    [ai, aiSettings, editor, page, rememberPrompt, reopenMenuWithPrompt, flushBusyTicker],
  );

  const handleRetryViaMarkdown = useCallback(() => {
    const keep = lastPromptRef.current;
    try {
      ai.rejectChanges();
    } catch {
      /* reject 在无草稿时也可能抛 */
    }
    if (keep.trim()) {
      void handleManualPromptSubmit(keep);
      return;
    }
    reopenMenuWithPrompt(keep);
  }, [ai, handleManualPromptSubmit, reopenMenuWithPrompt]);

  const handleStop = useCallback(() => {
    if (localAbortRef.current) {
      localAbortRef.current.abort();
      return;
    }
    void ai.abort();
  }, [ai]);

  const { items: externalItems } = props;
  const items = useMemo(() => {
    // 忙时只保留输入框右侧停止按钮；列表仅给 reviewing 的「接受」用
    const next: AIMenuSuggestionItem[] = isBusy
      ? []
      : externalItems
        ? externalItems(editor, aiResponseStatus)
        : getDefaultAIMenuItems(editor, aiResponseStatus);

    return next.map((item) => ({
      ...item,
      onItemClick: () => {
        if (item.key === "revert" || item.key === "cancel") {
          handleRejectAndContinue();
          return;
        }
        if (item.key === "retry") {
          handleRetryViaMarkdown();
          return;
        }
        const rewritePrompt = MARKDOWN_REWRITE_ITEM_PROMPTS[item.key];
        if (rewritePrompt) {
          void handleManualPromptSubmit(rewritePrompt);
          return;
        }
        item.onItemClick(setPromptRemembering);
      },
    }));
  }, [
    aiResponseStatus,
    editor,
    externalItems,
    handleManualPromptSubmit,
    handleRejectAndContinue,
    handleRetryViaMarkdown,
    isBusy,
    setPromptRemembering,
  ]);

  useEffect(() => {
    // 忙态清空输入区，给 placeholder + 停止按钮让位；原文保留在 lastPromptRef
    if (isBusy) {
      setPrompt((current) => {
        if (current.trim()) {
          lastPromptRef.current = current;
        }
        return "";
      });
      return;
    }

    // 拒绝后重开：写回 lastPrompt，不再清空
    if (
      aiResponseStatus === "user-input" &&
      restorePromptAfterRejectRef.current
    ) {
      restorePromptAfterRejectRef.current = false;
      setPrompt(lastPromptRef.current);
      return;
    }

    // 审阅 / 错误态：输入框保持空（列表是接受/恢复），但绝不擦 lastPromptRef
    if (aiResponseStatus === "user-reviewing" || aiResponseStatus === "error") {
      setPrompt("");
    }
  }, [aiResponseStatus, isBusy]);

  const placeholder = useMemo(() => {
    if (isLocalRewriting || aiResponseStatus === "thinking") {
      return dict.ai_menu.status.thinking;
    }
    if (aiResponseStatus === "ai-writing") {
      return dict.ai_menu.status.editing;
    }
    if (aiResponseStatus === "error") {
      if (aiErrorMessage) {
        return truncateErrorMessage(aiErrorMessage, 40);
      }
      return dict.ai_menu.status.error;
    }
    return dict.ai_menu.input_placeholder;
  }, [aiResponseStatus, aiErrorMessage, dict, isLocalRewriting]);

  const rightSection = useMemo(() => {
    if (isBusy) {
      return (
        <div className="goose-ai-menu-busy-actions bn-combobox-right-section">
          <button
            type="button"
            className="goose-ai-menu-stop"
            onMouseDown={(event) => {
              // 避免 mousedown 抢走焦点导致浮层抖动
              event.preventDefault();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleStop();
            }}
            aria-label="停止"
            title="停止"
          >
            <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      );
    }

    if (aiResponseStatus === "error") {
      return (
        <div className="bn-combobox-right-section bn-combobox-error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="1em"
            viewBox="0 -960 960 960"
            width="1em"
            fill="currentColor"
            aria-hidden
          >
            <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm0-160q17 0 28.5-11.5T520-480v-160q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v160q0 17 11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
          </svg>
        </div>
      );
    }

    return undefined;
  }, [aiResponseStatus, handleStop, isBusy]);

  const tags = useMemo<GooseAiMenuTag[]>(() => {
    if (isBusy || aiResponseStatus === "error") return [];
    if (aiResponseStatus === "user-reviewing") {
      const acceptItem = items.find((item) => item.key === "accept");
      const next: GooseAiMenuTag[] = [];
      if (acceptItem) {
        next.push({
          key: "accept",
          label: acceptItem.title || "接受",
          onClick: () => acceptItem.onItemClick(),
        });
      }
      next.push(
        { key: "reject", label: "拒绝", onClick: handleRejectAndContinue },
        { key: "retry", label: "重试", onClick: handleRetryViaMarkdown },
      );
      return next;
    }
    if (aiResponseStatus === "user-input") {
      return IDLE_REWRITE_TAGS.map((tag) => ({
        key: tag.key,
        label: tag.label,
        onClick: () => void handleManualPromptSubmit(tag.prompt),
      }));
    }
    return [];
  }, [
    aiResponseStatus,
    handleManualPromptSubmit,
    handleRejectAndContinue,
    handleRetryViaMarkdown,
    isBusy,
    items,
  ]);

  const showPlus = aiResponseStatus === "user-input" && !isBusy;

  const handleOpenSettings = useCallback(() => {
    ai.closeAIMenu();
    window.dispatchEvent(
      new CustomEvent("goose-note:open-settings", {
        detail: { tab: "ai" },
      }),
    );
  }, [ai]);

  return (
    <SelectionActions busy={isBusy} className="goose-ai-menu-selection">
      <GoosePromptSuggestionMenu
        onManualPromptSubmit={handleManualPromptSubmit}
        promptText={prompt}
        onPromptTextChange={setPromptRemembering}
        placeholder={placeholder}
        disabled={isBusy}
        busy={isBusy}
        busyTickerText={busyTickerText}
        tags={tags}
        showPlus={showPlus}
        onOpenAiPanel={handleOpenSettings}
        icon={
          <div className="bn-combobox-icon">
            <RiSparkling2Fill />
          </div>
        }
        rightSection={rightSection}
      />
    </SelectionActions>
  );
}
