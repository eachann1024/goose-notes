import type { Page } from "@/types";
import type { BlockNoteContent } from "@/lib/blocknote-content";
import JSZip from "jszip";
import { extractTitleFromContent } from "@/lib/content-text-extractor";
import { blobToBase64 } from "@/lib/imageStorage/utils";
import {
  normalizePageContent,
  createEmptyBlockNoteContent,
} from "@/lib/blocknote-content";
import { jsonContentToMarkdown } from "./markdown/serialize";
import { importFromMarkdown } from "./markdown/parse";
import type { ImportResult } from "./markdown/parse";
import { saveBlobAndReveal } from "./fileSave";
import { fs } from "@/lib/utools/fs";
import {
  isLocalFilePath,
  resolveToAbsolute,
} from "@/lib/imageStorage/strategies/file-system";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function contentToHTML(content: BlockNoteContent): string {
  return jsonContentToMarkdown(content, true)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("# ")) return `<h1>${escapeHtml(block.slice(2))}</h1>`;
      if (block.startsWith("## ")) return `<h2>${escapeHtml(block.slice(3))}</h2>`;
      if (block.startsWith("### ")) return `<h3>${escapeHtml(block.slice(4))}</h3>`;
      if (block.startsWith("```")) return `<pre><code>${escapeHtml(block.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""))}</code></pre>`;
      return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
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
  const prefix = "../".repeat(depth);
  return `${prefix}assets/${filename}`;
}

function guessExtFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext && ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
    return ext === "jpeg" ? "jpg" : ext;
  return "png";
}

/**
 * 读取本地图片为 base64
 * 支持绝对路径和相对路径（相对于 notebookPath）
 */
async function readLocalImageAsBase64(
  notebookPath: string | undefined,
  src: string,
): Promise<string | null> {
  if (!fs.isAvailable()) return null;
  const gfs = (window as any).gooseFs;
  if (!gfs) return null;

  let fullPath: string;

  if (src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src)) {
    fullPath = src;
  } else if (notebookPath) {
    fullPath = resolveToAbsolute(notebookPath, src);
  } else {
    return null;
  }

  try {
    if (!gfs.exists(fullPath)) return null;
    const data: string | null = gfs.readFile(fullPath, "base64");
    return data || null;
  } catch {
    return null;
  }
}

async function extractImagesFromContent(
  content: any[],
  assetsFolder: JSZip,
  imageMap: Map<string, string>,
  depth: number,
  notebookPath?: string,
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
        const base64Data = await readLocalImageAsBase64(notebookPath, src);
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
      await extractImagesFromContent(block.children, assetsFolder, imageMap, depth, notebookPath);
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
  const zip = new JSZip();
  const { format, notebookIds } = options;
  const assetsFolder = zip.folder("assets");
  const imageMap = new Map<string, string>();

  if (!assetsFolder) return;

  for (const notebookId of notebookIds) {
    const notebook = notebooksMap[notebookId];
    if (!notebook) continue;

    const notebookFolderName = sanitizeFileName(notebook.name);
    const notebookFolder = zip.folder(notebookFolderName);
    if (!notebookFolder) continue;

    const notebookPages = allPages.filter(
      (p) => p.workspaceId === notebookId && !p.trashedAt,
    );

    const pageMap = new Map<string, Page>();
    notebookPages.forEach((p) => pageMap.set(p.id, p));

    const notebookPath = notebook.localPath;

    const processPage = async (
      page: Page,
      parentFolder: JSZip,
      depth: number,
    ) => {
      const pageClone = JSON.parse(JSON.stringify(page)) as Page;
      pageClone.content = normalizeExportContent(pageClone.content);

      await extractImagesFromContent(
        pageClone.content,
        assetsFolder,
        imageMap,
        depth,
        notebookPath,
      );

      let content = "";
      let extension = "";

      switch (format) {
        case "md": {
          const title = extractTitleFromContent(pageClone.content);
          content = `# ${title}\n\n${jsonContentToMarkdown(pageClone.content, true)}`;
          extension = ".md";
          break;
        }
        case "html":
          const html = contentToHTML(pageClone.content);
          const titleForHtml = extractTitleFromContent(pageClone.content);
          content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titleForHtml}</title><style>img { max-width: 100%; }</style></head><body><h1>${titleForHtml}</h1>${html}</body></html>`;
          extension = ".html";
          break;
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
      await processPage(p, notebookFolder, 1);
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
  const zip = await JSZip.loadAsync(zipBlob);
  const assetMap = new Map<string, string>();

  const assetsFolder = zip.folder("assets");
  if (assetsFolder) {
    const assetFiles: string[] = [];
    assetsFolder.forEach((relativePath) => assetFiles.push(relativePath));

    for (const path of assetFiles) {
      const file = assetsFolder.file(path);
      if (file) {
        const base64 = await file.async("base64");
        const ext = path.split(".").pop()?.toLowerCase() || "png";
        const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
        assetMap.set(path, `data:${mimeType};base64,${base64}`);
      }
    }
  }

  const restoreImages = (blocks: any[]) => {
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      if (
        (block.type === "image" || block.type === "imageResize") &&
        block.props?.url
      ) {
        const src = block.props.url as string;
        if (src.includes("assets/")) {
          const filename = src.split("assets/").pop();
          if (filename && assetMap.has(filename)) {
            block.props.url = assetMap.get(filename);
          }
        }
      }
      if (block.children?.length) restoreImages(block.children);
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

    const files: { path: string; depth: number }[] = [];
    zip.forEach((path, entry) => {
      if (!entry.dir && path.startsWith(notebookPathPrefix)) {
        const relativePath = path.slice(notebookPathPrefix.length);
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
          if (pageData.content) restoreImages(pageData.content);
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
        if (pageData.content) restoreImages(pageData.content);
      }

      const newId = onCreatePage(pageData, workspaceId, parentId);
      pathIdMap.set(nameWithoutExt, newId);
    }
  }
}
