import type { Page, JSONContent } from "@/types";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import JSZip from "jszip";
import { extractTitleFromContent } from "./content-text-extractor";
import { blobToBase64 } from "./imageStorage/utils";

const extensions = [StarterKit, Link, TaskList, TaskItem, Image, Highlight];

let imageStoragePromise: Promise<{
  imageStorage: { load: (ref: string) => Promise<Blob | null> };
}> | null = null;

const getImageStorage = async () => {
  if (!imageStoragePromise) {
    imageStoragePromise = import("./imageStorage");
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

function getAlignFromContainerStyle(
  style: string | null | undefined,
): "left" | "center" | "right" | null {
  if (!style) return null;
  if (
    style.includes("margin: 0 0 0 auto") ||
    style.includes("margin: 0px 0px 0px auto")
  )
    return "right";
  if (
    style.includes("margin: 0 auto 0 0") ||
    style.includes("margin: 0px auto 0px 0px")
  )
    return "left";
  if (style.includes("margin: 0 auto") || style.includes("margin: 0px auto"))
    return "center";
  return null;
}

function alignToContainerStyle(align: "left" | "center" | "right"): string {
  const marginMap = {
    left: "margin: 0 auto 0 0;",
    center: "margin: 0 auto;",
    right: "margin: 0 0 0 auto;",
  };
  return marginMap[align];
}

async function extractImagesFromContent(
  content: JSONContent,
  assetsFolder: JSZip,
  imageMap: Map<string, string>,
  depth: number,
) {
  const fallbackBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2NkYGD4DwABBAEAf6S4JwAAAABJRU5ErkJggg==";
  if (!content.content) return;

  for (const node of content.content) {
    if (
      (node.type === "image" || node.type === "imageResize") &&
      node.attrs?.src
    ) {
      const src = node.attrs.src;
      let finalSrc = src;

      // 处理 uuid: 引用（IndexedDB）或 att: 引用（uTools attachment）
      if (src.startsWith("uuid:") || src.startsWith("att:")) {
        const { imageStorage } = await getImageStorage();
        const blob = await imageStorage.load(src);
        if (blob) {
          finalSrc = await blobToBase64(blob);
        } else {
          // 防止导出残留引用
          finalSrc = fallbackBase64;
        }
      }

      // 处理 ./assets/ 引用（uTools 本地文件）
      if (src.startsWith("./assets/") && (window as any).gooseFs) {
        // 需要获取笔记本路径，这里暂时跳过
        // 因为导出时可能没有上下文信息
      }

      // 检查是否已经处理过这个图片
      if (imageMap.has(finalSrc)) {
        node.attrs.src = getRelativeAssetPath(imageMap.get(finalSrc)!, depth);
        continue;
      }

      // 处理 base64 图片
      if (finalSrc.startsWith("data:image")) {
        const parsed = parseBase64Image(finalSrc);
        if (parsed) {
          const filename = `img_${Math.random().toString(36).slice(2, 9)}_${Date.now()}.${parsed.extension}`;
          assetsFolder.file(filename, parsed.data, { base64: true });

          imageMap.set(finalSrc, filename);
          node.attrs.src = getRelativeAssetPath(filename, depth);
        }
      }
    }

    if (node.content) {
      await extractImagesFromContent(node, assetsFolder, imageMap, depth);
    }
  }
}

function getRelativeAssetPath(filename: string, depth: number): string {
  const prefix = "../".repeat(depth);
  return `${prefix}assets/${filename}`;
}

export function exportToJSON(page: Page) {
  const data = JSON.stringify(page, null, 2);
  const title = extractTitleFromContent(page.content);
  downloadFile(data, `${title || "untitled"}.json`, "application/json");
}

export function exportToMarkdown(page: Page) {
  const content = page.content as JSONContent;
  const markdown = jsonContentToMarkdown(content, true);
  const title = extractTitleFromContent(page.content);
  const fullMarkdown = `# ${title}\n\n${markdown}`;
  downloadFile(fullMarkdown, `${title || "untitled"}.md`, "text/markdown");
}

export function exportToHTML(page: Page) {
  const html = generateHTML(page.content, extensions);
  const title = extractTitleFromContent(page.content);
  const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
img { max-width: 100%; height: auto; }
blockquote { border-left: 3px solid #ccc; padding-left: 1rem; color: #666; }
code { background: #eee; padding: 0.2rem 0.4rem; border-radius: 3px; }
pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
</style>
</head>
<body>
<h1>${title}</h1>
${html}
</body>
</html>`;

  downloadFile(fullHtml, `${title || "untitled"}.html`, "text/html");
}

export interface ExportOptions {
  format: "md" | "html";
  notebookIds: string[];
}

export async function exportNotebooks(
  options: ExportOptions,
  notebooksMap: Record<string, { name: string }>,
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

    const processPage = async (
      page: Page,
      parentFolder: JSZip,
      depth: number,
    ) => {
      const pageClone = JSON.parse(JSON.stringify(page)) as Page;

      await extractImagesFromContent(
        pageClone.content,
        assetsFolder,
        imageMap,
        depth,
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
          const html = generateHTML(pageClone.content, extensions);
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

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

function getParentDirectoryPath(targetPath: string): string {
  const normalizedPath = targetPath.replace(/[\\/]+$/, "");
  const lastSlashIndex = Math.max(
    normalizedPath.lastIndexOf("/"),
    normalizedPath.lastIndexOf("\\"),
  );

  if (lastSlashIndex < 0) return normalizedPath;
  if (lastSlashIndex === 0) return normalizedPath.slice(0, 1);
  return normalizedPath.slice(0, lastSlashIndex);
}

async function saveBlobViaUTools(blob: Blob, filename: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const hostWindow = window as Window & {
    utools?: {
      showSaveDialog?: (options?: Record<string, unknown>) => unknown;
      shellShowItemInFolder?: (targetPath: string) => boolean | Promise<boolean>;
      shellOpenPath?: (targetPath: string) => boolean | Promise<boolean>;
    };
    gooseFs?: GooseFs & {
      revealItemInFolder?: (targetPath: string) => boolean | Promise<boolean>;
    };
  };

  const utools = hostWindow.utools;
  const gooseFs = hostWindow.gooseFs;
  if (!utools || typeof utools.showSaveDialog !== "function" || !gooseFs) {
    return false;
  }

  const saveResult = await Promise.resolve(
    utools.showSaveDialog({
      title: "导出文件",
      defaultPath: filename,
      buttonLabel: "导出",
    })
  );

  const normalizeSavePath = (value: unknown): string | null => {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === "string");
      return typeof first === "string" && first.trim().length > 0 ? first : null;
    }
    if (value && typeof value === "object") {
      const filePath =
        "filePath" in value && typeof (value as { filePath?: unknown }).filePath === "string"
          ? (value as { filePath: string }).filePath
          : null;
      const canceled =
        "canceled" in value && Boolean((value as { canceled?: unknown }).canceled);
      if (canceled) return null;
      if (filePath && filePath.trim().length > 0) return filePath;
    }
    return null;
  };

  const targetPath = normalizeSavePath(saveResult);

  if (!targetPath) {
    return true;
  }

  const base64 = await blobToBase64(blob);
  const payload = base64.replace(/^data:.*;base64,/, "");
  const saved = gooseFs.writeFileAsync
    ? await gooseFs.writeFileAsync(targetPath, payload, "base64")
    : await Promise.resolve(gooseFs.writeFile(targetPath, payload, "base64"));

  if (!saved) {
    throw new Error("uTools 写入文件失败");
  }

  const folderPath = getParentDirectoryPath(targetPath);
  let revealed = false;
  if (typeof gooseFs.revealItemInFolder === "function") {
    revealed = Boolean(await gooseFs.revealItemInFolder(targetPath));
  }

  if (!revealed && typeof utools.shellShowItemInFolder === "function") {
    revealed = Boolean(await Promise.resolve(utools.shellShowItemInFolder(targetPath)));
  }

  if (!revealed && typeof utools.shellOpenPath === "function") {
    revealed = Boolean(await Promise.resolve(utools.shellOpenPath(folderPath)));
  }

  if (
    !revealed &&
    folderPath !== targetPath &&
    typeof utools.shellOpenPath === "function"
  ) {
    revealed = Boolean(await Promise.resolve(utools.shellOpenPath(targetPath)));
  }

  return true;
}

async function saveBlobAndReveal(blob: Blob, filename: string): Promise<boolean> {
  return saveBlobViaUTools(blob, filename);
}

async function downloadBlob(blob: Blob, filename: string) {
  try {
    const saved = await saveBlobAndReveal(blob, filename);
    if (saved) return;
    throw new Error("当前版本仅支持 uTools 导出");
  } catch (error) {
    console.error("[export] 导出后自动打开文件夹失败:", error);
    throw error;
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

  const restoreImages = (content: JSONContent) => {
    if (!content.content) return;
    for (const node of content.content) {
      if (
        (node.type === "image" || node.type === "imageResize") &&
        node.attrs?.src
      ) {
        const src = node.attrs.src as string;
        if (src.includes("assets/")) {
          const filename = src.split("assets/").pop();
          if (filename && assetMap.has(filename)) {
            node.attrs.src = assetMap.get(filename);
          }
        }
      }
      if (node.content) restoreImages(node);
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
        const imported = importFromMarkdown(text, title);
        const content = imported.content;
        const firstNode = content.content?.[0];
        const hasH1Title =
          firstNode?.type === "heading" &&
          firstNode.attrs?.level === 1 &&
          firstNode.content?.some(
            (n: JSONContent) => n.text === imported.title,
          );
        if (!hasH1Title) {
          content.content = [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: imported.title }],
            },
            ...(content.content || []),
          ];
        }
        pageData = { content };
        if (pageData.content) restoreImages(pageData.content);
      }

      const newId = onCreatePage(pageData, workspaceId, parentId);
      pathIdMap.set(nameWithoutExt, newId);
    }
  }
}

export interface ImportResult {
  title: string;
  content: JSONContent;
  success: boolean;
  error?: string;
  filename?: string;
}

export function importFromJSON(
  jsonString: string,
  filename?: string,
): ImportResult {
  try {
    const data = JSON.parse(jsonString) as any;

    if (!data.content || typeof data.content !== "object") {
      return {
        title: "",
        content: { type: "doc", content: [] },
        success: false,
        error: "无效的 JSON 格式：缺少 content 字段",
      };
    }

    // 如果有旧的 title 字段，提取它；否则从 content 提取
    let title = filename || "导入的页面";
    if ("title" in data && data.title) {
      title = data.title;
    } else {
      title = extractTitleFromContent(data.content) || filename || "导入的页面";
    }

    return {
      title,
      content: data.content,
      success: true,
    };
  } catch (e) {
    return {
      title: "",
      content: { type: "doc", content: [] },
      success: false,
      error: "解析 JSON 失败",
    };
  }
}

export function importFromMarkdown(
  markdown: string,
  filename?: string,
): ImportResult {
  try {
    const content = markdownToJsonContent(markdown);

    let title = filename || "导入的页面";
    if (!filename) {
      const h1Match = markdown.match(/^#\s+(.+)$/m);
      if (h1Match) {
        title = h1Match[1].trim();
      }
    }

    return { title, content, success: true };
  } catch (e) {
    return {
      title: "",
      content: { type: "doc", content: [] },
      success: false,
      error: "解析 Markdown 失败",
    };
  }
}

export function importFile(): Promise<ImportResult> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.md,.markdown,.txt";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve({
          title: "",
          content: { type: "doc", content: [] },
          success: false,
          error: "未选择文件",
        });
        return;
      }

      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      const filename = file.name.replace(/\.[^/.]+$/, "");

      if (ext === "json") {
        resolve(importFromJSON(text, filename));
      } else if (ext === "md" || ext === "markdown" || ext === "txt") {
        resolve(importFromMarkdown(text, filename));
      } else {
        resolve({
          title: "",
          content: { type: "doc", content: [] },
          success: false,
          error: "不支持的文件格式",
        });
      }
    };

    input.click();
  });
}

function downloadFile(content: string, filename: string, contentType: string) {
  try {
    const blob = new Blob([content], { type: contentType });
    void downloadBlob(blob, filename);
  } catch (error) {
    console.error("下载失败:", error);
    throw error;
  }
}

export function jsonContentToMarkdown(
  content: JSONContent,
  skipFirstH1 = false,
): string {
  if (!content.content) return "";

  let nodes = content.content;
  if (skipFirstH1 && nodes.length > 0) {
    const first = nodes[0];
    if (first.type === "heading" && first.attrs?.level === 1) {
      nodes = nodes.slice(1);
    }
  }

  return nodes.map((node) => nodeToMarkdown(node)).join("\n");
}

function isLegacyCodeBlockMetaComment(line: string): boolean {
  return /^<!--\s*goose-note:codeblock\s+.+?\s*-->$/.test(line);
}

function nodeToMarkdown(node: JSONContent): string {
  switch (node.type) {
    case "paragraph":
      const text = inlineContentToMarkdown(node.content);
      return text + "\n";

    case "heading": {
      const level = node.attrs?.level || 1;
      return (
        "#".repeat(level) + " " + inlineContentToMarkdown(node.content) + "\n"
      );
    }

    case "bulletList":
      return (
        node.content?.map((item) => "- " + listItemContent(item)).join("\n") +
        "\n"
      );

    case "orderedList":
      return (
        node.content
          ?.map((item, i) => `${i + 1}. ` + listItemContent(item))
          .join("\n") + "\n"
      );

    case "taskList":
      return (
        node.content
          ?.map((item) => {
            const checked = item.attrs?.checked ? "x" : " ";
            return `- [${checked}] ` + listItemContent(item);
          })
          .join("\n") + "\n"
      );

    case "blockquote":
      return (
        "> " +
        jsonContentToMarkdown(node).trim().split("\n").join("\n> ") +
        "\n"
      );

    case "codeBlock": {
      const lang = node.attrs?.language || "";
      if (lang === "math") {
        return "$$\n" + (node.content?.[0]?.text || "") + "\n$$\n";
      }
      if (lang === "yaml-frontmatter") {
        return "---\n" + (node.content?.[0]?.text || "") + "\n---\n";
      }
      return (
        "```" + lang + "\n" + (node.content?.[0]?.text || "") + "\n```\n"
      );
    }

    case "horizontalRule":
      return "---\n";

    case "image":
    case "imageResize": {
      const alt = node.attrs?.alt || "";
      const src = node.attrs?.src || "";
      const align = getAlignFromContainerStyle(node.attrs?.containerStyle);
      const width = node.attrs?.width ? `width=${node.attrs.width}` : "";
      const height = node.attrs?.height ? `height=${node.attrs.height}` : "";
      const meta = [align ? `align=${align}` : "", width, height]
        .filter(Boolean)
        .join(" ");
      const metaTag = meta ? `{${meta}}` : "";
      return `![${alt}](${src})${metaTag}\n`;
    }

    case "table": {
      const rows = node.content || [];
      if (rows.length === 0) return "\n";
      const tableRows = rows.map((row) => row.content || []);
      const columnCount = Math.max(
        1,
        ...tableRows.map((cells) => cells.length),
      );

      const cellText = (cell: JSONContent) => {
        const parts = (cell.content || []).map((child) => {
          if (child.type === "paragraph") {
            return inlineContentToMarkdown(child.content);
          }
          return inlineContentToMarkdown(child.content);
        });
        return parts.join("<br>");
      };

      const normalizeRow = (cells: JSONContent[]) => {
        const padded = [...cells];
        while (padded.length < columnCount) padded.push({ type: "tableCell" });
        return padded;
      };

      const headerCells = normalizeRow(tableRows[0]).map((cell) =>
        cellText(cell).replace(/\|/g, "\\|"),
      );
      const headerLine = `| ${headerCells.join(" | ")} |`;
      const separatorLine = `| ${Array(columnCount).fill("---").join(" | ")} |`;

      const bodyLines = tableRows.slice(1).map((cells) => {
        const rowCells = normalizeRow(cells).map((cell) =>
          cellText(cell).replace(/\|/g, "\\|"),
        );
        return `| ${rowCells.join(" | ")} |`;
      });

      return [headerLine, separatorLine, ...bodyLines].join("\n") + "\n";
    }

    case "details": {
      const summary = node.content?.find((c) => c.type === "detailsSummary");
      const content = node.content?.find((c) => c.type === "detailsContent");
      const summaryText = summary
        ? inlineContentToMarkdown(summary.content)
        : "详情";
      const contentMarkdown = content ? jsonContentToMarkdown(content) : "";
      return `<details>\n<summary>${summaryText}</summary>\n\n${contentMarkdown}\n</details>\n`;
    }

    case "callout": {
      const emoji = node.attrs?.emoji || "💡";
      const text = inlineContentToMarkdown(node.content);
      return `> [!INFO] ${emoji} ${text}\n`;
    }

    default:
      return inlineContentToMarkdown(node.content) + "\n";
  }
}

function listItemContent(item: JSONContent): string {
  const paragraphs = item.content?.filter((c) => c.type === "paragraph") || [];
  return paragraphs.map((p) => inlineContentToMarkdown(p.content)).join(" ");
}

function inlineContentToMarkdown(content?: JSONContent[]): string {
  if (!content || content.length === 0) return "";

  return content
    .map((node) => {
      if (node.type === "inlineMath") {
        return `$${node.attrs?.value || ""}$`;
      }

      let text = node.text || "";

      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case "bold":
              text = `**${text}**`;
              break;
            case "italic":
              text = `*${text}*`;
              break;
            case "strike":
              text = `~~${text}~~`;
              break;
            case "code":
              text = `\`${text}\``;
              break;
            case "link":
              text = `[${text}](${mark.attrs?.href || ""})`;
              break;
            case "underline":
              text = `<u>${text}</u>`;
              break;
            case "superscript":
              text = `<sup>${text}</sup>`;
              break;
            case "subscript":
              text = `<sub>${text}</sub>`;
              break;
            case "highlight":
              if (mark.attrs?.color) {
                text = `<span style="background-color: ${mark.attrs.color}">${text}</span>`;
              } else {
                text = `==${text}==`;
              }
              break;
            case "textStyle":
              if (mark.attrs?.color) {
                text = `<span style="color: ${mark.attrs.color}">${text}</span>`;
              }
              break;
          }
        }
      }

      return text;
    })
    .join("");
}

