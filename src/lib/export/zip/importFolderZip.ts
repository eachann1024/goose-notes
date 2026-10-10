import type { Page } from "@/types";
import type JSZipNs from "jszip";
import { importFromMarkdown, type ImportResult } from "../markdown/parse";
import { loadAssetsFromFolder } from "./importAssets";
import type { NotebookImportCallbacks, BundledAssetRestorer } from "./types";

export async function importFolderZip(zip: JSZipNs, callbacks: NotebookImportCallbacks, restoreBundledAssets: BundledAssetRestorer) {
  const { onCreateNotebook, onCreatePage } = callbacks;
  const topLevelEntries = new Set<string>();
  zip.forEach((path) => {
    const parts = path.split("/");
    if (parts.length > 1 && parts[0] !== "assets") {
      topLevelEntries.add(parts[0]);
    }
  });

  for (const notebookName of topLevelEntries) {
    const workspaceId = onCreateNotebook(notebookName);
    const notebookPathPrefix = `${notebookName}/`;
    const pathIdMap = new Map<string, string>();

    // 加载笔记本内的 assets（新格式）
    const notebookAssetMap = await loadAssetsFromFolder(
      zip.folder(`${notebookName}/assets`),
    );

    const files: { path: string; depth: number }[] = [];
    zip.forEach((path, entry) => {
      if (!entry.dir && path.startsWith(notebookPathPrefix)) {
        const relativePath = path.slice(notebookPathPrefix.length);
        // 跳过 assets 目录下的文件（图片，不是页面）
        if (relativePath.startsWith("assets/")) return;
        files.push({
          path: relativePath,
          depth: relativePath.split("/").length,
        });
      }
    });
    files.sort((a, b) => a.depth - b.depth);

    for (const { path: relativePath } of files) {
      const file = zip.file(`${notebookPathPrefix}${relativePath}`);
      if (!file) continue;

      const extension = relativePath.split(".").pop()?.toLowerCase();
      const nameWithoutExt = relativePath.replace(/\.[^/.]+$/, "");
      const pathParts = nameWithoutExt.split("/");
      const title = pathParts[pathParts.length - 1];

      let parentId: string | undefined;
      if (pathParts.length > 1) {
        const parentPath = pathParts.slice(0, -1).join("/");
        parentId = pathIdMap.get(parentPath);
      }

      let pageData: Partial<Page> = {};

      if (extension === "json") {
        const text = await file.async("text");
        try {
          const imported = JSON.parse(text) as Page;
          pageData = { ...imported };
          delete (pageData as any).id;
          delete (pageData as any).workspaceId;
          delete (pageData as any).parentId;
          if (pageData.content)
            restoreBundledAssets(pageData.content, notebookAssetMap);
        } catch (e) {
          console.error("Failed to parse JSON page", e);
        }
      } else if (extension === "md") {
        const text = await file.async("text");
        const imported: ImportResult = importFromMarkdown(text, title);
        const content = imported.content;
        const firstBlock = Array.isArray(content) ? content[0] : undefined;
        const hasH1Title =
          firstBlock?.type === "heading" && firstBlock.props?.level === 1;
        if (!hasH1Title) {
          const blocks = Array.isArray(content) ? content : [];
          pageData = {
            content: [
              { type: "heading", props: { level: 1 }, content: imported.title },
              ...blocks,
            ],
          };
        } else {
          pageData = { content };
        }
        if (pageData.content)
          restoreBundledAssets(pageData.content, notebookAssetMap);
      }

      const newId = await onCreatePage(pageData, workspaceId, parentId);
      pathIdMap.set(nameWithoutExt, newId);
    }
  }
}
