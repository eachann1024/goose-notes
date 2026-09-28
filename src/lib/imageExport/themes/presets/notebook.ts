import {
  getEditorFontFamilies,
  SYSTEM_FONT_STACK,
  toCssFontFamily,
} from "@/lib/fontLoader";
import { EDITOR_FONT_SIZE_DEFAULT, type CustomFonts } from "@/stores/settings/types";
import type { FontFamily } from "@/types";
import type { CardTheme } from "../types";

export interface NotebookCardThemeContext {
  fontFamily?: FontFamily;
  customFonts?: CustomFonts;
  editorFontSize?: number;
  resolvedTheme?: "light" | "dark";
}

const DEFAULT_CUSTOM_FONTS: CustomFonts = {
  default: { label: null, font: null },
  serif: { label: null, font: null },
  mono: { label: null, font: null },
};

const LIGHT_PAGE_FONT = SYSTEM_FONT_STACK;
const LIGHT_CODE_FONT =
  'ui-monospace, "DM Mono", Menlo, Consolas, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", monospace';

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function cssColor(value: string, fallback: string): string {
  const raw = value.trim();
  if (!raw) return fallback;
  if (
    raw.startsWith("#") ||
    raw.startsWith("rgb") ||
    raw.startsWith("hsl") ||
    raw.startsWith("oklch") ||
    raw.startsWith("var(")
  ) {
    return raw;
  }
  return `hsl(${raw})`;
}

function joinFontStack(families: string[]): string {
  return families.map((family) => toCssFontFamily(family)).join(", ");
}

/** 静态浅色 fallback：无 DOM / 无页面上下文时仍可导出。 */
export const NOTEBOOK_THEME: CardTheme = {
  id: "notebook",
  name: "笔记本",
  nameEn: "Notebook",
  description: "所见即所得",
  tags: ["当前", "编辑器"],
  mode: "light",
  titleFont: LIGHT_PAGE_FONT,
  bodyFont: LIGHT_PAGE_FONT,
  codeFont: LIGHT_CODE_FONT,
  titleFontSize: 26,
  titleFontWeight: 700,
  titleLineHeight: 1.3,
  titleLetterSpacing: "-0.02em",
  titleAlign: "left",
  bodyFontSize: 16,
  bodyLineHeight: 1.7,
  bodyLetterSpacing: "0",
  background: "#ffffff",
  cardBg: "#ffffff",
  textColor: "#1f1f1f",
  secondaryText: "#6e6e6e",
  accent: "#2563eb",
  codeBg: "#f3f2f1",
  quoteBorder: "#e8e7e5",
  calloutBg: "#f7f6f3",
  tableBorder: "#e8e7e5",
  divider: "#e9e9e7",
  watermark: "#d4d4d4",
  containerPaddingX: 28,
  containerPaddingY: 28,
  cardPaddingX: 40,
  cardPaddingY: 36,
  cardRadius: 12,
  cardBorder: "1px solid #e9e9e7",
  cardShadow: "0 1px 2px rgba(15,23,42,0.04)",
  showDecorations: false,
  decorationColor: "transparent",
  watermarkVisible: true,
};

export function buildNotebookCardTheme(
  ctx: NotebookCardThemeContext = {},
): CardTheme {
  const isDark = ctx.resolvedTheme === "dark";
  const editorFontSize = ctx.editorFontSize ?? EDITOR_FONT_SIZE_DEFAULT;
  const customFonts = ctx.customFonts ?? DEFAULT_CUSTOM_FONTS;
  const fontFamily = ctx.fontFamily ?? "default";
  const pageFonts = joinFontStack(
    getEditorFontFamilies(fontFamily, customFonts),
  );
  const fontVar =
    fontFamily === "serif"
      ? "--font-serif"
      : fontFamily === "mono"
        ? "--font-mono"
        : "--font-default";
  const cssPageFont = readCssVar(fontVar, pageFonts) || pageFonts;
  const cssMonoFont =
    readCssVar("--font-mono", "") ||
    joinFontStack(getEditorFontFamilies("mono", customFonts));

  const accent = readCssVar(
    "--goose-interactive-selected-fg",
    isDark ? "#93c5fd" : "#2563eb",
  );
  const calloutBg = readCssVar(
    "--goose-callout-bg",
    isDark ? "#2f2f2f" : "#f7f6f3",
  );
  const calloutBorder = readCssVar(
    "--goose-callout-border",
    isDark ? "#3d3d3d" : "#e9e9e7",
  );
  const codeBg = readCssVar(
    "--goose-block-subtle-bg",
    isDark ? "#252525" : "#f3f2f1",
  );
  const subtleBorder = readCssVar(
    "--goose-block-subtle-border",
    isDark ? "#363636" : "#e8e7e5",
  );
  const textColor = cssColor(
    readCssVar("--foreground", isDark ? "0 0% 90%" : "0 0% 12%"),
    isDark ? "#e6e6e6" : "#1f1f1f",
  );
  const secondaryText = cssColor(
    readCssVar("--muted-foreground", isDark ? "0 0% 66%" : "0 0% 43%"),
    isDark ? "#a8a8a8" : "#6e6e6e",
  );
  const background = isDark
    ? cssColor(readCssVar("--goose-editor-bg", "60 2.2% 18%"), "#2f2f2e")
    : "#ffffff";

  return {
    ...NOTEBOOK_THEME,
    mode: isDark ? "dark" : "light",
    titleFont: cssPageFont,
    bodyFont: cssPageFont,
    codeFont: cssMonoFont,
    titleFontSize: Math.round(editorFontSize * 1.625),
    bodyFontSize: editorFontSize,
    background,
    cardBg: background,
    textColor,
    secondaryText,
    accent,
    codeBg,
    quoteBorder: subtleBorder,
    calloutBg,
    tableBorder: subtleBorder,
    divider: calloutBorder,
    watermark: isDark ? "#6e6e6e" : "#d4d4d4",
    cardBorder: `1px solid ${calloutBorder}`,
    cardShadow: isDark ? "none" : NOTEBOOK_THEME.cardShadow,
  };
}
