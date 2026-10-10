import type { Page } from "@/types";
import { saveBlobAndReveal } from "./fileSave";
import { generateExportZip } from "./zip/generateNotebookZip";
import { loadAssetsFromFolder, createBundledAssetRestorer } from "./zip/importAssets";
import { importMetadataZip } from "./zip/importMetadata";
import { importFolderZip } from "./zip/importFolderZip";
import type { ExportOptions } from "./zip/types";
export type { ExportOptions, NotebookImportInspection } from "./zip/types";
export { generateExportZip } from "./zip/generateNotebookZip";
export { extractImagesFromContent } from "./zip/extractAssets";
export { inspectNotebookImportZip } from "./zip/inspectImport";

export async function exportNotebooks(
  options: ExportOptions,
  notebooksMap: Record<string, { name: string; localPath?: string }>,
  allPages: Page[],
) {
  const content = await generateExportZip(options, notebooksMap, allPages);
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  await downloadBlob(content, `goose-note-export-${timestamp}.zip`);
}

async function downloadBlob(blob: Blob, filename: string) {
  try {
    const saved = await saveBlobAndReveal(blob, filename);
    if (saved) return;
  } catch (error) {
    console.error("[export] saveBlobAndReveal 失败，尝试浏览器下载:", error);
  }

  if (triggerBrowserDownload(blob, filename)) return;

  throw new Error("导出失败：无法保存文件");
}

function triggerBrowserDownload(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    requestAnimationFrame(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    return true;
  } catch {
    return false;
  }
}

export async function importNotebooksFromZip(
  zipBlob: Blob,
  onCreateNotebook: (name: string, icon?: string, id?: string) => string,
  onCreatePage: (
    data: Partial<Page>,
    workspaceId: string,
    parentId?: string,
    id?: string,
  ) => string | Promise<string>,
) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(zipBlob);

  const rootAssetMap = await loadAssetsFromFolder(zip.folder("assets"));
  const restoreBundledAssets = createBundledAssetRestorer(rootAssetMap);
  const callbacks = { onCreateNotebook, onCreatePage };
  const metaFile = zip.file("backup-metadata.json");
  if (metaFile) {
    await importMetadataZip(zip, metaFile, callbacks, restoreBundledAssets);
    return;
  }
  await importFolderZip(zip, callbacks, restoreBundledAssets);
}
