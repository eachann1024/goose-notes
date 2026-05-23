import type { Page } from "@/types";
import type { BlockNoteContent } from "@/lib/blocknote-content";
import { extractTitleFromContent } from "@/lib/content-text-extractor";
import {
  normalizePageContent,
  createEmptyBlockNoteContent,
} from "@/lib/blocknote-content";
import { jsonContentToMarkdown } from "./markdown/serialize";
import { importFromMarkdown, type ImportResult } from "./markdown/parse";
import { saveBlobAndReveal, triggerBrowserDownload } from "./fileSave";

export { jsonContentToMarkdown } from "./markdown/serialize";
export {
  importFromMarkdown,
  importMarkdownFragment,
  type ImportResult,
} from "./markdown/parse";
export {
  exportNotebooks,
  importNotebooksFromZip,
  type ExportOptions,
} from "./zipBundle";
export { saveBlobAndReveal } from "./fileSave";

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

function downloadFile(content: string, filename: string, contentType: string) {
  try {
    const blob = new Blob([content], { type: contentType });
    void downloadBlob(blob, filename);
  } catch (error) {
    console.error("下载失败:", error);
    throw error;
  }
}

export function exportToJSON(page: Page) {
  const data = JSON.stringify(page, null, 2);
  const title = extractTitleFromContent(page.content);
  downloadFile(data, `${title || "untitled"}.json`, "application/json");
}

export function exportToMarkdown(page: Page) {
  const content = page.content as BlockNoteContent;
  const markdown = jsonContentToMarkdown(content, true);
  const title = extractTitleFromContent(page.content);
  const fullMarkdown = `# ${title}\n\n${markdown}`;
  downloadFile(fullMarkdown, `${title || "untitled"}.md`, "text/markdown");
}

export function exportToHTML(page: Page) {
  const html = contentToHTML(page.content);
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
code { background: #F2F3F5; color: #1F2329; padding: 1px 4px; border-radius: 3px; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 0.85em; }
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

export function importFromJSON(
  jsonString: string,
  filename?: string,
): ImportResult {
  try {
    const data = JSON.parse(jsonString) as any;

    if (!data.content || typeof data.content !== "object") {
      return {
        title: "",
        content: createEmptyBlockNoteContent(),
        success: false,
        error: "无效的 JSON 格式：缺少 content 字段",
      };
    }

    let title = filename || "导入的页面";
    if ("title" in data && data.title) {
      title = data.title;
    } else {
      title = extractTitleFromContent(data.content) || filename || "导入的页面";
    }

    return {
      title,
      content: normalizePageContent(data.content),
      success: true,
    };
  } catch (e) {
    return {
      title: "",
      content: createEmptyBlockNoteContent(),
      success: false,
      error: "解析 JSON 失败",
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
          content: createEmptyBlockNoteContent(),
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
          content: createEmptyBlockNoteContent(),
          success: false,
          error: "不支持的文件格式",
        });
      }
    };

    input.click();
  });
}
