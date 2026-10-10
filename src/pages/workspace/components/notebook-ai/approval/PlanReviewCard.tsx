import { ToolProgressCard } from "../ToolProgressCard";
import { ReviewActions } from "./ReviewActions";
import { ReviewProposal } from "./ReviewProposal";
import type { ApprovalPlanCardProps } from "./types";

/** 同一回复生成多份方案时，每份预览与它的审批操作保持相邻。 */
export function PlanReviewCard({
  part,
  onApprovalResponse,
  onUndo,
}: ApprovalPlanCardProps) {
  return (
    <ToolProgressCard
      parts={[{ ...part, type: "tool-executeBatchPlan" }]}
      footer={
        <ReviewActions
          part={part}
          onApprovalResponse={onApprovalResponse}
          onUndo={onUndo}
          embedded
        />
      }
    >
      <ReviewProposal part={part} />
    </ToolProgressCard>
  );
}
