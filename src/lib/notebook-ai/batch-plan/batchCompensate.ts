import type { BatchPlanJournal } from "./types";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { writePageContentSafely } from "@/lib/notebook-ai/pageWriteGuard";
import { reloadEditorIfActive } from "@/lib/notebook-ai/liveWriter";
import { sameRevision, revisionOf, clone } from "./batchShared";
import { restoreLocalDelete } from "./batchLocalDelete";
import { comparisonPath, basenameWithoutMarkdownExtension } from "./batchPaths";

export async function compensate(journal: BatchPlanJournal): Promise<string[]> {
  const errors: string[] = [];
  const restoredContentPages = new Set<string>();
  for (const result of [...journal.results].reverse()) {
    if (!result.ok) continue;
    if (result.type === "create") {
      const pageId = journal.createdPageIds[result.operationId];
      const page = pageId ? usePages.getState().pages[pageId] : undefined;
      const after = pageId ? journal.after[pageId] : undefined;
      if (pageId && page && after && sameRevision(revisionOf(page), after)) {
        const deleted = await usePages.getState().deletePage(pageId);
        if (deleted) useTabs.getState().removeDeletedPage(pageId);
        else errors.push(`无法撤回新建页面 ${pageId}`);
      } else if (pageId) {
        errors.push(`新建页面 ${pageId} 已变化，未撤回`);
      }
      continue;
    }
    if (result.type === "delete") {
      const localSnapshots = result.pageIds.flatMap((pageId) => {
        const snapshot = journal.before[pageId];
        return snapshot?.page.localFilePath ? [snapshot] : [];
      });
      if (localSnapshots.length > 0) {
        errors.push(...(await restoreLocalDelete(localSnapshots, journal)));
        continue;
      }
      for (const pageId of result.pageIds) {
        const page = usePages.getState().pages[pageId];
        const after = journal.after[pageId];
        if (page?.trashedAt && after && sameRevision(revisionOf(page), after)) {
          const restored = usePages.getState().restorePage(pageId);
          if (!restored.ok) errors.push(`无法恢复页面 ${pageId}`);
        } else if (page?.trashedAt) {
          errors.push(`垃圾箱页面 ${pageId} 已变化，未恢复`);
        }
      }
      continue;
    }
    for (const pageId of result.pageIds) {
      if (restoredContentPages.has(pageId)) continue;
      const snapshot = journal.before[pageId];
      const after = journal.after[pageId];
      if (snapshot && after) {
        restoredContentPages.add(pageId);
        const restored = await writePageContentSafely(
          pageId,
          clone(snapshot.page.content),
          {
            expectedNotebookId: journal.notebookId,
            expectedRevision: after,
          },
        );
        if (restored.ok) reloadEditorIfActive(pageId);
        else errors.push(restored.error);
        const originalPath = snapshot.page.localFilePath;
        const currentPath = usePages.getState().pages[pageId]?.localFilePath;
        if (
          restored.ok &&
          originalPath &&
          currentPath &&
          comparisonPath(originalPath) !== comparisonPath(currentPath)
        ) {
          try {
            const restoredPageId = await usePages
              .getState()
              .renameLocalPageFile(
                pageId,
                basenameWithoutMarkdownExtension(originalPath),
              );
            const restoredPath =
              usePages.getState().pages[restoredPageId]?.localFilePath;
            if (
              !restoredPath ||
              comparisonPath(restoredPath) !== comparisonPath(originalPath)
            ) {
              errors.push(`无法恢复页面 ${pageId} 的原文件名`);
            }
          } catch (error) {
            errors.push(
              error instanceof Error
                ? error.message
                : `无法恢复页面 ${pageId} 的原文件名`,
            );
          }
        }
      }
    }
  }
  return errors;
}
