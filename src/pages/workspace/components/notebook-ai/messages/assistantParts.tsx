import { useContext } from "react";
import type {
  TextMessagePartProps,
  ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { ApprovalPlanCard } from "../ApprovalPlanCard";
import type { ToolDisplayPart } from "../toolProgressVisibility";
import { AssistantToolRenderContext } from "./toolRenderContext";
import { AssistantStreamdownText } from "./AssistantStreamdownText";
import { shouldShowToolPart } from "./messagePresentation";
import { renderToolVisual } from "./toolVisual";
function AssistantTextPart({ text, status }: TextMessagePartProps) {
  const ctx = useContext(AssistantToolRenderContext);
  // 多轮工具调用会留下多段正文；只有当前仍在输出的 part 才是 running
  const isPartStreaming =
    Boolean(ctx?.isStreaming) && status.type === "running";
  return (
    <AssistantStreamdownText
      text={text}
      isStreaming={isPartStreaming}
      editorRef={ctx?.editorRef}
    />
  );
}

/** 工作卡 footer：只渲染 executeBatchPlan 的 embedded 审批，其余 part 一律 null */
function AssistantApprovalPart({ artifact }: ToolCallMessagePartProps) {
  const ctx = useContext(AssistantToolRenderContext);
  if (!ctx) return null;
  const { isStreaming, onBatchApproval, onBatchUndo } = ctx;
  const part = artifact as ToolDisplayPart | undefined;
  if (!part || part.type !== "tool-executeBatchPlan") return null;
  if (!shouldShowToolPart(part, isStreaming)) return null;
  if (
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    part.state === "call" ||
    part.state === "partial-call"
  ) {
    return null;
  }
  return (
    <ApprovalPlanCard
      part={part}
      onApprovalResponse={onBatchApproval}
      onUndo={onBatchUndo}
      embedded
    />
  );
}

/** 纸外 artifact：只渲染 Table/Chart/Diagram/Svg，text 与审批一律 null */
function AssistantArtifactPart({ artifact }: ToolCallMessagePartProps) {
  const ctx = useContext(AssistantToolRenderContext);
  if (!ctx) return null;
  const { isStreaming, editorRef } = ctx;
  const part = artifact as ToolDisplayPart | undefined;
  if (!part || part.type === "tool-executeBatchPlan") return null;
  if (!shouldShowToolPart(part, isStreaming)) return null;
  return renderToolVisual(
    part,
    part.toolCallId ?? part.type,
    editorRef,
    isStreaming,
  );
}

function NullMessagePart() {
  return null;
}

/**
 * MessagePrimitive.Parts 的 components 必须模块级常量，避免 identity 抖动。
 * 同一条消息拆三份 map 各渲一类 part、其余 null，防止正文/审批/artifact 双渲染。
 */
export const ASSISTANT_TEXT_PARTS = {
  Text: AssistantTextPart,
  Reasoning: NullMessagePart,
  tools: { Override: NullMessagePart },
};

export const ASSISTANT_APPROVAL_PARTS = {
  Text: NullMessagePart,
  Reasoning: NullMessagePart,
  tools: { Override: AssistantApprovalPart },
};

export const ASSISTANT_ARTIFACT_PARTS = {
  Text: NullMessagePart,
  Reasoning: NullMessagePart,
  tools: { Override: AssistantArtifactPart },
};
