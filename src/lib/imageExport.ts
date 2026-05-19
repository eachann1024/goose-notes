import type { Page } from "@/types";
import type { BlockNoteContent } from "./blocknote-content";
import { extractTitleFromContent } from "./content-text-extractor";
import { toPng } from "html-to-image";
import { trackEvent } from "./analytics";

// ── Card Theme System ──────────────────────────────────────────
// 9 curated visual themes for the share card, designed for 2025-2026

export interface CardTheme {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  tags: string[];

  // Typography
  titleFont: string;
  bodyFont: string;
  codeFont: string;
  titleFontSize: number;
  titleFontWeight: number;
  titleLineHeight: number;
  titleLetterSpacing: string;
  titleAlign: "left" | "center" | "right";
  bodyFontSize: number;
  bodyLineHeight: number;
  bodyLetterSpacing: string;

  // Colors
  background: string;
  cardBg: string;
  textColor: string;
  secondaryText: string;
  accent: string;
  codeBg: string;
  quoteBorder: string;
  calloutBg: string;
  tableBorder: string;
  divider: string;
  watermark: string;

  // Layout & Decorations
  containerPaddingX: number;
  containerPaddingY: number;
  cardPaddingX: number;
  cardPaddingY: number;
  cardRadius: number;
  cardBorder: string;
  cardShadow: string;
  showDecorations: boolean;
  decorationColor: string;
  watermarkVisible: boolean;
}

