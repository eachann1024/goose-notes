import type { ProgressStep } from "./toolProgressModel";

export type WorkCardPhase = "running" | "done" | "error";

export type WorkCardHeading = {
  kicker: string;
  title: string;
  toggle: string;
  tone: "neutral" | "danger";
};

const CONFLICT = "页面内容已发生变化";

function firstClause(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.split(/[。！？\n]/, 1)[0]?.trim() || trimmed;
}

function shorten(text: string, max = 22): string {
  const clause = firstClause(text);
  if (!clause) return "";
  if (clause.length <= max) return clause;
  return `${clause.slice(0, max).trimEnd()}…`;
}

function lastOf(
  steps: readonly ProgressStep[],
  status: ProgressStep["status"],
): ProgressStep | undefined {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    if (steps[i]?.status === status) return steps[i];
  }
  return undefined;
}

export function getWorkCardPhase(
  steps: readonly ProgressStep[],
  isRunning: boolean,
): WorkCardPhase {
  if (steps.some((step) => step.status === "error")) return "error";
  if (isRunning) return "running";
  return "done";
}

export function getWorkCardHeading(
  steps: readonly ProgressStep[],
  phase: WorkCardPhase,
): WorkCardHeading {
  const n = steps.length;
  const errorStep = steps.find((step) => step.status === "error");
  const runningStep = lastOf(steps, "running");
  const doneStep = lastOf(steps, "done");
  const latest = errorStep ?? runningStep ?? doneStep ?? steps[n - 1];
  const toggle =
    n === 0 ? "" : `${n} 步${latest?.label ? ` · ${latest.label}` : ""}`;

  if (phase === "error") {
    const detail = errorStep?.detail ?? "";
    const conflict = detail.includes(CONFLICT);
    return {
      kicker: conflict ? "写入已取消" : "处理失败",
      title: conflict
        ? "页面已被改过"
        : shorten(detail) || errorStep?.label || "处理失败",
      toggle,
      tone: "danger",
    };
  }

  if (phase === "running") {
    return {
      kicker: "处理中",
      title: runningStep?.detail || "正在处理",
      toggle,
      tone: "neutral",
    };
  }

  return {
    kicker: "处理完成",
    title: doneStep?.detail || (n > 0 ? `${n} 步完成` : "已完成"),
    toggle,
    tone: "neutral",
  };
}
