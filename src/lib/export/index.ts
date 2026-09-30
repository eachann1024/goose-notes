import type { Page } from "@/types";
import type { CustomFonts } from "@/stores/useSettings";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { extractTitleFromContent } from "@/components/editor/utils/content-text-extractor";
import {
  normalizePageContent,
  createEmptyBlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { importFromMarkdown, type ImportResult } from "./markdown/parse";
import { saveBlobAndReveal } from "./fileSave";
import {
  buildSinglePageExport,
  type SinglePageExportFormat,
} from "./pageWithAttachments";

export { jsonContentToMarkdown } from "./markdown/serialize";
export { blocksToMarkdown, blocksToHTML } from "./blocknoteSerializer";
export {
  importFromMarkdown,
  importMarkdownFragment,
  type ImportResult,
} from "./markdown/parse";
export {
  exportNotebooks,
  generateExportZip,
  inspectNotebookImportZip,
  importNotebooksFromZip,
  type ExportOptions,
} from "./zipBundle";
export { saveBlobAndReveal } from "./fileSave";
export {
  buildSinglePageExport,
  pageHasLocalSidecarAttachments,
} from "./pageWithAttachments";


async function downloadBlob(blob: Blob, filename: string) {
  try {
    const saved = await saveBlobAndReveal(blob, filename);
    if (saved) return;
  } catch (error) {
    console.error("[export] saveBlobAndReveal 失败:", error);
  }

  throw new Error("导出失败：无法通过 Electron 保存文件");
}

async function exportPage(
  page: Page,
  format: SinglePageExportFormat,
  pdfBlob?: Blob,
) {
  const { blob, filename } = await buildSinglePageExport(page, format, pdfBlob);
  await downloadBlob(blob, filename);
}

export async function exportToJSON(page: Page) {
  await exportPage(page, "json");
}

export async function exportToMarkdown(page: Page) {
  await exportPage(page, "md");
}

export async function exportToHTML(page: Page) {
  await exportPage(page, "html");
}

export async function exportToPDF(page: Page, customFonts?: CustomFonts) {
  const { renderPageToPdfBlob } = await import("@/lib/pdfExport");
  const pdfBlob = await renderPageToPdfBlob(page, customFonts);
  await exportPage(page, "pdf", pdfBlob);
}

export { renderExportHtml } from "./exportHtmlDocument";

export function importFromJSON(
  jsonString: string,
  filename?: string,
): ImportResult {
  try {
    const data: unknown = JSON.parse(jsonString);
    if (!data || typeof data !== "object" || !("content" in data)) {
      return {
        title: "",
        content: createEmptyBlockNoteContent(),
        success: false,
        error: "无效的 JSON 格式：缺少 content 字段",
      };
    }
    const record = data as Record<string, unknown>;
    if (!record.content || typeof record.content !== "object") {
      return {
        title: "",
        content: createEmptyBlockNoteContent(),
        success: false,
        error: "无效的 JSON 格式：缺少 content 字段",
      };
    }

    let title = filename || "导入的页面";
    if (typeof record.title === "string" && record.title) {
      title = record.title;
    } else {
      title =
        extractTitleFromContent(record.content as BlockNoteContent) ||
        filename ||
        "导入的页面";
    }

    return {
      title,
      content: normalizePageContent(record.content),
      success: true,
    };
  } catch {
    return {
      title: "",
      content: createEmptyBlockNoteContent(),
      success: false,
      error: "解析 JSON 失败",
    };
  }
}

export function importFile(options?: {
  preserveStructure?: boolean;
}): Promise<ImportResult> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.md,.markdown,.txt";

    let settled = false;
    const finish = (result: ImportResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const cancelled = () =>
      finish({
        title: "",
        content: createEmptyBlockNoteContent(),
        success: false,
        error: "未选择文件",
      });

    input.addEventListener("cancel", cancelled, { once: true });
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        cancelled();
        return;
      }

      try {
        const text = await file.text();
        const ext = file.name.split(".").pop()?.toLowerCase();
        const filename = file.name.replace(/\.[^/.]+$/, "");

        if (ext === "json") {
          finish(importFromJSON(text, filename));
        } else if (ext === "md" || ext === "markdown" || ext === "txt") {
          finish(
            importFromMarkdown(text, filename, {
              preserveStructure: options?.preserveStructure === true,
            }),
          );
        } else {
          finish({
            title: "",
            content: createEmptyBlockNoteContent(),
            success: false,
            error: "不支持的文件格式",
          });
        }
      } catch (error) {
        finish({
          title: "",
          content: createEmptyBlockNoteContent(),
          success: false,
          error:
            error instanceof Error && error.message
              ? `读取文件失败：${error.message}`
              : "读取文件失败",
        });
      }
    };

    input.click();
  });
}