export const CARD_THEMES: CardTheme[] = [
  // ── 1. Notion ────────────────────────────────────────────────
  {
    id: "notion",
    name: "Notion 白",
    nameEn: "Notion",
    description: "极简专业，文档感",
    tags: ["极简", "文档"],
    titleFont: "'Inter', 'Noto Sans SC', -apple-system, sans-serif",
    bodyFont: "'Inter', 'Noto Sans SC', -apple-system, sans-serif",
    codeFont: "'JetBrains Mono', 'SF Mono', monospace",
    titleFontSize: 28,
    titleFontWeight: 700,
    titleLineHeight: 1.3,
    titleLetterSpacing: "-0.02em",
    titleAlign: "left",
    bodyFontSize: 15,
    bodyLineHeight: 1.8,
    bodyLetterSpacing: "0",
    background: "#ffffff",
    cardBg: "#ffffff",
    textColor: "#37352f",
    secondaryText: "#9ca3af",
    accent: "#2d6cdf",
    codeBg: "#f5f5f5",
    quoteBorder: "#e5e7eb",
    calloutBg: "#f9fafb",
    tableBorder: "#e5e7eb",
    divider: "#e5e7eb",
    watermark: "#e0e0e0",
    containerPaddingX: 56,
    containerPaddingY: 56,
    cardPaddingX: 40,
    cardPaddingY: 36,
    cardRadius: 16,
    cardBorder: "1px solid #f0f0f0",
    cardShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.03)",
    showDecorations: false,
    decorationColor: "transparent",
    watermarkVisible: true,
  },

  // ── 2. Obsidian ──────────────────────────────────────────────
  {
    id: "obsidian",
    name: "Obsidian 夜",
    nameEn: "Obsidian",
    description: "深色模式，代码感",
    tags: ["深色", "技术"],
    titleFont: "'Inter', 'Noto Sans SC', -apple-system, sans-serif",
    bodyFont: "'Inter', 'Noto Sans SC', -apple-system, sans-serif",
    codeFont: "'JetBrains Mono', 'SF Mono', monospace",
    titleFontSize: 26,
    titleFontWeight: 700,
    titleLineHeight: 1.35,
    titleLetterSpacing: "-0.01em",
    titleAlign: "left",
    bodyFontSize: 15,
    bodyLineHeight: 1.8,
    bodyLetterSpacing: "0",
    background: "linear-gradient(160deg, #0d1117 0%, #161b22 50%, #0d1117 100%)",
    cardBg: "#161b22",
    textColor: "#e6edf3",
    secondaryText: "#7d8590",
    accent: "#58a6ff",
    codeBg: "#0d1117",
    quoteBorder: "#30363d",
    calloutBg: "#21262d",
    tableBorder: "#30363d",
    divider: "#30363d",
    watermark: "#6e7681",
    containerPaddingX: 56,
    containerPaddingY: 56,
    cardPaddingX: 40,
    cardPaddingY: 36,
    cardRadius: 16,
    cardBorder: "1px solid #30363d",
    cardShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
    showDecorations: true,
    decorationColor: "rgba(88,166,255,0.06)",
    watermarkVisible: true,
  },

  // ── 3. Medium ────────────────────────────────────────────────
  {
    id: "medium",
    name: "Medium 杂志",
    nameEn: "Medium",
    description: "衬线大标题，阅读感",
    tags: ["杂志", "阅读"],
    titleFont: "'Noto Serif SC', 'Georgia', 'Times New Roman', serif",
    bodyFont: "'Noto Serif SC', 'Georgia', 'Times New Roman', serif",
    codeFont: "'JetBrains Mono', 'SF Mono', monospace",
    titleFontSize: 34,
    titleFontWeight: 400,
    titleLineHeight: 1.2,
    titleLetterSpacing: "-0.01em",
    titleAlign: "center",
    bodyFontSize: 16,
    bodyLineHeight: 1.9,
    bodyLetterSpacing: "0.01em",
    background: "#faf9f6",
    cardBg: "#ffffff",
    textColor: "#292929",
    secondaryText: "#757575",
    accent: "#1a8917",
    codeBg: "#f7f7f7",
    quoteBorder: "#e5e5e5",
    calloutBg: "#f9f9f9",
    tableBorder: "#e5e5e5",
    divider: "#e5e5e5",
    watermark: "#d4d4d4",
    containerPaddingX: 64,
    containerPaddingY: 64,
    cardPaddingX: 48,
    cardPaddingY: 48,
    cardRadius: 4,
    cardBorder: "none",
    cardShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
    showDecorations: false,
    decorationColor: "transparent",
    watermarkVisible: true,
  },

  // ── 4. Kenya Hara ────────────────────────────────────────────
  {
    id: "kenya-hara",
    name: "原研哉·白",
    nameEn: "Kenya Hara",
    description: "极致留白，东方禅意",
    tags: ["极简", "设计"],
    titleFont: "'Noto Sans SC', 'Helvetica Neue', sans-serif",
    bodyFont: "'Noto Sans SC', 'Helvetica Neue', sans-serif",
    codeFont: "'JetBrains Mono', monospace",
    titleFontSize: 20,
    titleFontWeight: 300,
    titleLineHeight: 1.6,
    titleLetterSpacing: "0.15em",
    titleAlign: "left",
    bodyFontSize: 14,
    bodyLineHeight: 2.2,
    bodyLetterSpacing: "0.05em",
    background: "#fefefe",
    cardBg: "transparent",
    textColor: "#333333",
    secondaryText: "#999999",
    accent: "#888888",
    codeBg: "#f8f8f8",
    quoteBorder: "#dddddd",
    calloutBg: "#fafafa",
    tableBorder: "#eeeeee",
    divider: "#eeeeee",
    watermark: "#cccccc",
    containerPaddingX: 80,
    containerPaddingY: 80,
    cardPaddingX: 0,
    cardPaddingY: 0,
    cardRadius: 0,
    cardBorder: "none",
    cardShadow: "none",
    showDecorations: false,
    decorationColor: "transparent",
    watermarkVisible: false,
  },

  // ── 5. Typewriter ────────────────────────────────────────────
  {
    id: "typewriter",
    name: "复古打字机",
    nameEn: "Typewriter",
    description: "米黄纸张，文学气息",
    tags: ["复古", "文学"],
    titleFont: "'Courier Prime', 'FangSong', 'STFangsong', serif",
    bodyFont: "'Courier Prime', 'FangSong', 'STFangsong', serif",
    codeFont: "'Courier Prime', monospace",
    titleFontSize: 24,
    titleFontWeight: 700,
    titleLineHeight: 1.4,
    titleLetterSpacing: "0.02em",
    titleAlign: "left",
    bodyFontSize: 15,
    bodyLineHeight: 1.85,
    bodyLetterSpacing: "0.01em",
    background: "#f5f0e6",
    cardBg: "#faf6ed",
    textColor: "#3d3225",
    secondaryText: "#8a7e6b",
    accent: "#8b4513",
    codeBg: "#f0ebe0",
    quoteBorder: "#d4c9b8",
    calloutBg: "#f5f0e4",
    tableBorder: "#d4c9b8",
    divider: "#d4c9b8",
    watermark: "#d8cfc4",
    containerPaddingX: 56,
    containerPaddingY: 56,
    cardPaddingX: 40,
    cardPaddingY: 40,
    cardRadius: 2,
    cardBorder: "1px solid #e8e0d0",
    cardShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 0 60px rgba(139,69,19,0.02)",
    showDecorations: false,
    decorationColor: "transparent",
    watermarkVisible: true,
  },

  // ── 6. Neon ──────────────────────────────────────────────────
  {
    id: "neon",
    name: "霓虹渐变",
    nameEn: "Neon",
    description: "鲜艳渐变，视觉冲击",
    tags: ["渐变", "社交"],
    titleFont: "'Inter', 'Noto Sans SC', sans-serif",
    bodyFont: "'Inter', 'Noto Sans SC', sans-serif",
    codeFont: "'JetBrains Mono', monospace",
    titleFontSize: 36,
    titleFontWeight: 800,
    titleLineHeight: 1.15,
    titleLetterSpacing: "-0.02em",
    titleAlign: "center",
    bodyFontSize: 15,
    bodyLineHeight: 1.75,
    bodyLetterSpacing: "0",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 30%, #f093fb 70%, #f5576c 100%)",
    cardBg: "rgba(255,255,255,0.97)",
    textColor: "#1a1a2e",
    secondaryText: "#6b7280",
    accent: "#7c3aed",
    codeBg: "#f5f3ff",
    quoteBorder: "#ddd6fe",
    calloutBg: "#faf5ff",
    tableBorder: "#e9d5ff",
    divider: "#e9d5ff",
    watermark: "#c4b5fd",
    containerPaddingX: 56,
    containerPaddingY: 56,
    cardPaddingX: 44,
    cardPaddingY: 40,
    cardRadius: 24,
    cardBorder: "1px solid rgba(255,255,255,0.5)",
    cardShadow: "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.3)",
    showDecorations: true,
    decorationColor: "rgba(124,58,237,0.08)",
    watermarkVisible: true,
  },

  // ── 7. Academic ──────────────────────────────────────────────
  {
    id: "academic",
    name: "学术 LaTeX",
    nameEn: "Academic",
    description: "严谨排版，论文感",
    tags: ["学术", "严肃"],
    titleFont: "'Latin Modern Roman', 'Noto Serif SC', 'Times New Roman', serif",
    bodyFont: "'Latin Modern Roman', 'Noto Serif SC', 'Times New Roman', serif",
    codeFont: "'Latin Modern Mono', 'JetBrains Mono', monospace",
    titleFontSize: 22,
    titleFontWeight: 700,
    titleLineHeight: 1.4,
    titleLetterSpacing: "0",
    titleAlign: "center",
    bodyFontSize: 15,
    bodyLineHeight: 1.75,
    bodyLetterSpacing: "0",
    background: "#ffffff",
    cardBg: "#ffffff",
    textColor: "#000000",
    secondaryText: "#555555",
    accent: "#0066cc",
    codeBg: "#f8f8f8",
    quoteBorder: "#cccccc",
    calloutBg: "#fafafa",
    tableBorder: "#cccccc",
    divider: "#cccccc",
    watermark: "#bbbbbb",
    containerPaddingX: 64,
    containerPaddingY: 64,
    cardPaddingX: 48,
    cardPaddingY: 40,
    cardRadius: 0,
    cardBorder: "1px solid #e0e0e0",
    cardShadow: "none",
    showDecorations: false,
    decorationColor: "transparent",
    watermarkVisible: true,
  },

  // ── 8. Stationery ────────────────────────────────────────────
  {
    id: "stationery",
    name: "手账便签",
    nameEn: "Stationery",
    description: "温暖手写，生活气息",
    tags: ["手写", "温馨"],
    titleFont: "'ZCOOL XiaoWei', 'Ma Shan Zheng', 'Noto Sans SC', cursive",
    bodyFont: "'ZCOOL XiaoWei', 'Noto Sans SC', sans-serif",
    codeFont: "'JetBrains Mono', monospace",
    titleFontSize: 26,
    titleFontWeight: 400,
    titleLineHeight: 1.4,
    titleLetterSpacing: "0.04em",
    titleAlign: "left",
    bodyFontSize: 15,
    bodyLineHeight: 1.85,
    bodyLetterSpacing: "0.02em",
    background: "#fef9e7",
    cardBg: "#fffef5",
    textColor: "#4a4035",
    secondaryText: "#9a8e7e",
    accent: "#d97706",
    codeBg: "#faf5e6",
    quoteBorder: "#e8dcc8",
    calloutBg: "#fdf8ed",
    tableBorder: "#e8dcc8",
    divider: "#e8dcc8",
    watermark: "#ddd5c8",
    containerPaddingX: 52,
    containerPaddingY: 52,
    cardPaddingX: 36,
    cardPaddingY: 36,
    cardRadius: 12,
    cardBorder: "1px solid #f0e8d0",
    cardShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.8)",
    showDecorations: false,
    decorationColor: "transparent",
    watermarkVisible: true,
  },

  // ── 9. Poster ────────────────────────────────────────────────
  {
    id: "poster",
    name: "海报大字报",
    nameEn: "Poster",
    description: "冲击力强，短内容",
    tags: ["海报", "冲击"],
    titleFont: "'Inter', 'Noto Sans SC', sans-serif",
    bodyFont: "'Inter', 'Noto Sans SC', sans-serif",
    codeFont: "'JetBrains Mono', monospace",
    titleFontSize: 42,
    titleFontWeight: 900,
    titleLineHeight: 1.1,
    titleLetterSpacing: "-0.03em",
    titleAlign: "center",
    bodyFontSize: 16,
    bodyLineHeight: 1.7,
    bodyLetterSpacing: "0",
    background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    cardBg: "transparent",
    textColor: "#ffffff",
    secondaryText: "rgba(255,255,255,0.7)",
    accent: "#00d9ff",
    codeBg: "rgba(255,255,255,0.08)",
    quoteBorder: "rgba(255,255,255,0.2)",
    calloutBg: "rgba(255,255,255,0.05)",
    tableBorder: "rgba(255,255,255,0.15)",
    divider: "rgba(255,255,255,0.15)",
    watermark: "rgba(255,255,255,0.22)",
    containerPaddingX: 56,
    containerPaddingY: 56,
    cardPaddingX: 40,
    cardPaddingY: 40,
    cardRadius: 0,
    cardBorder: "none",
    cardShadow: "none",
    showDecorations: true,
    decorationColor: "rgba(0,217,255,0.1)",
    watermarkVisible: true,
  },
];

