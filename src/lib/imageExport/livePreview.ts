import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { extractTitleFromContent } from "@/components/editor/utils/content-text-extractor";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { cloneExportBlocks } from "@/lib/export/prepareExportBlocks";
import type { Page } from "@/types";
import {
  buildStyledHTML,
  collectBlockInlineStyles,
  renderBlocks,
} from "./domSerializer";
import type { CardTheme } from "./themes";
import type { WatermarkConfig } from "./watermark";
import { normalizeWatermarkConfig } from "./watermark";
import { splitImageExportTitle } from "./titleLift";

/** 宽于该值才显示生成图片弹层的真实内容预览。uTools 默认约 800 不显示；桌面端默认 1250 显示。 */
export const IMAGE_EXPORT_LIVE_PREVIEW_MIN_WIDTH = 1000;

/** 窗口达到该宽度时，生成选项收成标题行工具条（Electron 默认 1250），避免与标题并排撑高页头。 */
export const IMAGE_EXPORT_OPTIONS_CORNER_MIN_WIDTH = 1200;

export function shouldShowImageExportLivePreview(width: number): boolean {
  return Number.isFinite(width) && width >= IMAGE_EXPORT_LIVE_PREVIEW_MIN_WIDTH;
}

export function shouldShowImageExportOptionsCorner(width: number): boolean {
  return Number.isFinite(width) && width >= IMAGE_EXPORT_OPTIONS_CORNER_MIN_WIDTH;
}

export function getImageExportPreviewSource(params: {
  mode: "page" | "selection";
  page?: Pick<Page, "content" | "localFilePath"> | null;
  blocks?: BlockNoteContent;
}): { title: string; blocks: BlockNoteContent } {
  const page = params.page;
  const selection = Array.isArray(params.blocks) ? params.blocks : [];
  if (params.mode === "selection" && selection.length > 0) {
    const title =
      (page ? getPageTitle(page as Page) : "") ||
      extractTitleFromContent(page?.content) ||
      "选中内容";
    return { title, blocks: selection };
  }

  const content = cloneExportBlocks(page?.content, {
    ensureFirstTitle: !page?.localFilePath,
  });
  const title =
    (page ? getPageTitle(page as Page) : "") ||
    extractTitleFromContent(content) ||
    "无标题";
  return { title, blocks: content };
}

export function buildImageExportPreviewHtml(params: {
  title: string;
  blocks: BlockNoteContent;
  theme: CardTheme;
  mode: "page" | "selection";
  watermarkConfig?: WatermarkConfig;
}): string {
  const wm = normalizeWatermarkConfig(params.watermarkConfig);
  const prepared = cloneExportBlocks(params.blocks, { ensureFirstTitle: false });
  const { blocks: blocksToRender, titleBlock } = splitImageExportTitle({
    blocks: prepared,
    pageTitle: params.title,
    showTitle: wm.showTitle,
    mode: params.mode,
  });
  const blocksHtml = renderBlocks(blocksToRender, params.theme);
  return buildStyledHTML({
    title: params.title,
    blocksHtml,
    theme: params.theme,
    watermarkConfig: wm,
    preview: true,
    titleInlineStyle: collectBlockInlineStyles(titleBlock, params.theme),
  });
}
