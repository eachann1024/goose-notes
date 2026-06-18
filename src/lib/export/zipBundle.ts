import type { Page } from "@/types";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type JSZipNs from "jszip";
import { extractTitleFromContent } from "@/components/editor/utils/content-text-extractor";
import { blobToBase64 } from "@/lib/imageStorage/utils";
import {
  normalizePageContent,
  createEmptyBlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { blocksToMarkdown, blocksToHTML } from "./blocknoteSerializer";
import { renderExportHtml } from "./index";
import { importFromMarkdown } from "./markdown/parse";
import type { ImportResult } from "./markdown/parse";
import { saveBlobAndReveal } from "./fileSave";
import {
  isLocalFilePath,
  resolveToAbsolute,
  readLocalFileAsBase64,
} from "@/lib/imageStorage/strategies/file-system";

function stripFirstH1(blocks: any[]): any[] {
  if (blocks[0]?.type === "heading" && blocks[0]?.props?.level === 1) {
    return blocks.slice(1);
  }
  return blocks;
}

let imageStoragePromise: Promise<{
  imageStorage: { load: (ref: string) => Promise<Blob | null> };
}> | null = null;

const getImageStorage = async () => {
  if (!imageStoragePromise) {
    imageStoragePromise = import("@/lib/imageStorage");
  }
  return imageStoragePromise;
};

function parseBase64Image(
  src: string,
): { data: string; mimeType: string; extension: string } | null {
  const match = src.match(/^data:(image\/([a-zA-Z+]+));base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    extension: match[2] === "jpeg" ? "jpg" : match[2],
    data: match[3],
  };
}

function getRelativeAssetPath(filename: string, depth: number): string {
  // depth 0 = 笔记本根目录，assets 在同级 → ./assets/
  // depth 1 = 子文件夹内页面 → ../assets/
  const prefix = depth > 0 ? "../".repeat(depth) : "./";
  return `${prefix}assets/${filename}`;
}

function guessExtFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext && ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
    return ext === "jpeg" ? "jpg" : ext;
  return "png";
}

/**
 * 将图片路径解析为绝对路径后，通过 Node.js fs 读取为 base64
 * 优先基于页面文件目录解析（相对路径语义正确），兜底用笔记本根目录
 */
function resolveAndReadBase64(
  notebookPath: string | undefined,
  src: string,
  pageFilePath?: string,
): string | null {
  // 绝对路径直接读取
  if (src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src)) {
    return readLocalFileAsBase64(src);
  }

  // 优先相对于页面文件目录解析
  if (pageFilePath) {
    const pageDir = pageFilePath.replace(/[\\/][^\\/]+$/, '');
    const fullPath = resolveToAbsolute(pageDir, src);
    const result = readLocalFileAsBase64(fullPath);
    if (result) return result;
  }

  // 兜底：相对于笔记本根目录
  if (notebookPath) {
    const fullPath = resolveToAbsolute(notebookPath, src);
    return readLocalFileAsBase64(fullPath);
  }

  return null;
}

