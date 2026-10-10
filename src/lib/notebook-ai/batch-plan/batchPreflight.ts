import type { BatchPlanJournal } from "./types";
import {
  guardNotebookForAiWrite,
  guardPageForAiWrite,
} from "@/lib/notebook-ai/pageWriteGuard";
import { usePages } from "@/stores/usePages";
import { pendingOperations } from "./batchShared";
import { pageAtLocalPath, pathExists, comparisonPath } from "./batchPaths";
import { expandDeletePageIds } from "./batchValidation";

export async function preflight(
  journal: BatchPlanJournal,
): Promise<string | null> {
  const notebook = guardNotebookForAiWrite(journal.notebookId);
  if (!notebook.ok) return notebook.error;
  const pageIds = new Set<string>();
  for (const operation of pendingOperations(journal)) {
    const plannedLocalPath = journal.plannedLocalPaths[operation.operationId];
    if (operation.type === "create" && plannedLocalPath) {
      if (
        pageAtLocalPath(plannedLocalPath) ||
        (await pathExists(plannedLocalPath))
      ) {
        return "本地新建目标在审批后已被占用";
      }
    }
    if (operation.type === "create" && operation.parentId) {
      const parent = usePages.getState().pages[operation.parentId];
      if (
        !parent ||
        parent.workspaceId !== journal.notebookId ||
        Boolean(parent.trashedAt)
      ) {
        return "新页面的父级在审批后发生变化";
      }
    }
    if (operation.type === "edit" || operation.type === "search_replace") {
      pageIds.add(operation.pageId);
    }
    if (operation.type === "delete") {
      const frozenPageIds =
        journal.affectedPageIdsByOperationId[operation.operationId] ??
        operation.pageIds;
      const currentPageIds = expandDeletePageIds(
        journal.notebookId,
        operation.pageIds,
      );
      if (
        frozenPageIds.length !== currentPageIds.length ||
        frozenPageIds.some((pageId) => !currentPageIds.includes(pageId))
      ) {
        return "删除目标的页面树在审批后发生变化";
      }
      frozenPageIds.forEach((pageId) => pageIds.add(pageId));
    }
  }
  for (const pageId of pageIds) {
    const snapshot = journal.before[pageId];
    if (!snapshot) return "冻结计划缺少目标页面快照";
    const guard = guardPageForAiWrite(pageId, {
      expectedNotebookId: journal.notebookId,
      expectedRevision: snapshot.revision,
    });
    if (!guard.ok) return guard.error;
    const beforePath = snapshot.page.localFilePath;
    if (
      beforePath &&
      comparisonPath(guard.page.localFilePath ?? "") !==
        comparisonPath(beforePath)
    ) {
      return "本地文件路径在审批后发生变化";
    }
    const operation = pendingOperations(journal).find(
      (candidate) => candidate.type === "edit" && candidate.pageId === pageId,
    );
    const targetPath = operation
      ? journal.plannedLocalPaths[operation.operationId]
      : undefined;
    if (
      targetPath &&
      comparisonPath(targetPath) !== comparisonPath(beforePath ?? "") &&
      (pageAtLocalPath(targetPath) || (await pathExists(targetPath)))
    ) {
      return "本地重命名目标在审批后已被占用";
    }
    const trashPath = journal.localTrashPathsByPageId[pageId];
    if (
      trashPath &&
      (pageAtLocalPath(trashPath) || (await pathExists(trashPath)))
    ) {
      return "本地删除暂存目标在审批后已被占用";
    }
  }
  return null;
}