export type CardThemeId = (typeof CARD_THEMES)[number]["id"];

export function getCardTheme(themeId: CardThemeId): CardTheme {
  return CARD_THEMES.find((t) => t.id === themeId) ?? CARD_THEMES[0];
}

// ── Google Fonts Loader ────────────────────────────────────────
function getGoogleFontsUrl(): string {
  const families = [
    "Inter:wght@400;500;600;700;800;900",
    "Noto+Sans+SC:wght@300;400;500;600;700",
    "Noto+Serif+SC:wght@400;600;700",
    "JetBrains+Mono:wght@400;500",
    "Georgia",
    "Courier+Prime:wght@400;700",
    "ZCOOL+XiaoWei",
    "Ma+Shan+Zheng",
  ];
  return `https://fonts.googleapis.com/css2?family=${families.join("&family=")}&display=swap`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface WatermarkConfig {
  showWatermark: boolean;
  showBrand: boolean;
  showDate: boolean;
  showTime: boolean;
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  showWatermark: true,
  showBrand: true,
  showDate: true,
  showTime: false,
};

function getWatermarkHTML(
  theme: CardTheme,
  config: WatermarkConfig = DEFAULT_WATERMARK_CONFIG,
): string {
  if (!theme.watermarkVisible || !config.showWatermark) return "";

  const brandHtml = config.showBrand
    ? `<span class="gooseshot-watermark-brand">uTools - 鹅的笔记</span>`
    : "";

  let dateHtml = "";
  if (config.showDate) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = config.showTime
      ? ` ${now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`
      : "";
    dateHtml = `<div class="gooseshot-watermark-date">${dateStr}${timeStr}</div>`;
  }

  if (!brandHtml && !dateHtml) return "";

  return `<div class="gooseshot-watermark">
    <div class="gooseshot-watermark-left">${brandHtml}</div>
    ${dateHtml}
  </div>`;
}