async function extractImagesFromContent(
  content: any[],
  assetsFolder: JSZipNs,
  imageMap: Map<string, string>,
  depth: number,
  notebookPath?: string,
  pageFilePath?: string,
) {
  const fallbackBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2NkYGD4DwABBAEAf6S4JwAAAABJRU5ErkJggg==";

  for (const block of content) {
    if (!block || typeof block !== "object") continue;

    if (block.type === "image" && block.props?.url) {
      const src = block.props.url;
      let finalSrc = src;

      // 1) 内部存储引用（uuid: / att:）→ 加载为 blob → base64
      if (src.startsWith("uuid:") || src.startsWith("att:")) {
        const { imageStorage } = await getImageStorage();
        const blob = await imageStorage.load(src);
        if (blob) {
          finalSrc = await blobToBase64(blob);
        } else {
          finalSrc = fallbackBase64;
        }
      }

      // 2) 本地文件路径（相对/绝对）→ 从文件系统读取
      if (isLocalFilePath(src)) {
        if (imageMap.has(src)) {
          block.props.url = getRelativeAssetPath(imageMap.get(src)!, depth);
          continue;
        }
        const base64Data = resolveAndReadBase64(notebookPath, src, pageFilePath);
        if (base64Data) {
          const ext = guessExtFromPath(src);
          // 用原始文件名，避免重名加随机后缀
          const rawName = src.split(/[\\/]/).pop() || `img_${Date.now()}.${ext}`;
          const uniqueName = imageMap.has(rawName)
            ? `${rawName.replace(/\.([^.]+)$/, "")}_${Math.random().toString(36).slice(2, 6)}.${ext}`
            : rawName;
          assetsFolder.file(uniqueName, base64Data, { base64: true });
          imageMap.set(src, uniqueName);
          block.props.url = getRelativeAssetPath(uniqueName, depth);
        }
        continue;
      }

      // 3) 去重：同一个 base64 源只存一次
      if (imageMap.has(finalSrc)) {
        block.props.url = getRelativeAssetPath(imageMap.get(finalSrc)!, depth);
        continue;
      }

      // 4) base64 内联图 → 解析并存入 assets
      if (finalSrc.startsWith("data:image")) {
        const parsed = parseBase64Image(finalSrc);
        if (parsed) {
          const filename = `img_${Math.random().toString(36).slice(2, 9)}_${Date.now()}.${parsed.extension}`;
          assetsFolder.file(filename, parsed.data, { base64: true });

          imageMap.set(finalSrc, filename);
          block.props.url = getRelativeAssetPath(filename, depth);
        }
      }
    }

    if (block.children?.length) {
      await extractImagesFromContent(block.children, assetsFolder, imageMap, depth, notebookPath, pageFilePath);
    }
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

function normalizeExportContent(content: Page["content"]): BlockNoteContent {
  try {
    return normalizePageContent(content);
  } catch (error) {
    console.warn("[export] normalize page content failed:", error);
    return createEmptyBlockNoteContent();
  }
}

export interface ExportOptions {
  format: "md" | "html";
  notebookIds: string[];
}

export async function exportNotebooks(
  options: ExportOptions,
  notebooksMap: Record<string, { name: string; localPath?: string }>,
  allPages: Page[],
) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const { format, notebookIds } = options;

  for (const notebookId of notebookIds) {
    const notebook = notebooksMap[notebookId];
    if (!notebook) continue;

    const notebookFolderName = sanitizeFileName(notebook.name);
    const notebookFolder = zip.folder(notebookFolderName);
    if (!notebookFolder) continue;

    // assets 放在每个笔记本文件夹内部，而非 zip 根目录
    const assetsFolder = notebookFolder.folder("assets");
    if (!assetsFolder) continue;

    // 每个笔记本独立的 imageMap，避免跨笔记本冲突
    const imageMap = new Map<string, string>();

    const notebookPages = allPages.filter(
      (p) => p.workspaceId === notebookId && !p.trashedAt,
    );

    const pageMap = new Map<string, Page>();
    notebookPages.forEach((p) => pageMap.set(p.id, p));

    const notebookPath = notebook.localPath;

    const processPage = async (
      page: Page,
      parentFolder: JSZipNs,
      depth: number,
    ) => {
      const pageClone = structuredClone(page) as Page;
      pageClone.content = normalizeExportContent(pageClone.content);

      await extractImagesFromContent(
        pageClone.content,
        assetsFolder,
        imageMap,
        depth,
        notebookPath,
        page.localFilePath,
      );

      let content = "";
      let extension = "";

      switch (format) {
        case "md": {
          const title = extractTitleFromContent(pageClone.content);
          const blocks = stripFirstH1(pageClone.content as any[]);
          const md = await blocksToMarkdown(blocks as any);
          content = `# ${title}\n\n${md}`;
          extension = ".md";
          break;
        }
        case "html": {
          const titleForHtml = extractTitleFromContent(pageClone.content);
          const blocks = stripFirstH1(pageClone.content as any[]);
          const html = await blocksToHTML(blocks as any);
          content = renderExportHtml(titleForHtml, html);
          extension = ".html";
          break;
        }
      }

      const fileName =
        sanitizeFileName(
          extractTitleFromContent(pageClone.content) || "untitled",
        ) + extension;
      parentFolder.file(fileName, content);

      const children = notebookPages.filter((p) => p.parentId === page.id);
      if (children.length > 0) {
        const subFolderName = sanitizeFileName(
          extractTitleFromContent(page.content) || "untitled",
        );
        const subFolder = parentFolder.folder(subFolderName);
        if (subFolder) {
          for (const child of children) {
            await processPage(child, subFolder, depth + 1);
          }
        }
      }
    };

    const rootPages = notebookPages.filter(
      (p) => !p.parentId || !pageMap.has(p.parentId),
    );

    for (const p of rootPages) {
      await processPage(p, notebookFolder, 0);
    }
  }

  const content = await zip.generateAsync({ type: "blob" });
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
  onCreateNotebook: (name: string) => string,
  onCreatePage: (
    data: Partial<Page>,
    workspaceId: string,
    parentId?: string,
  ) => string,
) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(zipBlob);

  // 收集所有 assets：既查根级 assets/（旧格式），也查各笔记本内 xxx/assets/（新格式）
  const loadAssetsFromFolder = async (folder: JSZipNs | null): Promise<Map<string, string>> => {
    const map = new Map<string, string>();
    if (!folder) return map;
    const files: string[] = [];
    folder.forEach((relativePath) => files.push(relativePath));
    for (const p of files) {
      const file = folder.file(p);
      if (file) {
        const base64 = await file.async("base64");
        const ext = p.split(".").pop()?.toLowerCase() || "png";
        const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
        map.set(p, `data:${mimeType};base64,${base64}`);
      }
    }
    return map;
  };

  // 根级 assets（旧导出格式兼容）
  const rootAssetMap = await loadAssetsFromFolder(zip.folder("assets"));

  const restoreImages = (blocks: any[], notebookAssetMap: Map<string, string>) => {
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      if (
        (block.type === "image" || block.type === "imageResize") &&
        block.props?.url
      ) {
        const src = block.props.url as string;
        if (src.includes("assets/")) {
          const filename = src.split("assets/").pop();
          if (filename) {
            // 优先从笔记本内 assets 查找，再从根级 assets 查找
            const dataUrl = notebookAssetMap.get(filename) || rootAssetMap.get(filename);
            if (dataUrl) {
              block.props.url = dataUrl;
            }
          }
        }
      }
      if (block.children?.length) restoreImages(block.children, notebookAssetMap);
    }
  };

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
          if (pageData.content) restoreImages(pageData.content, notebookAssetMap);
        } catch (e) {
          console.error("Failed to parse JSON page", e);
        }
      } else if (extension === "md") {
        const text = await file.async("text");
        const imported: ImportResult = importFromMarkdown(text, title);
        const content = imported.content;
        const firstBlock = Array.isArray(content) ? content[0] : undefined;
        const hasH1Title =
          firstBlock?.type === "heading" &&
          firstBlock.props?.level === 1 &&
          firstBlock.content === imported.title;
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
        if (pageData.content) restoreImages(pageData.content, notebookAssetMap);
      }

      const newId = onCreatePage(pageData, workspaceId, parentId);
      pathIdMap.set(nameWithoutExt, newId);
    }
  }
}
