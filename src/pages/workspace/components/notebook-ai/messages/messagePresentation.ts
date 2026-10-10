import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import type { ApprovalPlanPart } from "../ApprovalPlanCard";
import {
  isDefaultChatSkillPart,
  type ToolDisplayPart,
} from "../toolProgressVisibility";
const INPUT_ONLY_STATES = new Set([
  "call",
  "partial-call",
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
]);

export function getTextPartText(message: NotebookAiMessage) {
  const textPart = message.parts?.find((p) => p.type === "text");
  return textPart && "text" in textPart
    ? (textPart as { text: string }).text
    : "";
}

export function collectReasoningText(message: NotebookAiMessage): string {
  const chunks: string[] = [];
  for (const part of message.parts ?? []) {
    if (part.type !== "reasoning" || !("text" in part)) continue;
    const text = String(part.text ?? "").trim();
    if (text) chunks.push(text);
  }
  return chunks.join("\n");
}

export function getUserDisplayText(message: NotebookAiMessage) {
  const metadataText = message.metadata?.displayText?.trim();
  if (metadataText) return metadataText;

  const rawText = getTextPartText(message).trim();
  const hiddenContextStart = rawText.indexOf("\n\n本轮笔记上下文：");
  if (rawText.startsWith("用户输入：") && hiddenContextStart > -1) {
    return rawText.slice("用户输入：".length, hiddenContextStart).trim();
  }
  if (rawText.startsWith("用户输入：")) {
    return rawText.slice("用户输入：".length).trim();
  }
  return rawText;
}

export function getUserImageParts(message: NotebookAiMessage) {
  return (message.parts ?? []).filter(
    (
      part,
    ): part is {
      type: "file";
      url: string;
      filename?: string;
      mediaType: string;
    } =>
      part.type === "file" &&
      "url" in part &&
      typeof part.url === "string" &&
      "mediaType" in part &&
      typeof part.mediaType === "string" &&
      part.mediaType.startsWith("image/"),
  );
}

export function shouldShowToolPart(
  part: ToolDisplayPart,
  isMessageStreaming: boolean,
) {
  if (isDefaultChatSkillPart(part)) return false;
  const state = part.state ?? "";
  if (
    part.type === "tool-executeBatchPlan" &&
    (state === "approval-requested" || state === "approval-responded")
  ) {
    return true;
  }
  const hasTerminalPayload =
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied" ||
    part.output !== undefined ||
    Boolean(part.errorText);

  return (
    isMessageStreaming || !INPUT_ONLY_STATES.has(state) || hasTerminalPayload
  );
}

/** 与 AssistantApprovalPart 的 input 态 guard 保持一致：只有真正会渲染的审批 part 才需要 footer */
export function hasVisibleApprovalPart(
  parts: ToolDisplayPart[],
  isMessageStreaming: boolean,
) {
  return parts.some(
    (part) =>
      part.type === "tool-executeBatchPlan" &&
      shouldShowToolPart(part, isMessageStreaming) &&
      part.state !== "input-streaming" &&
      part.state !== "input-available" &&
      part.state !== "call" &&
      part.state !== "partial-call",
  );
}

/** 与 hasVisibleApprovalPart 同一套 guard，取出第一条可见的审批 part 给提案预览用 */
export function findVisibleApprovalPart(
  parts: ToolDisplayPart[],
  isMessageStreaming: boolean,
): ApprovalPlanPart | undefined {
  return parts.find(
    (part) =>
      part.type === "tool-executeBatchPlan" &&
      shouldShowToolPart(part, isMessageStreaming) &&
      part.state !== "input-streaming" &&
      part.state !== "input-available" &&
      part.state !== "call" &&
      part.state !== "partial-call",
  );
}
