import { normalizeBatchPlanInput } from "@/lib/notebook-ai/batch-plan";
import type { BatchPlanInput, BatchPlanOutput } from "./types";
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseInput(
  value: unknown,
  toolCallId?: string,
): BatchPlanInput {
  const normalized = normalizeBatchPlanInput(value, {
    fallbackRunId: toolCallId ? `batch-${toolCallId}` : undefined,
    fallbackTitle: "笔记变更计划",
  });
  if (!normalized) return {};
  return {
    runId: normalized.runId,
    title: normalized.title,
    summary: normalized.summary,
    operations: normalized.operations,
  };
}

export function parseOutput(value: unknown): BatchPlanOutput {
  return isRecord(value) ? (value as BatchPlanOutput) : {};
}
