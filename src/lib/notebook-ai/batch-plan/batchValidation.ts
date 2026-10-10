import type {
  BatchPlanInput,
  BatchPlanJournal,
  BatchPlanOperationInput,
} from "./types";
import { usePages } from "@/stores/usePages";
import { jsonContentToMarkdown } from "@/lib/export/markdown/serialize";
import { tryConvertEditToSearchReplace } from "./editToSearchReplace";
import { clone } from "./batchShared";

export function validateInput(input: BatchPlanInput): string | null {
  if (!input.title.trim() || !input.summary.trim())
    return "计划标题和摘要不能为空";
  if (input.operations.length < 1 || input.operations.length > 50)
    return "计划操作数必须在 1 到 50 之间";
  const ids = new Set<string>();
  /** pageId → 首次占用该页的操作类型；允许多个 search_replace 串联同一页。 */
  const pageMode = new Map<string, "edit" | "search_replace" | "delete">();
  for (const operation of input.operations) {
    if (!operation.operationId.trim() || ids.has(operation.operationId))
      return "operationId 必须唯一且不能为空";
    ids.add(operation.operationId);
    if (
      operation.type === "create" &&
      (!operation.title.trim() || !operation.markdown.trim())
    )
      return "创建操作缺少标题或完整正文";
    if (operation.type === "edit") {
      if (!operation.pageId || !operation.markdown.trim())
        return "编辑操作缺少页面或完整正文";
      const existing = pageMode.get(operation.pageId);
      if (existing)
        return "同一页面不能在一个计划中同时使用 edit 与其他写入/删除";
      pageMode.set(operation.pageId, "edit");
    }
    if (operation.type === "search_replace") {
      if (!operation.pageId || !operation.oldString)
        return "局部替换操作缺少页面或 oldString";
      const existing = pageMode.get(operation.pageId);
      if (existing && existing !== "search_replace")
        return "同一页面不能在一个计划中混合 search_replace 与 edit/delete";
      pageMode.set(operation.pageId, "search_replace");
    }
    if (operation.type === "delete") {
      if (!operation.pageIds.length) return "删除操作至少需要一个页面";
      for (const pageId of operation.pageIds) {
        if (!pageId) return "删除操作至少需要一个页面";
        const existing = pageMode.get(pageId);
        if (existing) return "同一页面不能在一个计划中重复编辑或删除";
        pageMode.set(pageId, "delete");
      }
    }
  }
  return null;
}

export function invalidJournal(
  toolCallId: string,
  runId: string,
  notebookId: string,
  input: BatchPlanInput,
  error: string,
): BatchPlanJournal {
  const now = Date.now();
  return {
    version: 1,
    toolCallId,
    runId,
    notebookId,
    input: clone(input),
    selectedOperationIds: [],
    status: "invalid",
    before: {},
    affectedPageIdsByOperationId: {},
    deleteBatchIdsByOperationId: {},
    plannedPageIds: {},
    plannedLocalPaths: {},
    localPathAfterByPageId: {},
    localTrashPathsByPageId: {},
    after: {},
    createdPageIds: {},
    results: [],
    error,
    createdAt: now,
    updatedAt: now,
  };
}

export function expandDeletePageIds(
  notebookId: string,
  rootIds: string[],
): string[] {
  const pages = usePages.getState().pages;
  const expanded = new Set<string>();
  const stack = [...rootIds];
  while (stack.length) {
    const pageId = stack.pop()!;
    if (expanded.has(pageId)) continue;
    const page = pages[pageId];
    if (!page || page.workspaceId !== notebookId || page.trashedAt) continue;
    expanded.add(pageId);
    Object.values(pages).forEach((candidate) => {
      if (
        candidate.workspaceId === notebookId &&
        !candidate.trashedAt &&
        candidate.parentId === pageId
      )
        stack.push(candidate.id);
    });
  }
  return [...expanded];
}

/**
 * 误用整页 edit 做局部修改时，在 prepare 阶段拆成 search_replace，
 * 以保留未改动块的 id/props。带 title 的 edit 不转换（标题+正文保持原子）。
 */
export function convertPartialEditsInPlan(
  input: BatchPlanInput,
  notebookId: string,
): BatchPlanInput {
  const pages = usePages.getState().pages;
  const nextOps: BatchPlanOperationInput[] = [];
  let changed = false;

  for (let index = 0; index < input.operations.length; index += 1) {
    const operation = input.operations[index]!;
    if (operation.type !== "edit") {
      nextOps.push(operation);
      continue;
    }
    // 改标题时保持 edit，避免 title 与 body 拆开
    if (operation.title?.trim()) {
      nextOps.push(operation);
      continue;
    }

    const page = pages[operation.pageId];
    if (!page || page.workspaceId !== notebookId || Boolean(page.trashedAt)) {
      nextOps.push(operation);
      continue;
    }

    const oldMarkdown = jsonContentToMarkdown(page.content as any);
    const converted = tryConvertEditToSearchReplace({
      pageId: operation.pageId,
      oldMarkdown,
      newMarkdown: operation.markdown,
      baseOperationId: operation.operationId,
    });

    if (!converted || converted.length === 0) {
      nextOps.push(operation);
      continue;
    }

    // 保守上限：后续原操作按 1:1 计；任一步超 50 则保留该条 edit
    const remainingAfter = input.operations.length - index - 1;
    const totalIfConvert = nextOps.length + converted.length + remainingAfter;
    if (totalIfConvert > 50) {
      nextOps.push(operation);
      continue;
    }

    nextOps.push(...converted);
    changed = true;
  }

  if (!changed) return input;
  // 若多次扩展后仍超上限，整体回退
  if (nextOps.length > 50) return input;
  const candidate: BatchPlanInput = {
    ...input,
    operations: nextOps,
  };
  // 转换后必须仍能通过 pageMode / 唯一 id 校验，否则回退原计划
  if (validateInput(candidate)) return input;
  return candidate;
}