function markdownToJsonContent(markdown: string): JSONContent {
  const lines = markdown
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const content: JSONContent[] = [];
  let i = 0;

  // 识别 YAML Frontmatter
  if (lines.length > 0 && lines[0].trim() === "---") {
    const frontmatterLines: string[] = [];
    i++;
    while (i < lines.length && lines[i].trim() !== "---") {
      frontmatterLines.push(lines[i]);
      i++;
    }
    if (i < lines.length && lines[i].trim() === "---") {
      // 将 Frontmatter 存为一个特殊的代码块，以便还原
      content.push({
        type: "codeBlock",
        attrs: { language: "yaml-frontmatter" },
        content: [{ type: "text", text: frontmatterLines.join("\n") }],
      });
      i++;
    } else {
      // 如果没找到结尾的 ---，重置指针，按普通内容处理
      i = 0;
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (isLegacyCodeBlockMetaComment(trimmedLine)) {
      i++;
      continue;
    }

    if (trimmedLine.startsWith("<details>")) {
      const detailsLines: string[] = [];
      let summaryText = "详情";
      i++;
      while (i < lines.length && !lines[i].trim().includes("</details>")) {
        const line = lines[i].trim();
        if (line.startsWith("<summary>") && line.endsWith("</summary>")) {
          summaryText = line.replace("<summary>", "").replace("</summary>", "");
        } else {
          detailsLines.push(lines[i]);
        }
        i++;
      }

      const subContent = markdownToJsonContent(detailsLines.join("\n"));
      content.push({
        type: "details",
        content: [
          {
            type: "detailsSummary",
            content: [{ type: "text", text: summaryText }],
          },
          {
            type: "detailsContent",
            content: subContent.content || [],
          },
        ],
      });
      i++;
      continue;
    }

    if (trimmedLine === "$$") {
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "$$") {
        mathLines.push(lines[i]);
        i++;
      }
      content.push({
        type: "codeBlock",
        attrs: { language: "math" },
        content: [{ type: "text", text: mathLines.join("\n") }],
      });
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInlineMarkdown(headingMatch[2]),
      });
      i++;
      continue;
    }

    if (line.match(/^---+$/)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    if (trimmedLine.startsWith(">")) {
      const quoteLines: string[] = [];
      const firstLine = trimmedLine.slice(1).trim();

      // 识别 Callout 语法: > [!INFO] 💡 内容
      const calloutMatch = firstLine.match(
        /^\[!INFO\]\s+(?:([\uD800-\uDBFF][\uDC00-\uDFFF]|\S))\s+(.+)$/i,
      );

      if (calloutMatch) {
        content.push({
          type: "callout",
          attrs: { emoji: calloutMatch[1] },
          content: parseInlineMarkdown(calloutMatch[2]),
        });
        i++;
        continue;
      }

      quoteLines.push(firstLine);
      i++;

      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().slice(1).trim());
        i++;
      }
      content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: parseInlineMarkdown(quoteLines.join(" ")),
          },
        ],
      });
      continue;
    }

    const isTableSeparator = (value: string) => {
      const v = value.trim();
      return /^\|?(\s*:?-+:?\s*\|?)+$/.test(v) && v.includes("-");
    };

    const splitTableRow = (value: string) => {
      const trimmed = value.trim();
      const content = trimmed.replace(/^\|/, "").replace(/\|$/, "");
      return content.split("|").map((cell) => cell.trim());
    };

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headerCells = splitTableRow(line);
      i += 2;

      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        if (isTableSeparator(lines[i])) {
          i++;
          continue;
        }
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }

      const toCell = (text: string, type: "tableHeader" | "tableCell") => ({
        type: "tableCell",
        attrs: { ...((type === "tableHeader" && { isHeader: true }) || {}) },
        content: [
          {
            type: "paragraph",
            content: parseInlineMarkdown(text.replace(/\\\|/g, "|")),
          },
        ],
      });

      const headerRow = {
        type: "tableRow",
        content: headerCells.map((cell) => toCell(cell, "tableHeader")),
      };

      const bodyRowNodes = bodyRows.map((row) => ({
        type: "tableRow",
        content: row.map((cell) => toCell(cell, "tableCell")),
      }));

      content.push({
        type: "table",
        content: [headerRow, ...bodyRowNodes],
      });
      continue;
    }

    const taskMatch = line.match(/^-\s+\[([ x])\]\s+(.+)$/);
    if (taskMatch) {
      const items: JSONContent[] = [];
      while (i < lines.length) {
        const tm = lines[i].match(/^-\s+\[([ x])\]\s+(.+)$/);
        if (!tm) break;
        items.push({
          type: "taskItem",
          attrs: { checked: tm[1] === "x" },
          content: [{ type: "paragraph", content: parseInlineMarkdown(tm[2]) }],
        });
        i++;
      }
      content.push({ type: "taskList", content: items });
      continue;
    }

    if (line.match(/^-\s+/)) {
      const items: JSONContent[] = [];
      while (i < lines.length && lines[i].match(/^-\s+/)) {
        const text = lines[i].replace(/^-\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInlineMarkdown(text) }],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    if (line.match(/^\d+\.\s+/)) {
      const items: JSONContent[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const text = lines[i].replace(/^\d+\.\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInlineMarkdown(text) }],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?$/);
    if (imgMatch) {
      const metaRaw = imgMatch[3] || "";
      const metaMap = new Map<string, string>();
      metaRaw
        .split(/\s+/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .forEach((chunk) => {
          const [key, value] = chunk.split("=");
          if (key && value) metaMap.set(key, value);
        });

      const align = metaMap.get("align") as
        | "left"
        | "center"
        | "right"
        | undefined;
      const containerStyle = align ? alignToContainerStyle(align) : undefined;
      const width = metaMap.get("width");
      const height = metaMap.get("height");
      const widthValue = width ? Number(width) : undefined;
      const heightValue = height ? Number(height) : undefined;
      content.push({
        type: "imageResize",
        attrs: {
          src: imgMatch[2],
          alt: imgMatch[1],
          containerStyle,
          ...(Number.isFinite(widthValue) ? { width: widthValue } : {}),
          ...(Number.isFinite(heightValue) ? { height: heightValue } : {}),
        },
      });
      i++;
      continue;
    }

    if (line.trim()) {
      // 收集连续的非特殊行作为一个段落，防止 HTML 块或长文本被拆散
      const paragraphLines: string[] = [];

      while (i < lines.length) {
        const currentLine = lines[i];
        const trimmed = currentLine.trim();

        // 如果遇到空行或特殊语法的起始符，结束当前段落收集
        if (!trimmed) break;

        // 检查是否是其他语法的起始
        if (paragraphLines.length > 0) {
          if (
            currentLine.startsWith("#") ||
            currentLine.startsWith(">") ||
            currentLine.startsWith("```") ||
            currentLine.startsWith("$$") ||
            currentLine.match(/^-\s+\[[ x]\]/) ||
            currentLine.match(/^[-*+]\s+/) ||
            currentLine.match(/^\d+\.\s+/) ||
            currentLine.match(/^---+$/) ||
            currentLine.match(/^\|/)
          ) {
            break;
          }
        }

        paragraphLines.push(currentLine);
        i++;
      }

      if (paragraphLines.length > 0) {
        // 如果内容以 < 开头，可能是 HTML 块，使用换行符保留结构；否则使用空格按普通段落合并
        const isHtmlBlock = paragraphLines[0].trim().startsWith("<");
        const combinedText = paragraphLines.join(isHtmlBlock ? "\n" : " ");

        const inline = parseInlineMarkdown(combinedText);
        content.push(
          inline.length > 0
            ? { type: "paragraph", content: inline }
            : { type: "paragraph" },
        );
        continue;
      }
    } else if (
      content.length > 0 &&
      content[content.length - 1].type !== "paragraph"
    ) {
      content.push({ type: "paragraph" });
    }
    i++;
  }

  return { type: "doc", content };
}

