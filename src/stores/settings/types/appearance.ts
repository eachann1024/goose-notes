export type Theme = "light" | "dark" | "system";

export const ACCENT_COLORS = [
  "ocean",
  "mono",
  "iris",
  "pine",
  "amber",
  "wheat",
  "coral",
  "rose",
  "grape",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const DEFAULT_ACCENT_COLOR: AccentColor = "ocean";

export type CodeTheme = "github-light" | "github-dark";

export interface FontConfig {
  label: string | null;
  font: string | null;
}

export interface CustomFonts {
  default: FontConfig;
  serif: FontConfig;
  mono: FontConfig;
}

// 界面缩放百分比：界面和侧栏同步，正文保持独立字号。
export type UIFontSize = number;

export const UI_SCALE_MIN = 85;

export const UI_SCALE_MAX = 130;

export const UI_FONT_SIZE_BASE = 14;

export function clampFontSize(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

// 编辑器字体大小边界
export const EDITOR_FONT_SIZE_MIN = 12;

export const EDITOR_FONT_SIZE_MAX = 24;

export const EDITOR_FONT_SIZE_DEFAULT = 17;

export const EDITOR_LINE_HEIGHT_MIN = 1.2;

export const EDITOR_LINE_HEIGHT_MAX = 2.4;

export const EDITOR_LINE_HEIGHT_DEFAULT = 1.5;

export function normalizeEditorLineHeight(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    return EDITOR_LINE_HEIGHT_DEFAULT;
  return (
    Math.round(
      Math.min(
        EDITOR_LINE_HEIGHT_MAX,
        Math.max(EDITOR_LINE_HEIGHT_MIN, value),
      ) * 100,
    ) / 100
  );
}

// 侧栏字体大小边界（与编辑器字号独立持久化）
export const SIDEBAR_FONT_SIZE_MIN = 12;

export const SIDEBAR_FONT_SIZE_MAX = 18;

export const SIDEBAR_FONT_SIZE_DEFAULT = 13;

export function normalizeEditorFontSize(value: unknown): number {
  return clampFontSize(
    value,
    EDITOR_FONT_SIZE_MIN,
    EDITOR_FONT_SIZE_MAX,
    EDITOR_FONT_SIZE_DEFAULT,
  );
}

export function normalizeSidebarFontSize(value: unknown): number {
  return clampFontSize(
    value,
    SIDEBAR_FONT_SIZE_MIN,
    SIDEBAR_FONT_SIZE_MAX,
    SIDEBAR_FONT_SIZE_DEFAULT,
  );
}

export const DEFAULT_UI_FONT_SIZE: UIFontSize = 100;

export function normalizeAccentColor(accentColor: unknown): AccentColor {
  if (accentColor === "teal") return "mono";
  return typeof accentColor === "string" &&
    (ACCENT_COLORS as readonly string[]).includes(accentColor)
    ? (accentColor as AccentColor)
    : DEFAULT_ACCENT_COLOR;
}

export function resolveCodeTheme(isDark: boolean): CodeTheme {
  return isDark ? "github-dark" : "github-light";
}

export function normalizeUIFontSize(value: unknown): UIFontSize {
  // 兼容旧版三档设置，保留用户原来的界面大小。
  if (value === "small") return 100;
  if (value === "normal") return 114;
  if (value === "large") return 129;
  return clampFontSize(value, UI_SCALE_MIN, UI_SCALE_MAX, DEFAULT_UI_FONT_SIZE);
}
