import type { AIStreamPhase } from "@/lib/ai-provider";

export function getStreamPreview(
  streamedContent: string,
  reasoningText: string,
  phase: AIStreamPhase,
) {
  const cleanedText = streamedContent.trim();
  if (cleanedText) {
    return cleanedText;
  }

  const cleanedReasoning = reasoningText.replace(/\s+/g, " ").trim();
  if (cleanedReasoning) {
    return cleanedReasoning;
  }

  if (phase === "connecting") return "正在准备请求…";
  if (phase === "thinking") return "AI 思考中…";
  if (phase === "generating") return "正在生成回答…";
  return "正在整理结果…";
}
