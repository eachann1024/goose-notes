/**
 * 行内 AI：对精确选区/光标块做 Markdown 改写，返回草稿供用户确认。
 * 走与面板相同的 runAITextStream（SSE），边思考边把最新一句盖进输入槽。
 */
import type { AISettingsLike, AIStreamUpdate } from "@/lib/ai-provider/types";
import { runAITextStream } from "@/lib/ai-provider";

export interface RunInlineMarkdownRewriteOptions {
  settings: AISettingsLike;
  modelId: string;
  userPrompt: string;
  oldMarkdown: string;
  abortSignal?: AbortSignal;
  onUpdate?: (update: AIStreamUpdate) => void;
}

const SYSTEM_PROMPT = [
  "你是笔记行内改写助手。根据用户指令改写给定的 Markdown 片段。",
  "只输出改写后的 Markdown 正文，不要解释、不要包代码围栏（除非正文本身是代码块）。",
  "保持合理的 Markdown 结构：列表项用独立的 `- ` / `1. ` / `- [ ] ` 行；列表项之间不要插空行。",
  "若用户要求生成 N 个列表项，输出 N 行列表语法，不要挤在一个段落里。",
  "不要输出页面标题（# 一级标题），只改写当前片段。",
  "保留原有对齐、字体颜色和背景色：不要删除 HTML 注释、span style 或 text-align。",
].join("\n");

function stripOuterFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (match) return match[1].trim();
  return trimmed;
}

/**
 * 调用模型，将 oldMarkdown 按 userPrompt 改写为新 markdown 字符串。
 */
export async function runInlineMarkdownRewrite(
  options: RunInlineMarkdownRewriteOptions,
): Promise<string> {
  const { settings, modelId, userPrompt, oldMarkdown, abortSignal } = options;

  const prompt = [
    "【当前片段 Markdown】",
    oldMarkdown.trim() ? oldMarkdown : "（空）",
    "",
    "【用户指令】",
    userPrompt.trim(),
    "",
    "请直接输出改写后的 Markdown：",
  ].join("\n");

  const text = await runAITextStream(
    settings,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    {
      abortSignal,
      requestOverrides: { selectedModelId: modelId },
      onUpdate: options.onUpdate,
    },
  );

  const stripped = stripOuterFence(text ?? "");
  if (!stripped) {
    throw new Error("AI 未返回可写入的内容。");
  }
  return stripped;
}
