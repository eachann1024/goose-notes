import type { Page } from "@/types";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { cloneExportBlocks, prepareExportBlocks } from "./prepareExportBlocks";
import { buildExportMarkdown, buildExportHtmlBody } from "./pageMarkdown";
import { renderExportHtml } from "./exportHtmlDocument";
import { extractImagesFromContent } from "./zipBundle";

const SIDECAR_BLOCK_TYPES = new Set(["file", "audio", "video"]);

export type SinglePageExportFormat = "md" | "html" | "json" | "pdf";

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

function isRemoteOrEmbeddedUrl(src: string): boolean {
  return (
    /^https?:\/\//i.test(src) ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  );
}

function isLocalSidecarUrl(src: unknown): boolean {
  if (typeof src !== "string" || !src.trim()) return false;
  return !isRemoteOrEmbeddedUrl(src);
}

/** 页面是否含需要随单页导出打包的本地 file / video / audio（不含纯 http 与已内联 data）。 */
export function pageHasLocalSidecarAttachments(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const candidate = block as {
      type?: unknown;
      props?: { url?: unknown };
      children?: unknown;
    };
    if (
      typeof candidate.type === "string" &&
      SIDECAR_BLOCK_TYPES.has(candidate.type) &&
      isLocalSidecarUrl(candidate.props?.url)
    ) {
      return true;
    }
    if (pageHasLocalSidecarAttachments(candidate.children)) return true;
  }
  return false;
}

async function buildPlainExport(
  page: Page,
  format: SinglePageExportFormat,
  rawTitle: string,
  pdfBlob?: Blob,
): Promise<{ blob: Blob; filename: string }> {
  if (format === "pdf") {
    if (!pdfBlob) throw new Error("PDF 导出缺少已渲染的文件");
    return { blob: pdfBlob, filename: `${rawTitle}.pdf` };
  }
  if (format === "json") {
    return {
      blob: new Blob([JSON.stringify(page, null, 2)], {
        type: "application/json",
      }),
      filename: `${rawTitle}.json`,
    };
  }

  const blocks = await prepareExportBlocks(page);
  if (format === "md") {
    const markdown = await buildExportMarkdown(page, blocks);
    return {
      blob: new Blob([markdown], { type: "text/markdown" }),
      filename: `${rawTitle}.md`,
    };
  }

  const bodyHtml = await buildExportHtmlBody(page, blocks);
  const html = await renderExportHtml(rawTitle, bodyHtml, !page.localFilePath);
  return {
    blob: new Blob([html], { type: "text/html" }),
    filename: `${rawTitle}.html`,
  };
}

async function buildMainFile(
  page: Page,
  format: SinglePageExportFormat,
  safeTitle: string,
  pdfBlob?: Blob,
): Promise<{ filename: string; content: Blob | string }> {
  if (format === "pdf") {
    if (!pdfBlob) throw new Error("PDF 导出缺少已渲染的文件");
    return { filename: `${safeTitle}.pdf`, content: pdfBlob };
  }
  if (format === "json") {
    return {
      filename: `${safeTitle}.json`,
      content: JSON.stringify(page, null, 2),
    };
  }
  if (format === "md") {
    return {
      filename: `${safeTitle}.md`,
      content: await buildExportMarkdown(page, page.content),
    };
  }
  const bodyHtml = await buildExportHtmlBody(page, page.content);
  return {
    filename: `${safeTitle}.html`,
    content: await renderExportHtml(safeTitle, bodyHtml, !page.localFilePath),
  };
}

/**
 * 单页导出：有本地 file/video/audio 时打 ZIP（主文件 + assets/），否则仍是单文件。
 * PDF 渲染由调用方传入 blob，这里只负责是否打包附件。
 */
export async function buildSinglePageExport(
  page: Page,
  format: SinglePageExportFormat,
  pdfBlob?: Blob,
): Promise<{ blob: Blob; filename: string }> {
  const rawTitle = getPageTitle(page) || "untitled";
  const safeTitle = sanitizeFileName(rawTitle);

  if (!pageHasLocalSidecarAttachments(page.content)) {
    return buildPlainExport(page, format, rawTitle, pdfBlob);
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const assetsFolder = zip.folder("assets");
  if (!assetsFolder) throw new Error("无法创建附件目录");

  const pageClone = structuredClone(page) as Page;
  pageClone.content = cloneExportBlocks(pageClone.content, {
    ensureFirstTitle: !page.localFilePath,
  });
  await extractImagesFromContent(
    pageClone.content,
    assetsFolder,
    new Map(),
    new Set(),
    0,
    undefined,
    page.localFilePath,
  );

  const main = await buildMainFile(pageClone, format, safeTitle, pdfBlob);
  zip.file(main.filename, main.content);
  return {
    blob: await zip.generateAsync({ type: "blob" }),
    filename: `${safeTitle}.zip`,
  };
}
