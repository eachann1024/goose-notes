export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const DEFAULT_FONT_NAMES = {
  default: SYSTEM_FONT_STACK,
  serif: "仓耳今楷",
  mono: "DM Mono",
} as const;

/** 本机安装时的常见 family / 文件名，先于远端。 */
export const CANGER_JINKAI_LOCAL_NAMES = [
  "仓耳今楷",
  "仓耳今楷03W04",
  "仓耳今楷03简繁 W04",
  "TsangerJinKai03-W04",
] as const;

export const SERIF_LOCAL_FALLBACKS = [
  "Songti SC",
  "STSong",
  "SimSun",
  "Cambria",
];

/** 钉 commit 的仓耳今楷 woff2：国内镜像优先，再 jsDelivr / GitHub raw。不要拷进项目。 */
const CANGER_JINKAI_WOFF2_URLS = [
  "https://cdn.jsdmirror.com/gh/eachann1024/Resources@d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2",
  "https://cdn.jsdelivr.net/gh/eachann1024/Resources@d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2",
  "https://raw.githubusercontent.com/eachann1024/Resources/d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2",
] as const;

/** 仓耳今楷仅在用户选择衬线体时按需加载。 */
export const REMOTE_FONT_SOURCES = {
  仓耳今楷: CANGER_JINKAI_WOFF2_URLS,
} as const;

export const UI_MONO_FALLBACKS = [
  "ui-monospace",
  "Menlo",
  "Consolas",
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "Noto Sans SC",
];

export type PersistentWoff2Family = "仓耳今楷";

export const trimFontName = (font: string) =>
  font.trim().replace(/^["']+|["']+$/g, "");

export const splitFontList = (font: string | null | undefined) =>
  font ? font.split(",").map(trimFontName).filter(Boolean) : [];

const GENERIC_FAMILIES = new Set(
  [
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded",
    "emoji",
    "math",
    "fangsong",
    "inherit",
    "initial",
    "unset",
    "-apple-system",
    "BlinkMacSystemFont",
  ].map((family) => family.toLowerCase()),
);

const formatFontFamily = (family: string) => {
  const trimmed = trimFontName(family);
  if (!trimmed) return null;
  if (GENERIC_FAMILIES.has(trimmed.toLowerCase())) return trimmed;
  return `"${trimmed}"`;
};

/** 生成可写入 CSS font-family 的单项（泛型族不加引号）。 */
export const toCssFontFamily = (family: string) =>
  family.trim() === SYSTEM_FONT_STACK
    ? SYSTEM_FONT_STACK
    : (formatFontFamily(family) ?? family);

export function normalizeLocalFontName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return value.length <= 80 && /^[\p{L}\p{N} ._+-]+$/u.test(value) && name
    ? value
    : null;
}

/** Probe a locally installed face without mistaking the CSS fallback for a match. */
export async function isLocalFontAvailable(value: string): Promise<boolean> {
  const name = normalizeLocalFontName(value);
  if (!name) return false;
  if (GENERIC_FAMILIES.has(name.toLowerCase())) return true;
  try {
    await new FontFace("goose-local-font-probe", `local("${name}")`).load();
    return true;
  } catch {
    return false;
  }
}

const normalizeFontList = (families: string[]) =>
  Array.from(
    new Set(
      families
        .map(formatFontFamily)
        .filter((value): value is string => Boolean(value)),
    ),
  );

export const buildFontStack = (
  customList: string[],
  defaultFont: string,
  baseFallbacks: string[],
  platformFallbacks: string[],
  generic: string,
) =>
  joinFonts(
    normalizeFontList([
      ...(customList.length ? customList : splitFontList(defaultFont)),
      ...baseFallbacks,
      ...platformFallbacks,
      generic,
    ]),
  );

export const getPlatformFallbacks = () => {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform || "" : "";
  const isMac = /Mac|iPod|iPhone|iPad/.test(platform);
  const isWin = /Win/.test(platform);

  if (isMac) {
    return {
      serif: ["Georgia", "Times"],
    };
  }

  if (isWin) {
    return {
      serif: ['"Times New Roman"', "Georgia", "Times"],
    };
  }

  return {
    serif: ["Georgia", "Times"],
  };
};

const joinFonts = (fonts: string[]) => fonts.filter(Boolean).join(", ");
