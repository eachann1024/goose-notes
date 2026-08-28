/**
 * 处理进度：与审批卡同一套纸面（字距 kicker + 大标题 + 可展开步骤）。
 * 步骤平铺在卡内，不再套一层任务卡，也不再用 12px 日志行。
 */
import { useMemo, useState, type ReactNode } from "react";
import {
  ORB_VISIBLE_MIN_MS,
  useMinHoldActive,
} from "@/components/ui/ai-motion";
import { cn } from "@/lib/utils";
import { resolveLoaderHold } from "./beautifulUiMap";
import {
  buildToolProgressSteps,
  getToolProgressStepStatus,
  getToolProgressSummary,
  type ProgressStep,
  type ToolProgressPart,
} from "./toolProgressModel";
import {
  getWorkCardHeading,
  getWorkCardPhase,
} from "./workCardHeading";

export {
  getToolProgressStepStatus,
  getToolProgressSummary,
  type ToolProgressPart,
};

function StepMark({ status }: { status: ProgressStep["status"] }) {
  if (status === "running") {
    return <span className="bui-think-spinner notebook-ai-work-mark" aria-hidden />;
  }
  if (status === "error") {
    return (
      <svg
        className="notebook-ai-work-mark notebook-ai-work-mark--danger"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  if (status === "done") {
    return (
      <svg
        className="notebook-ai-work-mark"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  return <span className="notebook-ai-work-dot" aria-hidden />;
}

function stepStatusLabel(status: ProgressStep["status"]) {
  if (status === "running") return "进行中";
  if (status === "error") return "失败";
  if (status === "done") return "完成";
  return "待处理";
}

function FoldChevron() {
  return (
    <svg
      className="notebook-ai-work-chev"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

interface ToolProgressCardProps {
  parts: ToolProgressPart[];
  isMessageStreaming?: boolean;
  children?: ReactNode;
}

export function ToolProgressCard({
  parts,
  isMessageStreaming,
  children,
}: ToolProgressCardProps) {
  const steps = useMemo(
    () => buildToolProgressSteps(parts, isMessageStreaming),
    [parts, isMessageStreaming],
  );

  const hasError = steps.some((step) => step.status === "error");
  const isRunning =
    !hasError &&
    (Boolean(isMessageStreaming) ||
      steps.some((step) => step.status === "running"));
  const heldRunning = useMinHoldActive(isRunning, ORB_VISIBLE_MIN_MS);
  const showRunning = resolveLoaderHold(isRunning, heldRunning);
  const phase = getWorkCardPhase(steps, showRunning);
  const heading = getWorkCardHeading(steps, phase);
  const [open, setOpen] = useState(false);
  const foldable = steps.length > 0;
  const toggleText = heading.toggle || (showRunning ? "正在处理" : "");

  if (steps.length === 0 && !showRunning) return null;

  return (
    <section
      className="bui-root bui-approval notebook-ai-work-card"
      aria-label="处理进度"
      aria-busy={showRunning || undefined}
    >
      <p
        className={cn(
          "m-0 text-[12px] tracking-[0.08em] text-muted-foreground",
          heading.tone === "danger" &&
            "text-[var(--goose-color-danger-focus)]",
        )}
      >
        {heading.kicker}
      </p>
      <h3 className="mt-2 flex min-w-0 items-start gap-2 text-[20px] font-semibold leading-tight tracking-[-0.04em] text-foreground">
        {showRunning && steps.length === 0 ? (
          <span className="bui-think-spinner notebook-ai-work-mark mt-1" aria-hidden />
        ) : null}
        <span className="notebook-ai-work-title" title={heading.title}>
          {heading.title}
        </span>
      </h3>
      {foldable ? (
        <button
          type="button"
          className="notebook-ai-work-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <FoldChevron />
          <span className="notebook-ai-work-toggle-label">{toggleText}</span>
        </button>
      ) : showRunning && toggleText ? (
        <p className="notebook-ai-work-live" aria-live="polite">
          {toggleText}
        </p>
      ) : null}
      {foldable && open ? (
        <ul className="notebook-ai-work-steps">
          {steps.map((step, index) => (
            <li key={`${step.label}-${index}`} className="notebook-ai-work-step">
              <StepMark status={step.status} />
              <div className="notebook-ai-work-step-body">
                <div className="notebook-ai-work-step-row">
                  <span className="notebook-ai-work-step-label">
                    {step.label}
                  </span>
                  <span
                    className={cn(
                      "notebook-ai-work-step-st",
                      step.status === "error" &&
                        "text-[var(--goose-color-danger-focus)]",
                    )}
                  >
                    {stepStatusLabel(step.status)}
                  </span>
                </div>
                {step.status === "error" && step.detail ? (
                  <p className="notebook-ai-work-step-detail">{step.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {children ? (
        <div className="notebook-ai-work-aside">{children}</div>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {heading.kicker}
        {heading.title}
      </span>
    </section>
  );
}
