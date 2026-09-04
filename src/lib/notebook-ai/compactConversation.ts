import { generateText } from "ai";
import { buildLanguageModel } from "./model";
import type { NotebookAiMessage } from "./types";

const MAX_COMPACT_TRANSCRIPT_CHARS = 80_000;

const COMPACT_SYSTEM_PROMPT = `你是会话压缩助手。把用户提供的对话记录压缩成一份结构化摘要，必须保留：
- 用户目标和约束
- 已做出的决定、结论与约定
- 仍未完成的事项
- 关键页面、文件或引用

不要继续完成原任务，不要调用工具，不要提问。使用与原对话相同的语言。只输出摘要本身，不要开场白或收尾客套。`;

export const COMPACT_CONTINUATION_PROMPT =
  "此前对话已压缩。请把助手上一条消息当作完整历史上下文，据此继续。不要重复摘要。";

export const COMPACT_DISPLAY_TEXT = "/压缩";

function extractTextParts(message: NotebookAiMessage): string {
  const chunks: string[] = [];
  for (const part of message.parts ?? []) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    ) {
      const text = part.text.trim();
      if (text) chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

function extractUserText(message: NotebookAiMessage): string {
  const display = message.metadata?.displayText?.trim();
  if (display) return display;
  return extractTextParts(message);
}

export function formatConversationTranscript(
  messages: NotebookAiMessage[],
): string {
  const blocks: string[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text =
      message.role === "user"
        ? extractUserText(message)
        : extractTextParts(message);
    if (!text) continue;
    const role = message.role === "user" ? "用户" : "助手";
    blocks.push(`${role}：\n${text}`);
  }
  const joined = blocks.join("\n\n");
  if (joined.length <= MAX_COMPACT_TRANSCRIPT_CHARS) return joined;
  return joined.slice(joined.length - MAX_COMPACT_TRANSCRIPT_CHARS);
}

export function conversationHasCompactableContent(
  messages: NotebookAiMessage[],
): boolean {
  return formatConversationTranscript(messages).length > 0;
}

export function wrapCompactSummaryForDisplay(summary: string): string {
  return `会话已压缩。后续提问会基于这份摘要继续。\n\n${summary.trim()}`;
}

export function buildCompactedConversation(options: {
  summary: string;
  createId: (prefix: string) => string;
  now?: number;
}): NotebookAiMessage[] {
  const now = options.now ?? Date.now();
  const summary = options.summary.trim();
  return [
    {
      id: options.createId("compact-user"),
      role: "user",
      parts: [{ type: "text", text: COMPACT_CONTINUATION_PROMPT }],
      metadata: {
        displayText: COMPACT_DISPLAY_TEXT,
        compacted: true,
        createdAt: now,
      },
    },
    {
      id: options.createId("compact-assistant"),
      role: "assistant",
      parts: [{ type: "text", text: wrapCompactSummaryForDisplay(summary) }],
      metadata: {
        compacted: true,
        createdAt: now,
      },
    },
  ];
}

export async function generateConversationCompactSummary(
  messages: NotebookAiMessage[],
  abortSignal?: AbortSignal,
): Promise<string> {
  const modelCheck = buildLanguageModel();
  if (!modelCheck.ok) {
    throw new Error(modelCheck.reason);
  }
  const transcript = formatConversationTranscript(messages);
  if (!transcript) {
    throw new Error("当前会话没有可压缩的内容");
  }
  const { text } = await generateText({
    model: modelCheck.model,
    system: COMPACT_SYSTEM_PROMPT,
    prompt: `请压缩以下对话：\n\n${transcript}`,
    abortSignal,
    timeout: 60_000,
  });
  const summary = text.trim();
  if (!summary) {
    throw new Error("压缩失败，未得到摘要");
  }
  return summary;
}
