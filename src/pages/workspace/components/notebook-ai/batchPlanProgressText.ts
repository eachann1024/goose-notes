import { formatNotebookAiError } from "@/lib/notebook-ai/errors";
import { readObject, truncate } from "./toolProgressValues";
import type { ToolProgressPart, ProgressStep } from "./toolProgressModel";
/** 计划的准备、批准、执行与撤回使用同一状态文案。 */
export function getBatchPlanProgressText(
  part: ToolProgressPart,
  input: Record<string, unknown> | null,
  output: Record<string, unknown> | null,
  title: string,
): Pick<ProgressStep, "label" | "detail"> {
  const operationCount = Array.isArray(input?.operations)
    ? input.operations.length
    : Array.isArray(readObject(input?.plan)?.changes)
      ? (readObject(input?.plan)?.changes as unknown[]).length
      : 0;
  const executionFailed =
    part.state === "output-error" ||
    Boolean(part.errorText) ||
    (part.state === "output-available" && output?.ok === false);
  if (executionFailed) {
    return {
      label: "生成批量计划",
      detail: formatNotebookAiError(part.errorText || output?.error, {
        phase: part.approval?.approved === true ? "execute" : "prepare",
      }),
    };
  }
  if (
    part.state === "output-denied" ||
    (part.state === "approval-responded" && part.approval?.approved === false)
  ) {
    return { label: "生成批量计划", detail: "已取消本次变更" };
  }
  if (output?.status === "undone") {
    return { label: "执行批量计划", detail: "已撤回本批变更" };
  }
  if (part.state === "approval-responded" && part.approval?.approved === true) {
    return { label: "执行批量计划", detail: "正在执行已同意的变更" };
  }
  if (
    part.state === "output-available" &&
    output?.ok === true &&
    output?.status !== "prepared"
  ) {
    const appliedCount =
      typeof output.appliedCount === "number"
        ? output.appliedCount
        : operationCount;
    return {
      label: "执行批量计划",
      detail: appliedCount ? `已完成 ${appliedCount} 项变更` : "本批变更已完成",
    };
  }
  if (
    part.state === "approval-requested" ||
    (part.state === "output-available" &&
      output?.status === "prepared" &&
      output?.needsApproval === true)
  ) {
    return {
      label: "生成批量计划",
      detail: operationCount
        ? `已生成 ${operationCount} 项操作，等待审批`
        : "计划已生成，等待审批",
    };
  }
  return {
    label: "生成批量计划",
    detail: title
      ? `正在生成《${truncate(title)}》`
      : "正在整理批量操作与审批内容",
  };
}
