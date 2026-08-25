/**
 * uTools 主路径：把笔记 HTML 丢进隐藏窗，webContents.printToPDF。
 * 浏览器没有这套 API 时由 exportToPDF 降级 react-pdf。
 */

import type { Page } from "@/types";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { buildExportHtmlBody } from "@/lib/export/pageMarkdown";
import { wrapExportEditorHtml } from "@/lib/export/exportHtmlDocument";
import { getExportHtmlCss, sanitizePrintCss } from "@/lib/export/exportHtmlCss";
import {
  EXPORT_HTML_HEAD_ASSETS,
} from "@/lib/export/blocknoteSerializer";
import { getMermaidInitConfig } from "@/lib/imageExport/mermaidTheme";

const PRINT_FONT_STACK =
  '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

export function canPrintToPdf(): boolean {
  if (typeof window === "undefined") return false;
  const gfs = window.gooseFs as (GooseFs & { printHtmlToPdf?: unknown }) | undefined;
  if (typeof gfs?.printHtmlToPdf === "function") return true;
  const utools = (window as Window & { utools?: { createBrowserWindow?: unknown } }).utools;
  return typeof utools?.createBrowserWindow === "function";
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function mediaLabel(block: Record<string, unknown>, fallback: string): string {
  const props = (block.props ?? {}) as Record<string, unknown>;
  const name = typeof props.name === "string" ? props.name.trim() : "";
  const caption = typeof props.caption === "string" ? props.caption.trim() : "";
  return name || caption || fallback;
}

function placeholderParagraph(
  block: Record<string, unknown>,
  icon: string,
  fallback: string,
): Record<string, unknown> {
  const props = (block.props ?? {}) as Record<string, unknown>;
  const url = String(props.url || props.src || "");
  const name = mediaLabel(block, fallback);
  const caption = typeof props.caption === "string" ? props.caption.trim() : "";
  const text =
    caption && caption !== name ? `${icon} ${name} ${caption}` : `${icon} ${name}`;
  const content = isHttpUrl(url)
    ? [
        {
          type: "link",
          href: url,
          content: [{ type: "text", text, styles: {} }],
        },
      ]
    : [{ type: "text", text, styles: {} }];
  return {
    ...block,
    type: "paragraph",
    props: {},
    content,
  };
}

/** 视频/文件/音频改成图标+文件名，避免 att-file: / data:video 进打印引擎。 */
export function toPrintMediaPlaceholders(blocks: BlockNoteContent): BlockNoteContent {
  return blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const next = { ...(block as Record<string, unknown>) };
    if (next.type === "video") {
      Object.assign(next, placeholderParagraph(next, "▶", "视频"));
    } else if (next.type === "file") {
      Object.assign(next, placeholderParagraph(next, "📎", "未命名文件"));
    } else if (next.type === "audio") {
      Object.assign(next, placeholderParagraph(next, "♪", "音频"));
    }
    if (Array.isArray(next.children)) {
      next.children = toPrintMediaPlaceholders(next.children as BlockNoteContent);
    }
    return next;
  }) as BlockNoteContent;
}

