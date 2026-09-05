/**
 * PDF 渲染入口（只出 blob）。保存/有附件打 ZIP 由 export/index.exportToPDF 负责。
 *
 * - Electron：隐藏窗 printToPDF（系统中文字体，官方 HTML）
 * - 失败或非 Electron：xl-pdf-exporter + react-pdf，嵌入 Noto Sans SC static TTF
 * - 两路都失败则 throw，让 PageMenu toast 报失败
 * - 跳过官方 Inter 打包（fontsRegistered=true + vite stub）
 */

import type { Page } from "@/types";
import type { CustomFonts } from "@/stores/useSettings";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { createElement } from "react";
import { prepareExportBlocks } from "@/lib/export/prepareExportBlocks";
import { registerPdfFonts } from "./fontConfig";
import { createPdfBlockMappings } from "./blockMappings";
import { canPrintToPdf, exportPageViaPrintToPdf } from "./printPdf";

/** 薄 getter：避免 fontConfig 静态绑 zustand。 */
async function readExportCustomFonts(): Promise<CustomFonts> {
  const { useSettings } = await import("@/stores/useSettings");
  return useSettings.getState().customFonts;
}

async function exportViaReactPdf(
  page: Page,
  blocks: BlockNoteContent,
  customFonts?: CustomFonts,
): Promise<Blob> {
  const fonts = customFonts ?? (await readExportCustomFonts());
  const registered = await registerPdfFonts({
    fontFamily: page.fontFamily ?? "default",
    customFonts: fonts,
  });
  if (!registered.ready) {
    throw new Error("未能加载中文字体，无法生成 PDF");
  }

  const [{ PDFExporter }, ReactPDF, { editorSchema }, { pdfDefaultSchemaMappings }] =
    await Promise.all([
      import("@blocknote/xl-pdf-exporter"),
      import("@react-pdf/renderer"),
      import("@/components/editor/core/schema"),
      import("@blocknote/xl-pdf-exporter"),
    ]);

  const blockMapping = await createPdfBlockMappings({
    pageLocalFilePath: page.localFilePath ?? null,
  });
  const mergedMappings = {
    blockMapping: blockMapping as unknown as typeof pdfDefaultSchemaMappings.blockMapping,
    inlineContentMapping: {
      ...pdfDefaultSchemaMappings.inlineContentMapping,
      pageMention: (ic: { props?: { title?: string } }) => {
        const title =
          typeof ic?.props?.title === "string" && ic.props.title.trim()
            ? ic.props.title.trim()
            : "未命名";
        const label = title.startsWith("@") ? title : `@${title}`;
        return createElement(ReactPDF.Text, { key: `pageMention-${label}` }, label);
      },
    },
    styleMapping: pdfDefaultSchemaMappings.styleMapping,
  };

  // emojiSource:false —— 不要去拉 twemoji CDN（插件离线 / file:// 会 Failed to fetch）
  // resolveFileUrl: 已是 data:/http(s) 的资源原样返回，禁止走 BlockNote CORS 代理
  const exporter = new PDFExporter(editorSchema as any, mergedMappings as any, {
    emojiSource: false,
    resolveFileUrl: async (url: string) => url,
  });
  // 跳过默认 registerFonts：运行时不要再 import 那 4 套 Inter/Geist 字体。
  // 构建期靠 vite alias 把 Inter_18pt / GeistMono 指到 pdf-font-empty，避免打进 dist。
  (exporter as unknown as { fontsRegistered: boolean }).fontsRegistered = true;
  (exporter.styles as any).page = {
    ...(exporter.styles as any).page,
    fontFamily: registered.pageFontFamily,
  };

  const document = await exporter.toReactPDFDocument(blocks as any);
  const blob = await ReactPDF.pdf(document).toBlob();
  if (!blob || blob.size < 80) {
    throw new Error("react-pdf 生成了空 PDF");
  }
  return blob;
}

/** 只渲染 PDF blob，保存/打包由 export/index 负责。 */
export async function renderPageToPdfBlob(
  page: Page,
  customFonts?: CustomFonts,
): Promise<Blob> {
  const blocks = await prepareExportBlocks(page);

  let blob: Blob | null = null;
  let lastError: unknown;

  if (canPrintToPdf()) {
    try {
      blob = await exportPageViaPrintToPdf(page, blocks);
    } catch (error) {
      lastError = error;
      console.warn("[pdfExport] printToPDF 失败，降级 react-pdf:", error);
    }
  }

  if (!blob) {
    try {
      blob = await exportViaReactPdf(page, blocks, customFonts);
    } catch (error) {
      lastError = error;
      console.error("[pdfExport] react-pdf 导出失败:", error);
    }
  }

  if (!blob) {
    throw lastError instanceof Error
      ? lastError
      : new Error("PDF 导出失败");
  }

  return blob;
}
