import type { AIStreamPhase } from "@/lib/ai-provider";

export const AI_SYSTEM_PROMPT =
  "你是 Goose Note 内置写作助手。输出必须直接可落文，不要解释，不要加前后缀，不要使用 Markdown 代码围栏。只输出最终文本。";

export const STREAM_PHASE_META: Record<AIStreamPhase, { label: string; tone: string; dot: string }> = {
  connecting: {
    label: "正在连接",
    tone: "text-slate-500 dark:text-slate-300",
    dot: "bg-slate-400/70",
  },
  thinking: {
    label: "AI 思考中",
    tone: "text-amber-600 dark:text-amber-300",
    dot: "bg-amber-400/80",
  },
  generating: {
    label: "正在生成",
    tone: "text-sky-600 dark:text-sky-300",
    dot: "bg-sky-400/80",
  },
  finishing: {
    label: "正在整理",
    tone: "text-emerald-600 dark:text-emerald-300",
    dot: "bg-emerald-400/80",
  },
};

