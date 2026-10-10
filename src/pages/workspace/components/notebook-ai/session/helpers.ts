import type { NotebookAiImageAttachment } from "../Composer";
import { formatNotebookAiError } from "@/lib/notebook-ai/errors";
export const NOTEBOOK_AI_PLACEHOLDER_HINTS = [
  "向 AI 提问，/ 调用指令或 Skill，@ 引用笔记或本地文件…",
  "让 AI 根据当前笔记生成一张趋势图…",
  "让 AI 画一个流程图或架构图…",
  "让 AI 生成一张图标或示意图…",
  "试试：总结 @本地文件，并画出要点关系图…",
];

export function createChatMessageId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createImageFileList(
  images: NotebookAiImageAttachment[],
): FileList | undefined {
  if (images.length === 0) return undefined;
  const dataTransfer = new DataTransfer();
  images.forEach(({ file }) => dataTransfer.items.add(file));
  return dataTransfer.files;
}

export function formatNotebookAiChatError(error: Error): string {
  return formatNotebookAiError(error);
}