// ── Styled HTML Builder ────────────────────────────────────────
function buildStyledHTML(params: {
  title: string;
  blocksHtml: string;
  theme: CardTheme;
  isSelection?: boolean;
  watermarkConfig?: WatermarkConfig;
}): string {
  const { title, blocksHtml, theme, isSelection, watermarkConfig } = params;
  const t = theme;

  const decoStyle = t.showDecorations
    ? `
    .gooseshot-container::before {
      content: '';
      position: absolute;
      top: -120px; right: -80px;
      width: 360px; height: 360px;
      background: radial-gradient(circle, ${t.decorationColor} 0%, transparent 70%);
      border-radius: 50%;
    }
    .gooseshot-container::after {
      content: '';
      position: absolute;
      bottom: -100px; left: -60px;
      width: 280px; height: 280px;
      background: radial-gradient(circle, ${t.decorationColor} 0%, transparent 70%);
      border-radius: 50%;
    }`
    : "";

  const titleStyle = `
    font-family: ${t.titleFont};
    font-size: ${t.titleFontSize}px;
    font-weight: ${t.titleFontWeight};
    line-height: ${t.titleLineHeight};
    letter-spacing: ${t.titleLetterSpacing};
    color: ${t.textColor};
    text-align: ${t.titleAlign};
  `;

  const headerBorder = "margin-bottom: 24px; padding-bottom: 0; border-bottom: none;";

  const bodyTextAlign = t.id === "academic" ? "text-align: justify;" : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="${getGoogleFontsUrl()}">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: ${t.bodyFont};
  color: ${t.textColor};
  line-height: ${t.bodyLineHeight};
  font-size: ${t.bodyFontSize}px;
  letter-spacing: ${t.bodyLetterSpacing};
  ${bodyTextAlign}
}
.gooseshot-container {
  background: ${t.background};
  padding: ${t.containerPaddingY}px ${t.containerPaddingX}px;
  min-width: 680px;
  max-width: 1200px;
  position: relative;
  overflow: hidden;
}
${decoStyle}
.gooseshot-card {
  background: ${t.cardBg};
  border-radius: ${t.cardRadius}px;
  padding: ${t.cardPaddingY}px ${t.cardPaddingX}px;
  box-shadow: ${t.cardShadow};
  position: relative;
  z-index: 1;
  border: ${t.cardBorder};
}
.gooseshot-header {
  ${headerBorder}
}
.gooseshot-title {
  ${titleStyle}
}
.gooseshot-content > * { margin-bottom: 14px; }
.gooseshot-content > *:last-child { margin-bottom: 0; }
.gooseshot-content h1 {
  font-family: ${t.titleFont};
  font-size: ${Math.round(t.titleFontSize * 0.85)}px;
  font-weight: ${t.titleFontWeight};
  margin-top: 28px;
  margin-bottom: 14px;
  color: ${t.textColor};
  line-height: 1.3;
}
.gooseshot-content h2 {
  font-family: ${t.titleFont};
  font-size: ${Math.round(t.titleFontSize * 0.7)}px;
  font-weight: ${Math.max(t.titleFontWeight - 100, 400)};
  margin-top: 24px;
  margin-bottom: 12px;
  color: ${t.textColor};
}
.gooseshot-content h3 {
  font-family: ${t.titleFont};
  font-size: ${Math.round(t.titleFontSize * 0.6)}px;
  font-weight: 600;
  margin-top: 20px;
  margin-bottom: 10px;
  color: ${t.textColor};
}
.gooseshot-content p {
  margin-bottom: 12px;
  line-height: ${t.bodyLineHeight};
}
.gooseshot-content ul, .gooseshot-content ol {
  margin-bottom: 12px;
  padding-left: 22px;
}
.gooseshot-content li {
  margin-bottom: 5px;
  line-height: 1.75;
}
.gooseshot-content ul li::marker { color: ${t.secondaryText}; }
.gooseshot-content code {
  font-family: ${t.codeFont};
  font-size: 0.86em;
  background: ${t.codeBg};
  padding: 2px 6px;
  border-radius: 4px;
  color: ${t.textColor};
}
.gooseshot-content pre {
  background: ${t.codeBg};
  border-radius: 10px;
  padding: 16px 18px;
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid ${t.tableBorder};
}
.gooseshot-content pre code {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.7;
  font-family: ${t.codeFont};
}
.gooseshot-content blockquote {
  border-left: 3px solid ${t.quoteBorder};
  padding-left: 18px;
  margin: 16px 0;
  color: ${t.secondaryText};
  font-style: italic;
}
.gooseshot-content img {
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  margin: 16px 0;
}
.gooseshot-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 14px;
}
.gooseshot-content th, .gooseshot-content td {
  border: 1px solid ${t.tableBorder};
  padding: 8px 12px;
  text-align: left;
}
.gooseshot-content th {
  background: ${t.codeBg};
  font-weight: 600;
}
.gooseshot-content hr {
  border: none;
  border-top: 1px solid ${t.divider};
  margin: 20px 0;
}
.gooseshot-content .callout {
  background: ${t.calloutBg};
  border-radius: 10px;
  padding: 14px 18px;
  margin: 14px 0;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.gooseshot-content .callout-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}
