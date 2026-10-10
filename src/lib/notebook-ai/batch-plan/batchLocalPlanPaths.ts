import type { BatchPlanInput } from "./types";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { v4 as uuidv4 } from "uuid";
import {
  normalizePath,
  dirname,
  assertLocalPathInsideRoot,
  allocatePlannedLocalPath,
  markdownExtension,
} from "./batchPaths";
import { expandDeletePageIds } from "./batchValidation";

export async function makeLocalPlanPaths(
  notebookId: string,
  input: BatchPlanInput,
): Promise<{
  plannedLocalPaths: Record<string, string>;
  localTrashPathsByPageId: Record<string, string>;
  deleteBatchIdsByOperationId: Record<string, string>;
}> {
  const notebook = useNotebooks.getState().notebooks[notebookId];
  if (notebook?.source !== "local-folder") {
    return {
      plannedLocalPaths: {},
      localTrashPathsByPageId: {},
      deleteBatchIdsByOperationId: {},
    };
  }
  if (!notebook.localPath) {
    throw new Error("本地文件系统不可用");
  }
  const requiresFileOperation = input.operations.some(
    (operation) =>
      operation.type === "create" ||
      operation.type === "delete" ||
      (operation.type === "edit" && Boolean(operation.title?.trim())),
  );
  if (
    requiresFileOperation &&
    (typeof window === "undefined" || !window.gooseFs)
  ) {
    throw new Error("本地文件系统不可用");
  }

  const root = normalizePath(notebook.localPath);
  const reserved = new Set<string>();
  const plannedLocalPaths: Record<string, string> = {};
  const localTrashPathsByPageId: Record<string, string> = {};
  const deleteBatchIdsByOperationId: Record<string, string> = {};

  for (const operation of input.operations) {
    if (operation.type === "create") {
      const parent = operation.parentId
        ? usePages.getState().pages[operation.parentId]
        : undefined;
      const directory = parent?.localFilePath
        ? parent.isFolder
          ? parent.localFilePath
          : dirname(parent.localFilePath)
        : root;
      await assertLocalPathInsideRoot(
        `${normalizePath(directory)}/placeholder.md`,
        root,
        { targetMayNotExist: true },
      );
      plannedLocalPaths[operation.operationId] = await allocatePlannedLocalPath(
        {
          directory,
          title: operation.title,
          reserved,
        },
      );
      continue;
    }

    if (operation.type === "edit") {
      const page = usePages.getState().pages[operation.pageId];
      if (!page?.localFilePath) continue;
      await assertLocalPathInsideRoot(page.localFilePath, root);
      if (operation.title?.trim()) {
        plannedLocalPaths[operation.operationId] =
          await allocatePlannedLocalPath({
            directory: dirname(page.localFilePath),
            title: operation.title,
            extension: markdownExtension(page.localFilePath),
            currentPath: page.localFilePath,
            reserved,
          });
      }
      continue;
    }

    if (operation.type === "search_replace") {
      const page = usePages.getState().pages[operation.pageId];
      if (page?.localFilePath) {
        await assertLocalPathInsideRoot(page.localFilePath, root);
      }
      continue;
    }

    if (operation.type !== "delete") continue;

    const deleteBatchId = `ai-batch-${operation.operationId}-${uuidv4()}`;
    deleteBatchIdsByOperationId[operation.operationId] = deleteBatchId;
    for (const pageId of expandDeletePageIds(notebookId, operation.pageIds)) {
      const page = usePages.getState().pages[pageId];
      if (!page?.localFilePath) continue;
      await assertLocalPathInsideRoot(page.localFilePath, root);
      const relativePath = normalizePath(page.localFilePath)
        .slice(root.length)
        .replace(/^\//, "");
      localTrashPathsByPageId[pageId] = normalizePath(
        `${root}/.goose/ai-batch-trash/${deleteBatchId}/${relativePath}`,
      );
    }
  }

  return {
    plannedLocalPaths,
    localTrashPathsByPageId,
    deleteBatchIdsByOperationId,
  };
}
