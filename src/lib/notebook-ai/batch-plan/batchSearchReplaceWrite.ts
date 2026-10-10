import type { BatchPlanInput, BatchPlanJournal } from "./types";
import { usePages } from "@/stores/usePages";
import { applySearchReplacePreservingBlocks } from "./surgicalApply";
import { writePageContentSafely } from "@/lib/notebook-ai/pageWriteGuard";
import { revisionOf } from "./batchShared";

export async function writeSearchReplaceFromLatest(
  operation: Extract<
    BatchPlanInput["operations"][number],
    { type: "search_replace" }
  >,
  working: BatchPlanJournal,
) {
  const before = working.before[operation.pageId];
  if (!before) throw new Error("冻结计划缺少目标页面快照");

  const attempt = async () => {
    const livePage = usePages.getState().pages[operation.pageId];
    if (!livePage) throw new Error("目标页不存在");
    const alreadyWrote = Boolean(working.after[operation.pageId]);
    // 同页后续项必须基于当前正文和当前修订，不能再用批准瞬间的旧快照。
    const baseContent = alreadyWrote ? livePage.content : before.page.content;
    const expectedRevision = alreadyWrote
      ? revisionOf(livePage)
      : before.revision;
    const applied = applySearchReplacePreservingBlocks(
      baseContent,
      operation.oldString,
      operation.newString,
      { replaceAll: operation.replaceAll === true },
    );
    if (!applied.ok) throw new Error(applied.error);
    const saved = await writePageContentSafely(
      operation.pageId,
      applied.content,
      {
        expectedNotebookId: working.notebookId,
        expectedRevision,
      },
    );
    return saved;
  };

  let saved = await attempt();
  if (
    !saved.ok &&
    saved.code === "page-changed" &&
    working.after[operation.pageId]
  ) {
    saved = await attempt();
  }
  if (!saved.ok) throw new Error(saved.error);
}
