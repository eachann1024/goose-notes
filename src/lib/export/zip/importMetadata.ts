import type JSZipNs from "jszip";
import { sanitizeFileName } from "./assetPaths";
import { loadAssetsFromFolder } from "./importAssets";
import { restoreImportedHistory } from "./importHistory";
import type { NotebookImportCallbacks, BundledAssetRestorer } from "./types";

export async function importMetadataZip(
  zip: JSZipNs,
  metaFile: { async(type: "text"): Promise<string> },
  callbacks: NotebookImportCallbacks,
  restoreBundledAssets: BundledAssetRestorer,
) {
  const { onCreateNotebook, onCreatePage } = callbacks;
    let meta: any;
    try {
      const metaText = await metaFile.async("text");
      meta = JSON.parse(metaText);
    } catch (error) {
      throw new Error("备份元数据已损坏，已停止导入", { cause: error });
    }

    if (!meta || !Array.isArray(meta.notebooks) || !Array.isArray(meta.pages)) {
      throw new Error("备份元数据格式无效，已停止导入");
    }

    // 在产生任何 store 副作用前先把资源完整读入内存。此后若创建回调失败，
    // 异常必须向外传播给 SettingsDialog 的回滚流程，禁止再回退目录解析造成重复数据。
    const notebookAssetMaps = new Map<string, Map<string, string>>();
    for (const nb of meta.notebooks) {
      const assetMap = await loadAssetsFromFolder(
        zip.folder(`${sanitizeFileName(nb.name)}/assets`),
      );
      notebookAssetMaps.set(nb.id, assetMap);
    }

    for (const nb of meta.notebooks) {
      onCreateNotebook(nb.name, nb.icon || "BookOpen", nb.id);
    }

    const importedPageIdMap = new Map<string, string>();

    for (const page of meta.pages) {
      const pageData = { ...page };
      const sourcePageId = typeof page.id === "string" ? page.id : null;
      delete (pageData as any).localFilePath;
      const assetMap = notebookAssetMaps.get(page.workspaceId);
      if (pageData.content && assetMap) {
        restoreBundledAssets(pageData.content, assetMap);
      }
      const createdPageId = await onCreatePage(
        pageData,
        page.workspaceId,
        page.parentId,
        page.id,
      );
      if (sourcePageId) {
        importedPageIdMap.set(sourcePageId, createdPageId);
      }
    }

    await restoreImportedHistory(meta.history, importedPageIdMap);

}
