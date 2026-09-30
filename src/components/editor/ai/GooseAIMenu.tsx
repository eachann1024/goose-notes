import { useExtension, useExtensionState } from "@blocknote/react";
import { Square } from "@/components/ui/icons";
import { RiSparkling2Fill } from "react-icons/ri";
import { SelectionActions } from "@/pages/workspace/components/notebook-ai/beautiful-ui/SelectionActions";
import { GooseAIExtension } from "./GooseAIExtension";
import {
  GoosePromptSuggestionMenu,
  type GooseAiMenuTag,
} from "./GoosePromptSuggestionMenu";
import { formatAiMenuError } from "./formatAiMenuError";

const ACTIONS = [
  { key: "polish", label: "润色", prompt: "润色给定片段，保留原意。" },
  {
    key: "jargon",
    label: "工作黑话",
    prompt: "把给定片段改写成工作黑话，保留原意。",
  },
  {
    key: "simplify",
    label: "精简表达",
    prompt: "精简给定片段，保留关键信息。",
  },
  { key: "english", label: "翻译成英文", prompt: "将给定片段翻译成英文。" },
  { key: "chinese", label: "翻译成中文", prompt: "将给定片段翻译成中文。" },
  {
    key: "colloquial",
    label: "口语化",
    prompt: "把给定片段改得更口语、自然。",
  },
  {
    key: "list",
    label: "整理为列表",
    prompt: "将给定片段整理成无序列表，每个要点独立一行。",
  },
  {
    key: "tasks",
    label: "待办事项",
    prompt: "将给定片段整理成 Markdown 待办列表，每项使用 - [ ] 独立一行。",
  },
];

export function GooseAIMenu() {
  const ai = useExtension(GooseAIExtension);
  const state = useExtensionState(GooseAIExtension, {
    selector: (value) => value.aiMenuState,
  });
  if (state === "closed") return null;
  const busy = state.status === "thinking";
  const tags: GooseAiMenuTag[] = busy
    ? []
    : state.status === "user-reviewing"
      ? [
          { key: "accept", label: "接受全部", onClick: ai.acceptChanges },
          { key: "reject", label: "放弃", onClick: ai.rejectChanges },
          { key: "retry", label: "重试", onClick: () => void ai.retry() },
        ]
      : state.status === "error"
        ? [
            ...(state.prompt
              ? [
                  {
                    key: "retry",
                    label: "重试",
                    onClick: () => void ai.retry(),
                  },
                ]
              : []),
            { key: "cancel", label: "关闭", onClick: ai.closeAIMenu },
          ]
        : [...ACTIONS.map((action) => ({
            ...action,
            onClick: () => void ai.submit(action.prompt),
          })), { key: "cancel", label: "关闭", onClick: ai.closeAIMenu }];

  return (
    <SelectionActions busy={busy} className={`goose-ai-menu-selection${state.status === "user-reviewing" ? " goose-ai-review-surface" : ""}`}>
      {state.status === "user-reviewing" && (
        <p className="goose-ai-preview-summary" role="status">
          原位预览 · <del>删除</del> / <ins>新增</ins> · 接受后写入
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="p-3 text-sm text-danger">
          {formatAiMenuError(state.error) || "改写失败，内容未修改。"}
        </p>
      )}
      <GoosePromptSuggestionMenu
        onManualPromptSubmit={(value) => void ai.submit(value)}
        promptText={state.input ?? ""}
        onPromptTextChange={ai.setInput}
        placeholder={
          busy
            ? "思考中"
            : state.status === "user-reviewing"
              ? "输入新要求重新生成，或接受草稿"
              : "你想如何改写这段内容？"
        }
        disabled={busy}
        busy={busy}
        busyTickerText={state.ticker}
        tags={tags}
        showPlus={state.status === "user-input"}
        onOpenAiPanel={() => {
          ai.closeAIMenu();
          window.dispatchEvent(
            new CustomEvent("goose-note:open-settings", {
              detail: { tab: "ai" },
            }),
          );
        }}
        icon={
          <div className="bn-combobox-icon">
            <RiSparkling2Fill />
          </div>
        }
        rightSection={
          busy ? (
            <div className="goose-ai-menu-busy-actions bn-combobox-right-section">
              <button
                type="button"
                className="goose-ai-menu-stop"
                aria-label="停止"
                title="停止"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  ai.abort();
                }}
              >
                <Square className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ) : undefined
        }
      />
    </SelectionActions>
  );
}