.gooseshot-content .callout-text {
  flex: 1;
  line-height: 1.75;
}
.gooseshot-watermark {
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid ${t.divider};
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.gooseshot-watermark-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gooseshot-watermark-icon {
  font-size: 16px;
  line-height: 1;
}
.gooseshot-watermark-brand {
  color: ${t.watermark};
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.gooseshot-watermark-date {
  color: ${t.watermark};
  font-size: 11px;
  font-weight: 400;
}
.gooseshot-content strong { font-weight: 600; }
.gooseshot-content em { font-style: italic; }
.gooseshot-content del { text-decoration: line-through; }
.gooseshot-content a {
  color: ${t.accent};
  text-decoration: none;
}
.gooseshot-content a:hover { text-decoration: underline; }
.gooseshot-content .task-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 5px;
}
.gooseshot-content .task-checkbox {
  width: 16px;
  height: 16px;
  border: 2px solid ${t.tableBorder};
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gooseshot-content .task-checkbox.checked {
  background: ${t.accent};
  border-color: ${t.accent};
}
.gooseshot-content .task-checkbox.checked::after {
  content: '✓';
  color: white;
  font-size: 11px;
}
.gooseshot-selection-tag {
  display: inline-block;
  background: ${t.accent}15;
  color: ${t.accent};
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 12px;
  letter-spacing: 0.02em;
}
</style>
</head>
<body>
<div class="gooseshot-container">
  <div class="gooseshot-card">
    <div class="gooseshot-header">
      <div class="gooseshot-title">${escapeHtml(title || "无标题")}</div>
    </div>
    <div class="gooseshot-content">
      ${blocksHtml}
    </div>
    ${getWatermarkHTML(theme, watermarkConfig)}
  </div>
</div>
</body>
</html>`;
}

// ── Block Renderer ─────────────────────────────────────────────
function renderBlock(block: any, theme: CardTheme): string {
  if (!block || typeof block !== "object") return "";

  const inlineHtml = renderInline(block.content);
  const alignStyle = block.props?.textAlignment === "center"
    ? ' style="text-align:center"'
    : block.props?.textAlignment === "right"
      ? ' style="text-align:right"'
      : block.props?.textAlignment === "justify"
        ? ' style="text-align:justify"'
        : "";

  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(block.props?.level || 1, 1), 3);
      return `<h${level}${alignStyle}>${inlineHtml}</h${level}>`;
    }

    case "bulletListItem": {
      const children = block.children?.length
        ? `<ul>${block.children.map((c: any) => renderBlock(c, theme)).join("")}</ul>`
        : "";
      return `<li${alignStyle}>${inlineHtml}${children}</li>`;
    }

    case "numberedListItem": {
      const children = block.children?.length
        ? `<ol>${block.children.map((c: any) => renderBlock(c, theme)).join("")}</ol>`
        : "";
      return `<li${alignStyle}>${inlineHtml}${children}</li>`;
    }

    case "checkListItem": {
      const checked = block.props?.checked;
      const checkboxClass = checked ? "task-checkbox checked" : "task-checkbox";
      return `<div class="task-item"${alignStyle}><div class="${checkboxClass}"></div><span>${inlineHtml}</span></div>`;
    }

    case "codeBlock": {
      const lang = block.props?.language || "";
      const code = block.content || "";
      const codeStr = typeof code === "string"
        ? escapeHtml(code)
        : Array.isArray(code)
          ? code.map((c: any) => escapeHtml(typeof c === "string" ? c : c?.text || "")).join("")
          : escapeHtml(String(code));
      return `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${codeStr}</code></pre>`;
    }

    case "quote": {
      return `<blockquote${alignStyle}>${inlineHtml}</blockquote>`;
    }

    case "paragraph": {
      return inlineHtml ? `<p${alignStyle}>${inlineHtml}</p>` : `<p${alignStyle}></p>`;
    }

    case "image":
    case "imageResize":
    case "file": {
      const src = block.props?.url || block.props?.src || "";
      const alt = block.props?.caption || block.props?.alt || block.props?.name || "";
      if (!src) return "";
      const alignment = block.props?.textAlignment || block.props?.alignment;
      const alignStyle = alignment === "center" ? "display:block;margin-left:auto;margin-right:auto;"
        : alignment === "right" ? "display:block;margin-left:auto;"
        : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${alignStyle}" />`;
    }

    case "table": {
      const rows = block.content?.rows || [];
      if (!rows.length) return "";
      const htmlRows = rows.map((row: any, i: number) => {
        const cells = row.cells || [];
        const tag = i === 0 ? "th" : "td";
        return `<tr>${cells.map((cell: any) => {
          const text = typeof cell === "string" ? cell : extractCellTextForHtml(cell);
          return `<${tag}>${escapeHtml(text)}</${tag}>`;
        }).join("")}</tr>`;
      });
      return `<table><tbody>${htmlRows.join("")}</tbody></table>`;
    }

    case "divider": {
      return `<hr />`;
    }

    case "callout": {
      const icon = block.props?.icon || block.props?.emoji || "💡";
      return `<div class="callout"><div class="callout-icon">${escapeHtml(icon)}</div><div class="callout-text">${inlineHtml}</div></div>`;
    }

    case "bulletList": {
      const items = block.content || [];
      return `<ul>${items.map((item: any) => renderBlock(item, theme)).join("")}</ul>`;
    }

    case "orderedList": {
      const items = block.content || [];
      return `<ol>${items.map((item: any) => renderBlock(item, theme)).join("")}</ol>`;
    }

    default: {
      return inlineHtml ? `<p${alignStyle}>${inlineHtml}</p>` : "";
    }
  }
}

