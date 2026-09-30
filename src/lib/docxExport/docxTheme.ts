/**
 * Word 导出视觉令牌。数值对齐 HTML 预览 / 编辑器浅色导出：
 * 16px 正文、标题 3em/2em/1.3em、行高 1.7、标注与高亮色带。
 */

import {
  BLOCKNOTE_BACKGROUND_COLORS,
  BLOCKNOTE_TEXT_COLORS,
} from "@/lib/imageExport/serializer/utils";

/** 正文 16px → 12pt；docx size 用半磅。 */
export const DOCX_BODY_SIZE = 24;
export const DOCX_CODE_SIZE = 20;
export const DOCX_CAPTION_SIZE = 20;
export const DOCX_LINE_SPACING = 408;

export const DOCX_HEADING_SIZES: Record<number, number> = {
  1: 72,
  2: 48,
  3: 31,
  4: 24,
  5: 22,
  6: 19,
};

export const DOCX_COLORS = {
  text: "1F2329",
  muted: "57606A",
  quote: "7D797A",
  quoteBorder: "7D797A",
  divider: "7D797A",
  calloutBg: "F7F6F3",
  calloutBorder: "E9E9E7",
  calloutAccent: "6366F1",
  codeBg: "F3F2F1",
  codeBorder: "E8E7E5",
  inlineCodeBg: "EEF2FF",
  inlineCodeFg: "4F46E5",
  tableHeader: "F4F4F4",
  tableBorder: "E8E7E5",
  mention: "4F46E5",
  fileBg: "F3F2F1",
} as const;

export const DOCX_TEXT_COLORS = BLOCKNOTE_TEXT_COLORS;
export const DOCX_BACKGROUND_COLORS = BLOCKNOTE_BACKGROUND_COLORS;

export const DOCX_CONTENT_WIDTH_PX = 624;
export const DOCX_PAGE_MARGIN_TWIP = 1440;
/** 正文区宽 6.5in，用于块盒子表格。 */
export const DOCX_CONTENT_WIDTH_DXA = 9360;
export const DOCX_BLOCK_PAD_Y = 80;
export const DOCX_HEADING_PAD_Y = 140;
export const DOCX_HEADING_PAD_X = 160;
export const DOCX_CHECK_PAD_Y = 80;
export const DOCX_BLOCK_GAP = 80;
export const DOCX_HEADING_GAP = 140;
export const DOCX_CHECK_MARKER_DXA = 420;

export function hexNoHash(value: string): string {
  return value.replace(/^#/, "").toUpperCase();
}

export function resolveNamedColor(
  value: unknown,
  palette: Record<string, string>,
): string | undefined {
  if (typeof value !== "string" || !value || value === "default") return undefined;
  const mapped = palette[value] || value;
  if (!mapped.startsWith("#") && !/^[0-9A-Fa-f]{3,8}$/.test(mapped)) {
    return undefined;
  }
  return hexNoHash(mapped);
}
