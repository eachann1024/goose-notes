import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import {
  AIExtension,
  getDefaultAIMenuItems,
  PromptSuggestionMenu,
  type AIMenuProps,
  type AIMenuSuggestionItem,
  useAIDictionary,
} from "@blocknote/xl-ai";
import { Square } from "lucide-react";
import { RiSparkling2Fill } from "react-icons/ri";
import { GooseThinkingOrb } from "@/components/ui/ai-motion";
import { toast } from "@/components/ui/sonner";
import {
  applyBlockTypeTransformToEditor,
  createBlockTypeTransformSelectionSnapshot,
  getBlockTypeTransformTargetLabel,
  resolveBlockTypeTransformIntent,
  resolveGeneratedBlockStructureExpectation,
  validateGeneratedBlockStructure,
  type BlockTypeTransformBlock,
} from "@/lib/ai-write";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";

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

function formatAiErrorMessage(error: unknown): string {
  let message = "";
  if (error instanceof Error && error.message) {
    message = error.message;
  } else if (typeof error === "string" && error.trim()) {
    message = error;
  } else if (error != null) {
    const text = String(error);
    if (text && text !== "[object Object]") {
      message = text;
    }
  }
  if (!message) return "";
  // thinking 模型拒绝 tool_choice=required 时，给出可操作的中文提示
  if (/tool_choice|Thinking mode/i.test(message)) {
    return "当前模型的思考模式不支持强制工具调用，请换非思考模型或关闭思考后再试";
  }
  return message;
}

function truncateErrorMessage(message: string, maxLen = 40): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

/**
 * 行内 AI 菜单：在 xl-ai 默认能力上拦截确定性块转换，并在思考/写入时提供可点停止。
 */
export function GooseAIMenu(props: AIMenuProps) {
  const editor = useBlockNoteEditor();
  const ai = useExtension(AIExtension);
  const { page } = useEditorPageContext();
  const dict = useAIDictionary();
  const [prompt, setPrompt] = useState("");

  const aiResponseStatus = useExtensionState(AIExtension, {
    selector: (state) =>
      (state.aiMenuState !== "closed"
        ? state.aiMenuState.status
        : "closed") as AiMenuStatus,
  });

  const aiErrorMessage = useExtensionState(AIExtension, {
    selector: (state) => {
      const menuState = state.aiMenuState;
      if (menuState === "closed" || menuState.status !== "error") {
        return "";
      }
      return formatAiErrorMessage(menuState.error);
    },
  });

  // 进入 error 时 toast 一次，避免状态抖动重复弹
  useEffect(() => {
    if (aiResponseStatus !== "error") return;
    const message = aiErrorMessage || dict.ai_menu.status.error;
    toast.error(message);
  }, [aiResponseStatus, aiErrorMessage, dict.ai_menu.status.error]);

  const handleManualPromptSubmit = useCallback(
    async (userPrompt: string) => {
      const transformIntent = resolveBlockTypeTransformIntent(userPrompt);
      if (!transformIntent) {
        const structureExpectation =
          resolveGeneratedBlockStructureExpectation(userPrompt);
        if (structureExpectation) {
          const beforeBlocks = structuredClone(
            editor.document,
          ) as BlockTypeTransformBlock[];
          await ai.invokeAI({
            userPrompt,
            useSelection: editor.getSelection() !== undefined,
          });

          const menuState = ai.store.state.aiMenuState;
          if (menuState !== "closed" && menuState.status === "user-reviewing") {
            const validation = validateGeneratedBlockStructure({
              beforeBlocks,
              afterBlocks: editor.document as BlockTypeTransformBlock[],
              expectation: structureExpectation,
            });
            if (!validation.ok) {
              ai.rejectChanges();
              toast.error(validation.reason);
            }
          }
          return;
        }

        if (props.onManualPromptSubmit) {
          props.onManualPromptSubmit(userPrompt);
          return;
        }
        void ai.invokeAI({
          userPrompt,
          useSelection: editor.getSelection() !== undefined,
        });
        return;
      }

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
    },
    [ai, editor, page, props],
  );

  const handleStop = useCallback(() => {
    void ai.abort();
  }, [ai]);

  const { items: externalItems } = props;
  const items = useMemo(() => {
    let next: AIMenuSuggestionItem[] = [];
    // 忙时只保留输入框右侧停止按钮，不在列表再放一项「停止」
    if (isBusyStatus(aiResponseStatus)) {
      next = [];
    } else if (externalItems) {
      next = externalItems(editor, aiResponseStatus);
    } else {
      next = getDefaultAIMenuItems(editor, aiResponseStatus);
    }

    return next.map((item) => ({
      ...item,
      onItemClick: () => {
        item.onItemClick(setPrompt);
      },
    }));
  }, [aiResponseStatus, editor, externalItems]);

  useEffect(() => {
    if (
      aiResponseStatus === "ai-writing" ||
      aiResponseStatus === "user-reviewing" ||
      aiResponseStatus === "error"
    ) {
      setPrompt("");
    }
  }, [aiResponseStatus]);

  const placeholder = useMemo(() => {
    if (aiResponseStatus === "thinking") {
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
  }, [aiResponseStatus, aiErrorMessage, dict]);

  const rightSection = useMemo(() => {
    if (isBusyStatus(aiResponseStatus)) {
      return (
        <div className="goose-ai-menu-busy-actions bn-combobox-right-section">
          <GooseThinkingOrb
            phase={
              aiResponseStatus === "thinking" ? "thinking" : "writing"
            }
            scale="inline"
            theme="auto"
            aria-hidden
          />
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
  }, [aiResponseStatus, handleStop]);

  return (
    <PromptSuggestionMenu
      onManualPromptSubmit={handleManualPromptSubmit}
      items={items}
      promptText={prompt}
      onPromptTextChange={setPrompt}
      placeholder={placeholder}
      disabled={isBusyStatus(aiResponseStatus)}
      icon={
        <div className="bn-combobox-icon">
          <RiSparkling2Fill />
        </div>
      }
      rightSection={rightSection}
    />
  );
}