export async function renderPrintHtml(
  title: string,
  bodyHtml: string,
  includeBodyH1 = true,
): Promise<string> {
  const bodyHeading = includeBodyH1
    ? `<h1>${escapeHtmlText(title)}</h1>\n`
    : "";
  const editorCss = sanitizePrintCss(await getExportHtmlCss());
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtmlText(title)}</title>
${EXPORT_HTML_HEAD_ASSETS}
<style>
@page { size: A4; margin: 16mm; }
html, body {
  background: #ffffff;
  color: #1f2329;
}
body {
  font-family: ${PRINT_FONT_STACK};
  max-width: 820px;
  margin: 0 auto;
  padding: 0;
  line-height: 1.65;
}
#export-content > h1 {
  font-size: 2em;
  line-height: 1.3;
  margin: 0 0 0.8em;
}
img, video { max-width: 100%; height: auto; }
.katex-display { overflow-x: auto; overflow-y: hidden; }
${editorCss}
</style>
</head>
<body>
<main id="export-content">
${bodyHeading}${wrapExportEditorHtml(bodyHtml)}
</main>
<script>
window.__GOOSE_PRINT_READY__ = false;
</script>
<script type="module">
const done = () => { window.__GOOSE_PRINT_READY__ = true; };
const timeout = new Promise((resolve) => setTimeout(resolve, 6000));
try {
  await Promise.race([
    (async () => {
      const mermaid = (await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")).default;
      mermaid.initialize(${JSON.stringify({
        ...getMermaidInitConfig({
          mode: "light",
          securityLevel: "loose",
          useMaxWidth: true,
        }),
        startOnLoad: true,
      })});
      if (typeof mermaid.run === "function") {
        await mermaid.run();
      }
    })(),
    timeout,
  ]);
} catch (e) { console.warn("[printPdf] mermaid 加载失败:", e); }
done();
</script>
</body>
</html>`;
}

export async function buildPagePrintHtml(
  page: Page,
  blocks: BlockNoteContent,
): Promise<string> {
  const titled = getPageTitle(page) || "untitled";
  const printBlocks = toPrintMediaPlaceholders(blocks);
  const bodyHtml = await buildExportHtmlBody(page, printBlocks);
  return renderPrintHtml(titled, bodyHtml, !page.localFilePath);
}

function pdfBase64ToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (bytes.byteLength < 80) {
    throw new Error("printToPDF 返回空内容");
  }
  return new Blob([bytes], { type: "application/pdf" });
}

async function printHtmlViaHiddenWindow(html: string): Promise<Blob> {
  const utools = (window as Window & {
    utools?: {
      createBrowserWindow?: (
        url: string,
        options: Record<string, unknown>,
        callback?: () => void,
      ) => {
        webContents?: {
          printToPDF?: (options: Record<string, unknown>) => Promise<ArrayBuffer | Uint8Array>;
          executeJavaScript?: (code: string) => Promise<unknown>;
          loadURL?: (url: string) => Promise<void> | void;
        };
        loadURL?: (url: string) => Promise<void> | void;
        close?: () => void;
      };
    };
  }).utools;
  if (typeof utools?.createBrowserWindow !== "function") {
    throw new Error("createBrowserWindow 不可用");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let win: ReturnType<NonNullable<typeof utools.createBrowserWindow>> | null = null;
    const finish = (error: unknown, blob?: Blob) => {
      if (settled) return;
      settled = true;
      try {
        win?.close?.();
      } catch {
        /* noop */
      }
      if (error) reject(error);
      else if (blob) resolve(blob);
      else reject(new Error("printToPDF 失败"));
    };

    try {
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      win = utools.createBrowserWindow(
        dataUrl,
        { show: false, width: 820, height: 1169, hasShadow: false },
        () => {
          void (async () => {
            try {
              const webContents = win?.webContents;
              if (typeof webContents?.printToPDF !== "function") {
                throw new Error("webContents.printToPDF 不可用");
              }
              if (typeof webContents.executeJavaScript === "function") {
                const start = Date.now();
                while (Date.now() - start < 8000) {
                  try {
                    const ready = await webContents.executeJavaScript(
                      "Boolean(window.__GOOSE_PRINT_READY__ === true)",
                    );
                    if (ready) break;
                  } catch {
                    /* navigating */
                  }
                  await new Promise((r) => setTimeout(r, 150));
                }
              } else {
                await new Promise((r) => setTimeout(r, 800));
              }
              const data = await webContents.printToPDF({
                printBackground: true,
                preferCSSPageSize: true,
              });
              const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
              let binary = "";
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              finish(null, pdfBase64ToBlob(btoa(binary)));
            } catch (error) {
              finish(error);
            }
          })();
        },
      );
    } catch (error) {
      finish(error);
      return;
    }

    setTimeout(() => finish(new Error("printToPDF 超时")), 20_000);
  });
}

export async function exportPageViaPrintToPdf(
  page: Page,
  blocks: BlockNoteContent,
): Promise<Blob> {
  if (!canPrintToPdf()) {
    throw new Error("printToPDF 不可用");
  }
  const html = await buildPagePrintHtml(page, blocks);
  const gfs = window.gooseFs as (GooseFs & {
    printHtmlToPdf?: (html: string) => Promise<string | null>;
  }) | undefined;
  if (typeof gfs?.printHtmlToPdf === "function") {
    const base64 = await gfs.printHtmlToPdf(html);
    if (!base64) throw new Error("printToPDF 返回空内容");
    return pdfBase64ToBlob(base64);
  }
  return printHtmlViaHiddenWindow(html);
}
