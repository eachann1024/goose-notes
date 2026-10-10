import type { Page } from "@/types";
import { type BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { extractTitleFromContent } from "@/components/editor/utils/content-text-extractor";
import { getPageTitle } from "@/components/editor/utils/page-title";
import type { CardThemeId, NotebookCardThemeContext } from "./themes";
import { resolveCardTheme } from "./themes";
import type { WatermarkConfig } from "./watermark";
import { normalizeWatermarkConfig } from "./watermark";
import {
  buildStyledHTML,
  collectBlockInlineStyles,
  renderBlocks,
} from "./domSerializer";
import { resolveImageUrls } from "./remoteImageResolver";
import { renderMermaidBlocksAsImages } from "./mermaid";
import { renderMathBlocksAsImages } from "./math";
import { cloneExportBlocks } from "@/lib/export/prepareExportBlocks";
import { splitImageExportTitle } from "./titleLift";

export { getSelectionBlocksToRender } from "./titleLift";

import { captureElementToPng } from "./capture/captureElement";
export { calculateSafePixelRatio, getCapturePixelRatios } from "./capture/pixelRatio";

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

function buildFileName(
  title: string,
  theme: { nameEn: string },
  suffix?: string,
): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}_${milliseconds}`;
  const parts = [
    sanitizeFileName(title || "untitled"),
    sanitizeFileName(theme.nameEn),
    ts,
  ];
  if (suffix) parts.splice(1, 0, suffix);
  return `${parts.join("_")}.png`;
}

// ── Public API: Full Page Export ───────────────────────────────
function notebookThemeContextFromPage(
  page?: Pick<Page, "fontFamily"> | null,
): NotebookCardThemeContext {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const editorFontSize =
    typeof document === "undefined"
      ? undefined
      : Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--editor-font-size",
          ),
        );
  return {
    fontFamily: page?.fontFamily ?? "default",
    editorFontSize: Number.isFinite(editorFontSize) ? editorFontSize : undefined,
    resolvedTheme: isDark ? "dark" : "light",
  };
}

export async function exportPageToImage(
  page: Page,
  themeId: CardThemeId = "notebook",
  watermarkConfig?: WatermarkConfig,
) {
  const theme = resolveCardTheme(themeId, notebookThemeContextFromPage(page));
  const wm = normalizeWatermarkConfig(watermarkConfig);
  const title = getPageTitle(page) || extractTitleFromContent(page.content);
  const content = cloneExportBlocks(page.content, {
    ensureFirstTitle: !page.localFilePath,
  });
  await resolveImageUrls(content);
  await renderMermaidBlocksAsImages(content, theme);
  await renderMathBlocksAsImages(content, theme);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  try {
    const { blocks: blocksToRender, titleBlock } = splitImageExportTitle({
      blocks: content,
      pageTitle: title,
      showTitle: wm.showTitle,
      mode: "page",
    });
    const blocksHtml = renderBlocks(blocksToRender, theme);
    const html = buildStyledHTML({
      title,
      blocksHtml,
      theme,
      watermarkConfig: wm,
      titleInlineStyle: collectBlockInlineStyles(titleBlock, theme),
    });
    container.innerHTML = html;

    const cardElement = container.querySelector(
      ".gooseshot-container",
    ) as HTMLElement;
    if (!cardElement) throw new Error("Failed to create preview element");

    await captureElementToPng(cardElement, buildFileName(title, theme));
  } finally {
    document.body.removeChild(container);
  }
}

// ── Public API: Selection Export ───────────────────────────────
export async function exportSelectionToImage(
  selectionBlocks: BlockNoteContent,
  pageTitle?: string,
  themeId: CardThemeId = "notebook",
  watermarkConfig?: WatermarkConfig,
  page?: Pick<Page, "fontFamily"> | null,
) {
  if (!Array.isArray(selectionBlocks) || selectionBlocks.length === 0) return;

  const theme = resolveCardTheme(themeId, notebookThemeContextFromPage(page));
  const wm = normalizeWatermarkConfig(watermarkConfig);
  const title = pageTitle || "选中内容";

  const clonedBlocks = cloneExportBlocks(selectionBlocks, {
    ensureFirstTitle: false,
  });
  await resolveImageUrls(clonedBlocks);
  await renderMermaidBlocksAsImages(clonedBlocks, theme);
  await renderMathBlocksAsImages(clonedBlocks, theme);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  try {
    const { blocks: blocksToRender, titleBlock } = splitImageExportTitle({
      blocks: clonedBlocks,
      pageTitle: title,
      showTitle: wm.showTitle,
      mode: "selection",
    });
    const blocksHtml = renderBlocks(blocksToRender, theme);

    const html = buildStyledHTML({
      title,
      blocksHtml,
      theme,
      watermarkConfig: wm,
      titleInlineStyle: collectBlockInlineStyles(titleBlock, theme),
    });
    container.innerHTML = html;

    const cardElement = container.querySelector(
      ".gooseshot-container",
    ) as HTMLElement;
    if (!cardElement) throw new Error("Failed to create preview element");

    await captureElementToPng(cardElement, buildFileName(title, theme, "选中"));
  } finally {
    document.body.removeChild(container);
  }
}

// ── Legacy alias ───────────────────────────────────────────────
export async function exportToImage(
  page: Page,
  themeId: CardThemeId = "notebook",
) {
  return exportPageToImage(page, themeId);
}