function renderInline(content: unknown): string {
  if (typeof content === "string") return escapeHtml(content).replace(/\n/g, "<br>");
  if (!Array.isArray(content)) return "";

  return content
    .map((item: any) => {
      if (typeof item === "string") return escapeHtml(item).replace(/\n/g, "<br>");
      if (!item || typeof item !== "object") return "";

      // Handle inline image nodes (e.g. pasted/dragged images within text)
      if (item.type === "image" && item.attrs?.src) {
        const src = item.attrs.src;
        const alt = item.attrs.alt || "";
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;border-radius:8px;display:inline-block;vertical-align:middle;" />`;
      }

      let text = escapeHtml(item.text || "").replace(/\n/g, "<br>");
      const styles = item.styles || {};
      const marks = item.marks || [];

      let wrapper = text;

      if (styles.bold || marks.some((m: any) => m?.type === "bold")) {
        wrapper = `<strong>${wrapper}</strong>`;
      }
      if (styles.italic || marks.some((m: any) => m?.type === "italic")) {
        wrapper = `<em>${wrapper}</em>`;
      }
      if (styles.underline || marks.some((m: any) => m?.type === "underline")) {
        wrapper = `<u>${wrapper}</u>`;
      }
      if (styles.strike || marks.some((m: any) => m?.type === "strike")) {
        wrapper = `<del>${wrapper}</del>`;
      }
      if (styles.code || marks.some((m: any) => m?.type === "code")) {
        wrapper = `<code>${wrapper}</code>`;
      }

      if (item.type === "link" && item.href) {
        wrapper = `<a href="${escapeHtml(item.href)}">${wrapper}</a>`;
      }

      const linkMark = marks.find((m: any) => m?.type === "link");
      if (linkMark?.attrs?.href && item.type !== "link") {
        wrapper = `<a href="${escapeHtml(linkMark.attrs.href)}">${wrapper}</a>`;
      }

      const textColor =
        styles.textColor ||
        marks.find((m: any) => m?.type === "textColor")?.attrs?.color ||
        marks.find((m: any) => m?.type === "textStyle")?.attrs?.color ||
        styles.color;
      if (textColor) {
        wrapper = `<span style="color:${escapeHtml(textColor)}">${wrapper}</span>`;
      }

      const bgColor =
        styles.backgroundColor ||
        marks.find((m: any) => m?.type === "backgroundColor")?.attrs?.color ||
        marks.find((m: any) => m?.type === "highlight")?.attrs?.color;
      if (bgColor) {
        wrapper = `<span style="background-color:${escapeHtml(bgColor)};border-radius:2px;padding:0 2px;">${wrapper}</span>`;
      }

      if (item.type === "inlineMath" && item.attrs?.value) {
        wrapper = `<code>${escapeHtml(item.attrs.value)}</code>`;
      }

      return wrapper;
    })
    .join("");
}

function extractInlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item: any) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      if (item.type === "inlineMath" && item.attrs?.value) {
        return item.attrs.value;
      }
      return item.text || "";
    })
    .join("");
}

function extractCellTextForHtml(cell: any): string {
  if (typeof cell === "string") return cell;
  if (Array.isArray(cell)) {
    return cell.map((c: any) => {
      if (typeof c === "string") return c;
      if (c?.text) return c.text;
      return "";
    }).join("");
  }
  if (cell?.text) return cell.text;
  if (cell?.content) {
    if (typeof cell.content === "string") return cell.content;
    if (Array.isArray(cell.content)) {
      return cell.content.map((c: any) => {
        if (typeof c === "string") return c;
        if (c?.text) return c.text;
        return "";
      }).join("");
    }
  }
  return "";
}

// ── Core Capture Logic ─────────────────────────────────────────
function createLoadingOverlay(): HTMLElement {
  const overlay = document.createElement("div");
  overlay.id = "goose-image-export-loading";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.35); backdrop-filter: blur(2px);
    transition: opacity 0.2s ease;
  `;
  overlay.innerHTML = `
    <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:goose-spin 0.8s linear infinite;"></div>
    <div style="margin-top:16px;color:#fff;font-size:14px;font-weight:500;letter-spacing:0.02em;">正在生成图片</div>
    <style>@keyframes goose-spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function removeLoadingOverlay(): void {
  const overlay = document.getElementById("goose-image-export-loading");
  if (!overlay) return;
  overlay.style.opacity = "0";
  setTimeout(() => overlay.remove(), 200);
}