function parseInlineMarkdown(text: string): JSONContent[] {
  const result: JSONContent[] = [];
  if (!text) return result;

  const regex =
    /(\$((?:\\\$|[^\$])+?)\$|<span\s+style="([^"]+)">(.+?)<\/span>|==(.+?)==|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      // 匹配到 $...$，创建 inlineMath 节点，使其在编辑器中以公式形式显示
      result.push({ type: "inlineMath", attrs: { value: match[2] } });
    } else if (match[3] && match[4]) {
      // 匹配到 <span style="...">...</span>
      const style = match[3];
      const innerText = match[4];
      const marks: any[] = [];

      const colorMatch = style.match(/color:\s*([^;]+)/);
      if (colorMatch) {
        marks.push({
          type: "textStyle",
          attrs: { color: colorMatch[1].trim() },
        });
      }

      const bgMatch = style.match(/background-color:\s*([^;]+)/);
      if (bgMatch) {
        marks.push({ type: "highlight", attrs: { color: bgMatch[1].trim() } });
      }

      result.push({ type: "text", text: innerText, marks });
    } else if (match[5]) {
      result.push({
        type: "text",
        text: match[5],
        marks: [{ type: "highlight" }],
      });
    } else if (match[6]) {
      result.push({ type: "text", text: match[6], marks: [{ type: "bold" }] });
    } else if (match[7]) {
      result.push({
        type: "text",
        text: match[7],
        marks: [{ type: "italic" }],
      });
    } else if (match[8]) {
      result.push({
        type: "text",
        text: match[8],
        marks: [{ type: "strike" }],
      });
    } else if (match[9]) {
      result.push({ type: "text", text: match[9], marks: [{ type: "code" }] });
    } else if (match[10] && match[11]) {
      result.push({
        type: "text",
        text: match[10],
        marks: [{ type: "link", attrs: { href: match[11] } }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: "text", text: text.slice(lastIndex) });
  }

  return result.length > 0 ? result : [{ type: "text", text }];
}
