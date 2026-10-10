/**
 * 处理进度：所有阶段共用紧凑状态标签，步骤与具体原因保留在正文。
 * 工具调用与思考汇总成一行；思考只在行内截成一句，不另开折叠。
 */
import { useMemo, useState, type ReactNode } from "react";
import { visibleBusyTickerLine } from "@/components/editor/ai/inlineBusyTicker";
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
import { getWorkCardHeading, getWorkCardPhase } from "./workCardHeading";
import { WorkCardStatus } from "./WorkCardStatus";
import {
  WorkCardStatusContext,
  type WorkCardStatusData,
} from "./workCardStatusContext";

export {
  getToolProgressStepStatus,
  getToolProgressSummary,
  type ToolProgressPart,
};

function stepStatusLabel(status: ProgressStep["status"]) {
  if (status === "running") return "进行中";
  if (status === "error") return "失败";
  if (status === "done") return "完成";
  if (status === "approval") return "等待同意";
  if (status === "cancelled") return "已取消";
  if (status === "undone") return "已撤回";
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

interface ToolProgressCardProps {
  parts: ToolProgressPart[];
  isMessageStreaming?: boolean;
  /** 多段思考拼成一段后压成行内一句，与工具摘要同一行。 */
  thinkingText?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

function WorkCardTraceRow({
  foldable,
  open,
  label,
  thinkingLine,
  onToggle,
}: {
  foldable: boolean;
  open: boolean;
  label: string;
  thinkingLine: string;
  onToggle: () => void;
}) {
  const body = (
    <>
      {foldable ? <FoldChevron /> : null}
      {label ? (
        <span className="notebook-ai-work-toggle-label">{label}</span>
      ) : null}
      {thinkingLine ? (
        <span
          className="notebook-ai-work-think"
          title={thinkingLine}
          aria-live="polite"
        >
          {thinkingLine}
        </span>
      ) : null}
    </>
  );

  if (foldable) {
    return (
      <button
        type="button"
        className="notebook-ai-work-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        {body}
      </button>
    );
  }

  return (
    <p className="notebook-ai-work-toggle notebook-ai-work-toggle--static">
      {body}
    </p>
  );
}

export function ToolProgressCard({
  parts,
  isMessageStreaming,
  thinkingText,
  children,
  footer,
}: ToolProgressCardProps) {
  const steps = useMemo(
    () => buildToolProgressSteps(parts, isMessageStreaming),
    [parts, isMessageStreaming],
  );
  const thinkingLine = visibleBusyTickerLine(thinkingText ?? "");
  const hasThinking = thinkingLine.length > 0;

  const hasError = steps.some((step) => step.status === "error");
  const isRunning =
    !hasError &&
    (Boolean(isMessageStreaming) ||
      steps.some((step) => step.status === "running"));
  const heldRunning = useMinHoldActive(isRunning, ORB_VISIBLE_MIN_MS);
  const showRunning = resolveLoaderHold(isRunning, heldRunning);
  const phase = getWorkCardPhase(steps, showRunning);
  const heading = getWorkCardHeading(steps, phase);
  const [approvalStatus, setApprovalStatus] =
    useState<WorkCardStatusData | null>(null);
  const status = approvalStatus ?? heading.status;
  const showProcessing = status.icon === "running";
  // 步骤默认收起，不随 running/error 自动展开
  const [open, setOpen] = useState(false);
  const foldable = steps.length > 0;
  const traceLabel = foldable ? heading.toggle : hasThinking ? "思考" : "";
  const showTraceRow = foldable || hasThinking;
  // 纯问答纸：无步骤且非 running 时不出抬头，避免伪造「处理完成」
  const hasHeading = foldable || showRunning;

  if (!hasHeading && !showTraceRow && !children && !footer) return null;

  return (
    <WorkCardStatusContext.Provider value={setApprovalStatus}>
      <section
        className={cn(
          "bui-root bui-approval notebook-ai-work-card",
          showProcessing && "notebook-ai-work-card--running",
        )}
        aria-label="处理进度"
        aria-busy={showProcessing || undefined}
      >
        {hasHeading ? <WorkCardStatus status={status} /> : null}
        {heading.detail && !footer ? (
          <p className="notebook-ai-work-status-detail" role="alert">
            {heading.detail}
          </p>
        ) : null}
        {showTraceRow ? (
          <WorkCardTraceRow
            foldable={foldable}
            open={open}
            label={traceLabel}
            thinkingLine={thinkingLine}
            onToggle={() => setOpen((value) => !value)}
          />
        ) : null}
        {foldable && open ? (
          <ul className="notebook-ai-work-steps">
            {steps.map((step, index) => (
              <li
                key={`${step.label}-${index}`}
                className="notebook-ai-work-step"
              >
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
                    <p className="notebook-ai-work-step-detail">
                      {step.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {children ? (
          <div
            className={cn(
              "notebook-ai-work-letter",
              !hasHeading && !showTraceRow && "notebook-ai-work-letter--flush",
            )}
          >
            {children}
          </div>
        ) : null}
        {footer ? (
          <div className="notebook-ai-work-footer">{footer}</div>
        ) : null}
        {hasHeading || thinkingLine ? (
          <span
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {hasHeading ? status.label : ""}
            {thinkingLine}
          </span>
        ) : null}
      </section>
    </WorkCardStatusContext.Provider>
  );
}
