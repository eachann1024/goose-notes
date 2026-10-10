import {
  type LocalPageIdMap,
  readLocalPageIdMap,
  resolveOrCreateStableId,
  pruneLocalPageIdMap,
  toRelativePath,
  writeLocalPageIdMap,
} from "@/lib/local-page-idmap";
import type { Page } from "@/types";
import {
  type LocalFolderScannerOptions,
  type LocalFolderEntry,
  SCAN_CPU_SLICE_MS,
  shouldIgnoreEntry,
  readDirectory,
  readMarkdownFile,
  buildFolderPage,
  nowForScanBudget,
  yieldToRenderer,
} from "./local-folder-scanner/entries";
import { buildMarkdownPage } from "./local-folder-scanner/markdown";
export {
  buildLocalPageId,
  shouldIgnoreEntry,
  shouldIgnoreLocalRelativePath,
  localFileTitleFromPath,
} from "./local-folder-scanner/entries";
export {
  parseLocalMarkdownContent,
  type ParsedLocalMarkdown,
} from "./local-folder-scanner/markdown";

export async function scanLocalFolderPages({
  notebookId,
  basePath,
  gooseFs,
  hiddenFolders = [],
}: LocalFolderScannerOptions): Promise<Page[]> {
  // 读取一次映射表，整个扫描过程共享（避免逐文件 IO）。
  const idMap: LocalPageIdMap = readLocalPageIdMap(notebookId);
  let idMapDirty = false;
  // 记录本次扫描实际存在的相对路径，用于扫描结束后剪枝。
  const liveRelativePaths = new Set<string>();
  const hiddenFoldersSet = new Set(hiddenFolders);

  const scanDirectory = async (
    dirPath: string,
    parentId?: string,
  ): Promise<Page[]> => {
    let entries: LocalFolderEntry[];

    try {
      entries = await readDirectory(gooseFs, dirPath);
    } catch (error) {
      console.error("readDir failed", error);
      return [];
    }

    const pages: Page[] = [];

    // 收集待并发处理的文件项（目录仍串行，子树递归需有序）
    interface PendingFileEntry {
      entry: LocalFolderEntry;
      fileId: string;
    }
    const pendingFiles: PendingFileEntry[] = [];

    for (const entry of entries) {
      if (shouldIgnoreEntry(entry.name, hiddenFoldersSet)) continue;

      if (entry.isDirectory) {
        const relativePath = toRelativePath(basePath, entry.path);
        liveRelativePaths.add(relativePath);
        const { id: folderId, dirty } = resolveOrCreateStableId(
          notebookId,
          relativePath,
          idMap,
        );
        if (dirty) idMapDirty = true;

        const folderPage = buildFolderPage(
          notebookId,
          basePath,
          entry,
          parentId,
          folderId,
        );
        pages.push(folderPage);
        const subPages = await scanDirectory(entry.path, folderPage.id);
        pages.push(...subPages);
        continue;
      }

      if (!entry.isFile || !/\.(md|markdown)$/i.test(entry.name)) {
        continue;
      }

      const relativePath = toRelativePath(basePath, entry.path);
      liveRelativePaths.add(relativePath);
      const { id: fileId, dirty } = resolveOrCreateStableId(
        notebookId,
        relativePath,
        idMap,
      );
      if (dirty) idMapDirty = true;

      pendingFiles.push({ entry, fileId });
    }

    // 文件 IO 并发、Markdown 解析串行分片：既避免 EMFILE，也避免多个大文件
    // 在同一个渲染帧里连续解析形成长任务。
    const BATCH_SIZE = 8;
    const now = Date.now();
    for (let i = 0; i < pendingFiles.length; i += BATCH_SIZE) {
      const batch = pendingFiles.slice(i, i + BATCH_SIZE);
      const readResults = await Promise.allSettled(
        batch.map(({ entry }) => readMarkdownFile(gooseFs, entry.path)),
      );

      let sliceStartedAt = nowForScanBudget();
      for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
        const pending = batch[batchIndex];
        const readResult = readResults[batchIndex];
        if (readResult.status === "rejected") {
          console.error(
            "[local-folder-scanner] 跳过文件读取失败:",
            readResult.reason,
          );
          continue;
        }

        try {
          const page = await buildMarkdownPage(
            notebookId,
            basePath,
            pending.entry,
            readResult.value,
            now,
            pending.fileId,
          );
          page.parentId = parentId;
          pages.push(page);
        } catch (error) {
          console.error("[local-folder-scanner] 跳过文件解析失败:", error);
        }

        const hasMoreFiles =
          batchIndex < batch.length - 1 || i + BATCH_SIZE < pendingFiles.length;
        if (
          hasMoreFiles &&
          nowForScanBudget() - sliceStartedAt >= SCAN_CPU_SLICE_MS
        ) {
          await yieldToRenderer();
          sliceStartedAt = nowForScanBudget();
        }
      }
    }

    return pages;
  };

  const pages = await scanDirectory(basePath);

  // 扫描结束后统一处理映射表持久化与剪枝。
  if (idMapDirty) {
    writeLocalPageIdMap(notebookId, idMap);
  }
  pruneLocalPageIdMap(notebookId, liveRelativePaths);

  return pages;
}
