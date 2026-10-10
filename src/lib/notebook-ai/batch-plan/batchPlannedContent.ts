import type { BatchPlanInput, BatchPlanJournal } from "./types";
import { useNotebooks } from "@/stores/useNotebooks";
import {
  parseAiMarkdownToBlocks,
  buildAiPageContent,
  normalizeAiMarkdown,
} from "@/lib/notebook-ai/markdown";
import { normalizePageContent } from "@/components/editor/utils/blocknote-content";
import type { JSONContent } from "@/types";
import {
  mergeFullEditPreservingUnchangedBlocks,
  applySearchReplacePreservingBlocks,
} from "./surgicalApply";
import {
  getPageTitle,
  withInternalPageTitle,
} from "@/components/editor/utils/page-title";

export function plannedContent(
  operation: Extract<
    BatchPlanInput["operations"][number],
    { type: "create" | "edit" }
  >,
  journal: BatchPlanJournal,
) {
  if (operation.type === "create") {
    const isLocal =
      useNotebooks.getState().notebooks[journal.notebookId]?.source ===
      "local-folder";
    if (isLocal) {
      const content = parseAiMarkdownToBlocks(operation.markdown);
      return normalizePageContent(content, {
        ensureFirstTitle: false,
      }) as JSONContent;
    }
    return buildAiPageContent(operation.title, operation.markdown);
  }

  // full edit：用块级 merge 保留未改动块的 id / props
  const beforePage = journal.before[operation.pageId].page;
  const beforeContent = beforePage.content;
  const isLocal = Boolean(beforePage.localFilePath);
  if (isLocal) {
    return mergeFullEditPreservingUnchangedBlocks(
      beforeContent,
      normalizeAiMarkdown(operation.markdown),
      { ensureFirstTitle: false },
    ).content;
  }

  const title = operation.title?.trim() || getPageTitle(beforePage) || "无标题";
  const merged = mergeFullEditPreservingUnchangedBlocks(
    beforeContent,
    normalizeAiMarkdown(operation.markdown),
    { ensureFirstTitle: true },
  );
  const blocks = Array.isArray(merged.content)
    ? merged.content
    : (merged.content as { content?: unknown } | null)?.content;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return buildAiPageContent(title, operation.markdown);
  }
  if (operation.title?.trim()) {
    return withInternalPageTitle(merged.content, title);
  }
  return merged.content;
}

export function plannedSearchReplaceContent(
  operation: Extract<
    BatchPlanInput["operations"][number],
    { type: "search_replace" }
  >,
  journal: BatchPlanJournal,
): JSONContent {
  const before = journal.before[operation.pageId];
  const applied = applySearchReplacePreservingBlocks(
    before.page.content,
    operation.oldString,
    operation.newString,
    { replaceAll: operation.replaceAll === true },
  );
  if (!applied.ok) throw new Error(applied.error);
  return applied.content;
}
