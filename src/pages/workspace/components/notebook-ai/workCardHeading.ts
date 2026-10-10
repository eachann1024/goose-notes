import type { ProgressStep } from "./toolProgressModel";
import type { WorkCardStatusData } from "./workCardStatusContext";

export type WorkCardPhase = ProgressStep["status"];

export type WorkCardHeading = {
  status: WorkCardStatusData;
  detail?: string;
  toggle: string;
};

const CONFLICT = "页面内容已发生变化";

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
  const latestStatus = steps.at(-1)?.status;
  if (
    latestStatus === "approval" ||
    latestStatus === "cancelled" ||
    latestStatus === "undone"
  )
    return latestStatus;
  if (isRunning) return "running";
  if (steps.some((step) => step.status === "waiting")) return "waiting";
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
  const latest =
    errorStep ?? (phase === "running" ? runningStep : steps[n - 1]) ?? doneStep;
  const toggle =
    n === 0 ? "" : `${n} 步${latest?.label ? ` · ${latest.label}` : ""}`;

  if (phase === "error") {
    const detail = errorStep?.detail ?? "";
    const conflict = detail.includes(CONFLICT);
    return {
      status: {
        label: conflict ? "写入已取消" : "处理失败",
        tone: "danger",
        icon: conflict ? "cancelled" : "error",
      },
      detail,
      toggle,
    };
  }

  if (phase === "running") {
    return {
      status: { label: "处理中", tone: "accent", icon: "running" },
      toggle,
    };
  }

  const status: WorkCardStatusData =
    phase === "approval"
      ? { label: "等待同意", tone: "warning", icon: "waiting" }
      : phase === "cancelled"
        ? { label: "已取消", tone: "neutral", icon: "cancelled" }
        : phase === "undone"
          ? { label: "已撤回", tone: "neutral", icon: "undone" }
          : phase === "waiting"
            ? { label: "待处理", tone: "warning", icon: "waiting" }
            : { label: "处理完成", tone: "success", icon: "done" };
  return { status, toggle };
}
