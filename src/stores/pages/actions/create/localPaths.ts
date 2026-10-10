import { useNotebooks } from "../../../useNotebooks";
import { v4 as uuidv4 } from "uuid";
import {
  toRelativePath,
  readLocalPageIdMap,
  resolveOrCreateStableId,
  writeLocalPageIdMap,
} from "@/lib/local-page-idmap";
import type { StoreGet } from "../hydrate";
import { UNTITLED_PAGE_TITLE } from "@/components/editor/utils/page-title";

export function generateLocalPageId(
  notebookId: string,
  filePath: string,
): string {
  const notebook = useNotebooks.getState().notebooks[notebookId];
  if (!notebook?.localPath) return uuidv4();
  const basePath = notebook.localPath;
  const relativePath = toRelativePath(basePath, filePath);
  const map = readLocalPageIdMap(notebookId);
  const { id, dirty } = resolveOrCreateStableId(notebookId, relativePath, map);
  if (dirty) {
    writeLocalPageIdMap(notebookId, map);
  }
  return id;
}

export async function allocateLocalMarkdownFilePath(
  get: StoreGet,
  workspaceId: string,
  parentId: string | undefined,
  title: string | undefined,
  requestedFilePath?: string,
): Promise<string | null> {
  const notebook = useNotebooks.getState().notebooks[workspaceId];
  if (
    !notebook?.localPath ||
    typeof window === "undefined" ||
    !window.gooseFs
  ) {
    return null;
  }

  const resolveParentPath = () => {
    if (!parentId) return null;
    const parentPage = get().pages[parentId];
    if (parentPage?.localFilePath) return parentPage.localFilePath;
    const prefix = `local-${workspaceId}-`;
    if (!parentId.startsWith(prefix)) return null;
    const encoded = parentId.slice(prefix.length);
    try {
      const relativePath = decodeURIComponent(encoded);
      return `${notebook.localPath}/${relativePath}`;
    } catch {
      return null;
    }
  };

  const localPath = notebook.localPath;
  const normalizedTitle = (
    (title || UNTITLED_PAGE_TITLE).trim() || UNTITLED_PAGE_TITLE
  ).replace(/[\\/:*?"<>|]/g, "_");
  const parentPath = resolveParentPath();
  const parentPage = parentId ? get().pages[parentId] : undefined;
  const baseDir = parentPath
    ? parentPage?.isFolder
      ? parentPath
      : parentPath.replace(/[^\/\\]+$/, "")
    : localPath;
  const normalizedBaseDir = baseDir.replace(/[\/\\]$/, "");

  const checkExists = async (path: string) => {
    if (window.gooseFs?.existsAsync) {
      return await window.gooseFs.existsAsync(path);
    }
    return window.gooseFs?.exists(path) ?? false;
  };

  const isPathInsideNotebookRoot = (candidate: string) => {
    const root = localPath.replace(/\\/g, "/").replace(/\/$/, "");
    const normalized = candidate.replace(/\\/g, "/");
    return normalized === root || normalized.startsWith(`${root}/`);
  };

  if (requestedFilePath) {
    if (!isPathInsideNotebookRoot(requestedFilePath)) return null;
    if (await checkExists(requestedFilePath)) return null;
    return requestedFilePath;
  }

  let filePath = `${normalizedBaseDir}/${normalizedTitle}.md`;
  if (await checkExists(filePath)) {
    let suffix = 1;
    while (
      await checkExists(
        `${normalizedBaseDir}/${normalizedTitle} (${suffix}).md`,
      )
    ) {
      suffix++;
    }
    filePath = `${normalizedBaseDir}/${normalizedTitle} (${suffix}).md`;
  }
  return filePath;
}
