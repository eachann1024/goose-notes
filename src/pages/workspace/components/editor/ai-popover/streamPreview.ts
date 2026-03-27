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

  if (phase === "connecting") return "正在连接自定义 AI 服务…";
  if (phase === "thinking") return "正在分析上下文与任务要求…";
  if (phase === "generating") return "模型已开始输出，内容会实时出现…";
  return "正在整理最后结果…";
}

