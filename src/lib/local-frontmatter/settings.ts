import type { FontFamily, PageLayout } from "@/types";

export const GOOSE_LAYOUT_KEY = "goose-layout";
export const GOOSE_FONT_KEY = "goose-font";
export const GOOSE_LOCKED_KEY = "goose-locked";
export const GOOSE_PINNED_KEY = "goose-pinned";
export const GOOSE_FAVORITE_KEY = "goose-favorite";

/** 会写入 / 从 frontmatter 恢复的 Page 字段 */
export const LOCAL_PAGE_FRONTMATTER_SETTINGS_KEYS = [
  "fontFamily",
  "pageLayout",
  "isLocked",
  "isPinned",
  "isFavorite",
] as const;

export type LocalPageFrontmatterSettingsKey =
  (typeof LOCAL_PAGE_FRONTMATTER_SETTINGS_KEYS)[number];

export type LocalPageFrontmatterSettings = {
  fontFamily: FontFamily;
  pageLayout?: PageLayout;
  isLocked: boolean;
  isPinned: boolean;
  isFavorite: boolean;
};

export const DEFAULT_SETTINGS: LocalPageFrontmatterSettings = {
  fontFamily: "default",
  pageLayout: undefined,
  isLocked: false,
  isPinned: false,
  isFavorite: false,
};

export const VALID_FONTS = new Set<FontFamily>(["default", "serif", "mono"]);

export function isLocalPageFrontmatterSettingsUpdate(
  updates: Partial<Record<string, unknown>>,
): boolean {
  return LOCAL_PAGE_FRONTMATTER_SETTINGS_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(updates, key),
  );
}

export function normalizePageLayout(value: unknown): PageLayout {
  return value === "full" ? "full" : "standard";
}

function normalizeFont(value: unknown): FontFamily {
  if (typeof value !== "string") return "default";
  const trimmed = value.trim().toLowerCase();
  // 兼容早期/手写 default、sans
  if (trimmed === "sans" || trimmed === "default") return "default";
  if (trimmed === "serif" || trimmed === "mono") return trimmed;
  return "default";
}

function normalizeLocked(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (t === "true" || t === "yes" || t === "1") return true;
    if (t === "false" || t === "no" || t === "0" || t === "") return false;
  }
  return Boolean(value);
}

function normalizePinned(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (t === "true" || t === "yes" || t === "1") return true;
    if (t === "false" || t === "no" || t === "0" || t === "") return false;
  }
  return Boolean(value);
}

function normalizeFavorite(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (t === "true" || t === "yes" || t === "1") return true;
    if (t === "false" || t === "no" || t === "0" || t === "") return false;
  }
  return Boolean(value);
}

export function settingsFromData(
  data: Record<string, unknown>,
): LocalPageFrontmatterSettings {
  const fontRaw = data[GOOSE_FONT_KEY];
  const lockedRaw = data[GOOSE_LOCKED_KEY];
  const pinnedRaw = data[GOOSE_PINNED_KEY];
  const favoriteRaw = data[GOOSE_FAVORITE_KEY];
  return {
    pageLayout:
      data[GOOSE_LAYOUT_KEY] === undefined
        ? undefined
        : normalizePageLayout(data[GOOSE_LAYOUT_KEY]),
    fontFamily: fontRaw === undefined ? "default" : normalizeFont(fontRaw),
    isLocked: lockedRaw === undefined ? false : normalizeLocked(lockedRaw),
    isPinned: pinnedRaw === undefined ? false : normalizePinned(pinnedRaw),
    isFavorite:
      favoriteRaw === undefined ? false : normalizeFavorite(favoriteRaw),
  };
}
