import {
  normalizeBatchPlanInput,
  readBatchPlanJournal,
} from "@/lib/notebook-ai/batch-plan";
import type {
  BatchPlanOperationInput,
  BatchPlanJournal,
} from "@/lib/notebook-ai/batch-plan/types";
import { jsonContentToMarkdown } from "@/lib/export/markdown/serialize";
import { plannedContent } from "@/lib/notebook-ai/batch-plan/batchPlannedContent";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import type { Page } from "@/types";

export function readReviewPlan(part: { input?: unknown; toolCallId?: string }) {
  const input = normalizeBatchPlanInput(part.input, {
    fallbackRunId: part.toolCallId ? `batch-${part.toolCallId}` : undefined,
    fallbackTitle: "笔记变更计划",
  });
  const journal =
    part.toolCallId && input?.runId
      ? readBatchPlanJournal(part.toolCallId, input.runId)
      : null;
  return {
    input: journal ? { ...journal.input, runId: journal.runId } : input,
    journal,
  };
}
export function originalMarkdown(
  operation: BatchPlanOperationInput,
  journal: BatchPlanJournal | null,
): string | undefined {
  if (operation.type === "search_replace") return operation.oldString;
  if (operation.type === "create") return "";
  if (operation.type === "edit") {
    const snapshot = journal?.before[operation.pageId];
    if (snapshot) return jsonContentToMarkdown(snapshot.page.content);
  }
  return undefined;
}
export function proposedMarkdown(
  operation: BatchPlanOperationInput,
  journal: BatchPlanJournal | null,
): string | undefined {
  if (operation.type === "search_replace") return operation.newString;
  if (operation.type === "delete") return undefined;
  if (!journal) return operation.markdown;
  try {
    return jsonContentToMarkdown(plannedContent(operation, journal));
  } catch {
    // 尚未通过正文解析的方案仍展示模型原稿，执行器会进行最终校验。
    return operation.markdown;
  }
}
export function operationTargetPage(
  operation: BatchPlanOperationInput,
  journal: BatchPlanJournal | null,
): Page | undefined {
  const id =
    operation.type === "create"
      ? journal?.createdPageIds[operation.operationId]
      : operation.type === "delete"
        ? operation.pageIds[0]
        : operation.pageId;
  return id
    ? (usePages.getState().pages[id] ?? journal?.before[id]?.page)
    : undefined;
}
export function reviewPagePath(page: Page): string {
  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  if (page.localFilePath) {
    const root = notebook?.localPath?.replace(/\/$/, "");
    const relative =
      root && page.localFilePath.startsWith(`${root}/`)
        ? page.localFilePath.slice(root.length + 1)
        : page.localFilePath;
    return `${notebook?.name ? `${notebook.name} / ` : ""}${relative}`;
  }
  const titles = [getPageTitle(page)];
  const seen = new Set([page.id]);
  let parentId = page.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = usePages.getState().pages[parentId];
    if (!parent) break;
    titles.unshift(getPageTitle(parent));
    parentId = parent.parentId;
  }
  if (notebook?.name) titles.unshift(notebook.name);
  return titles.join(" / ");
}
