import { useExtension, useExtensionState } from "@blocknote/react";
import { Sparkles, Square, X } from "@/components/ui/icons";
import "./inlineAiSurface.css";
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
    label: "精简",
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
          { key: "accept", label: "应用修改", onClick: ai.acceptChanges },
          { key: "reject", label: "放弃", onClick: ai.rejectChanges },
          { key: "retry", label: "重新生成", onClick: () => void ai.retry() },
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
          ]
        : [
            ...ACTIONS.filter((action) =>
              ["polish", "simplify"].includes(action.key),
            ).map((action) => ({
              ...action,
              onClick: () => void ai.submit(action.prompt),
            })),
          ];

  return (
    <SelectionActions
      busy={busy}
      className="goose-ai-menu-selection goose-inline-ai-surface"
    >
      <div className="goose-inline-ai-header">
        <span>
          <Sparkles className="h-4 w-4" aria-hidden />
          {busy
            ? "正在改写"
            : state.status === "user-reviewing"
              ? "审阅修改"
              : state.status === "error"
                ? "改写未完成"
                : "编辑所选内容"}
        </span>
        <button
          type="button"
          className="goose-inline-ai-close"
          aria-label="关闭 AI 编辑"
          title="关闭"
          onMouseDown={(event) => event.preventDefault()}
          onClick={ai.closeAIMenu}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {state.status === "user-reviewing" && (
        <p className="goose-ai-preview-summary" role="status">
          <del>删除</del> <ins>新增</ins>
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="goose-inline-ai-error">
          {formatAiMenuError(state.error) || "生成中断，未对正文进行修改"}
        </p>
      )}
      <GoosePromptSuggestionMenu
        onManualPromptSubmit={(value) => void ai.submit(value)}
        promptText={state.input ?? ""}
        onPromptTextChange={ai.setInput}
        placeholder={
          busy
            ? "正在思考并生成…"
            : state.status === "user-reviewing"
              ? "输入进一步修改要求（如：再简短一些）…"
              : "告诉 AI 如何处理这段内容（如：润色、精简、翻译）…"
        }
        disabled={busy}
        busy={busy}
        busyTickerText={state.ticker}
        tags={tags}
        showSubmit={!busy && state.status !== "error"}
        actionMenus={
          state.status === "user-input"
            ? [
                {
                  label: "翻译",
                  actions: ACTIONS.filter((action) =>
                    ["english", "chinese"].includes(action.key),
                  ).map((action) => ({
                    ...action,
                    onClick: () => void ai.submit(action.prompt),
                  })),
                },
                {
                  label: "更多",
                  actions: ACTIONS.filter((action) =>
                    ["jargon", "colloquial", "list", "tasks"].includes(
                      action.key,
                    ),
                  ).map((action) => ({
                    ...action,
                    onClick: () => void ai.submit(action.prompt),
                  })),
                },
              ]
            : undefined
        }
        showPlus={state.status === "user-input"}
        onOpenAiPanel={() => {
          ai.closeAIMenu();
          window.dispatchEvent(
            new CustomEvent("goose-note:open-settings", {
              detail: { tab: "ai" },
            }),
          );
        }}
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
                <Square className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                停止
              </button>
            </div>
          ) : undefined
        }
      />
    </SelectionActions>
  );
}