async function captureElementToPng(element: HTMLElement, filename: string) {
  const overlay = createLoadingOverlay();

  try {
    await Promise.all([
      document.fonts.ready,
      waitForImages(element),
    ]);

    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    const dataUrl = await toPng(element, {
      pixelRatio: 4,
      quality: 0.92,
      cacheBust: true,
      skipFonts: false,
      imagePlaceholder:
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7lr4bnoIHnvJbnsbvlkI7lj5bor4E8L3RleHQ+PC9zdmc+",
    });

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const { saveBlobAndReveal } = await import("./export");
    const saved = await saveBlobAndReveal(blob, filename);
    const { toast } = await import("sonner");
    if (saved) {
      toast.success("图片已保存到下载文件夹");
    } else {
      throw new Error("保存图片失败");
    }
  } catch (error) {
    const { toast } = await import("sonner");
    toast.error("导出图片失败，请重试");
    console.error("[imageExport] capture failed:", error);
  } finally {
    removeLoadingOverlay();
  }
}

function waitForImages(container: HTMLElement): Promise<void> {
  const images = container.querySelectorAll("img");
  if (images.length === 0) return Promise.resolve();

  const promises = Array.from(images).map((img) => {
    return new Promise<void>((resolve) => {
      if (img.complete) { resolve(); return; }
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(() => resolve(), 500);
    });
  });

  return Promise.all(promises).then(() => {});
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

// ── Public API: Full Page Export ───────────────────────────────
export async function exportPageToImage(
  page: Page,
  themeId: CardThemeId = "notion",
  watermarkConfig?: WatermarkConfig,
) {
  const theme = getCardTheme(themeId);
  const title = extractTitleFromContent(page.content);
  const content = page.content as BlockNoteContent;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  try {
    // 跳过第一个 heading，避免标题重复
    const firstBlock = content[0];
    const blocksToRender = firstBlock?.type === "heading" ? content.slice(1) : content;
    const blocksHtml = blocksToRender.map((block: any) => renderBlock(block, theme)).join("\n");
    const html = buildStyledHTML({ title, blocksHtml, theme, watermarkConfig });
    container.innerHTML = html;

    const cardElement = container.querySelector(".gooseshot-container") as HTMLElement;
    if (!cardElement) throw new Error("Failed to create preview element");

    await captureElementToPng(cardElement, `${sanitizeFileName(title || "untitled")}.png`);
    trackEvent("share_image_full", { page_title_length: title?.length ?? 0, theme: themeId });
  } finally {
    document.body.removeChild(container);
  }
}

// ── Public API: Selection Export ───────────────────────────────
async function resolveImageUrls(blocks: any[]): Promise<void> {
  for (const block of blocks) {
    if ((block.type === "image" || block.type === "imageResize" || block.type === "file") && block.props?.url) {
      const url = block.props.url;
      if (url.startsWith("att:")) {
        try {
          const { imageStorage } = await import("./imageStorage");
          const blob = await imageStorage.load(url);
          if (blob) {
            block.props.url = URL.createObjectURL(blob);
          }
        } catch { /* use original url */ }
      }
    }
    // Also resolve inline images
    if (Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item?.type === "image" && item.attrs?.src?.startsWith("att:")) {
          try {
            const { imageStorage } = await import("./imageStorage");
            const blob = await imageStorage.load(item.attrs.src);
            if (blob) {
              item.attrs.src = URL.createObjectURL(blob);
            }
          } catch { /* use original url */ }
        }
      }
    }
    if (Array.isArray(block.children)) {
      await resolveImageUrls(block.children);
    }
  }
}

export async function exportSelectionToImage(
  selectionBlocks: BlockNoteContent,
  pageTitle?: string,
  themeId: CardThemeId = "notion",
  watermarkConfig?: WatermarkConfig,
) {
  if (!Array.isArray(selectionBlocks) || selectionBlocks.length === 0) return;

  const theme = getCardTheme(themeId);
  const title = pageTitle || "选中内容";

  // Deep clone to avoid mutating the original blocks
  const clonedBlocks = JSON.parse(JSON.stringify(selectionBlocks)) as any[];
  await resolveImageUrls(clonedBlocks);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  try {
    const blocksHtml = clonedBlocks
      .map((block: any) => renderBlock(block, theme))
      .join("\n");

    const html = buildStyledHTML({
      title,
      blocksHtml,
      theme,
      isSelection: true,
      watermarkConfig,
    });
    container.innerHTML = html;

    const cardElement = container.querySelector(".gooseshot-container") as HTMLElement;
    if (!cardElement) throw new Error("Failed to create preview element");

    await captureElementToPng(cardElement, `${sanitizeFileName(title)}_选中内容.png`);
    const selectionLength = selectionBlocks
      .map((block: any) => extractInlineText(block.content))
      .join("\n").length;
    trackEvent("share_image_selection", { selection_length: selectionLength, theme: themeId });
  } finally {
    document.body.removeChild(container);
  }
}

// ── Legacy alias ───────────────────────────────────────────────
export async function exportToImage(page: Page, themeId: CardThemeId = "notion") {
  return exportPageToImage(page, themeId);
}
