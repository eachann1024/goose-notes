import type { CustomFonts } from "@/stores/useSettings";

export const DEFAULT_FONT_NAMES = {
  default: "ui-sans-serif",
  serif: "仓耳今楷",
  mono: "DM Mono",
} as const;

const HARMONYOS_SPLIT_CSS = {
  primary:
    "https://cdn.jsdelivr.net/npm/harmonyos-sans-webfont-splitted@1.2.1/dist/HarmonyOS_Sans_SC/Regular/Regular.css",
  fallback:
    "https://unpkg.com/harmonyos-sans-webfont-splitted@1.2.1/dist/HarmonyOS_Sans_SC/Regular/Regular.css",
} as const;

/** 本机安装时的常见 family / 文件名，先于远端。 */
const CANGER_JINKAI_LOCAL_NAMES = [
  "仓耳今楷",
  "仓耳今楷03W04",
  "仓耳今楷03简繁 W04",
  "TsangerJinKai03-W04",
] as const;

const SERIF_LOCAL_FALLBACKS = ["Songti SC", "STSong", "SimSun", "Cambria"];

/** 钉 commit 的仓耳今楷 woff2：国内镜像优先，再 jsDelivr / GitHub raw。不要拷进项目。 */
const CANGER_JINKAI_WOFF2_URLS = [
  "https://cdn.jsdmirror.com/gh/eachann1024/Resources@d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2",
  "https://cdn.jsdelivr.net/gh/eachann1024/Resources@d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2",
  "https://raw.githubusercontent.com/eachann1024/Resources/d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2",
] as const;

/** 鸿蒙走分包 CSS（unicode-range 按需拉 woff2）；仓耳今楷走 @font-face 远端 woff2。 */
export const REMOTE_FONT_SOURCES = {
  "HarmonyOS Sans SC": HARMONYOS_SPLIT_CSS,
  仓耳今楷: CANGER_JINKAI_WOFF2_URLS,
} as const;

const UI_SANS_FALLBACKS = [
  "-apple-system",
  "BlinkMacSystemFont",
  "Segoe UI",
  "Helvetica Neue",
  "Arial",
  "HarmonyOS Sans SC",
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "Noto Sans SC",
];

const UI_MONO_FALLBACKS = [
  "ui-monospace",
  "Menlo",
  "Consolas",
  "HarmonyOS Sans SC",
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "Noto Sans SC",
];

type PersistentWoff2Family = "仓耳今楷";

const persistentFontLoads = new Map<string, Promise<boolean>>();
let harmonyOSCssEnsured = false;

const trimFontName = (font: string) =>
  font.trim().replace(/^["']+|["']+$/g, "");

const splitFontList = (font: string | null | undefined) =>
  font ? font.split(",").map(trimFontName).filter(Boolean) : [];

const GENERIC_FAMILIES = new Set([
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
]);

const formatFontFamily = (family: string) => {
  const trimmed = trimFontName(family);
  if (!trimmed) return null;
  if (GENERIC_FAMILIES.has(trimmed)) return trimmed;
  return `"${trimmed}"`;
};

/** 生成可写入 CSS font-family 的单项（泛型族不加引号）。 */
export const toCssFontFamily = (family: string) =>
  formatFontFamily(family) ?? family;

const normalizeFontList = (families: string[]) =>
  Array.from(
    new Set(
      families
        .map(formatFontFamily)
        .filter((value): value is string => Boolean(value)),
    ),
  );

const buildFontStack = (
  customList: string[],
  defaultFont: string,
  baseFallbacks: string[],
  platformFallbacks: string[],
  generic: string,
) =>
  joinFonts(
    normalizeFontList([
      ...(customList.length ? customList : [defaultFont]),
      ...baseFallbacks,
      ...platformFallbacks,
      generic,
    ]),
  );

const getPlatformFallbacks = () => {
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

const injectStylesheet = (href: string, onError?: () => void) => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.crossOrigin = "anonymous";
  if (onError) link.onerror = onError;
  document.head.appendChild(link);
};

/** 主 CDN 的 CSS 已由 fonts.css @import；这里探测失败时改挂 unpkg，不预拉 4MB 整包。 */
const ensureHarmonyOSSplitCss = () => {
  if (harmonyOSCssEnsured || typeof document === "undefined") return;
  harmonyOSCssEnsured = true;

  const { primary, fallback } = REMOTE_FONT_SOURCES["HarmonyOS Sans SC"];
  injectStylesheet(primary, () => {
    console.warn("[fontLoader] HarmonyOS Sans SC 主 CDN 失败，改用 unpkg");
    injectStylesheet(fallback, () => {
      console.warn(
        "[fontLoader] HarmonyOS Sans SC 远程字体均失败，回退系统中文字体",
      );
    });
  });
};

/**
 * 应用启动时调用。鸿蒙交给 CSS unicode-range 按需分包；仓耳今楷走远端 @font-face。
 */
export function preloadFonts() {
  if (typeof document === "undefined") return;
  ensureHarmonyOSSplitCss();
  void ensurePersistentRemoteFont(DEFAULT_FONT_NAMES.serif);
}

const isFontReady = (family: string) =>
  typeof document.fonts.check === "function" &&
  document.fonts.check(`1em "${family}"`);

const tryInstallLocalFont = async (family: PersistentWoff2Family) => {
  if (isFontReady(family)) return true;

  for (const localName of CANGER_JINKAI_LOCAL_NAMES) {
    try {
      const face = new FontFace(family, `local("${localName}")`, {
        style: "normal",
        weight: "400",
      });
      await face.load();
      document.fonts.add(face);
      return true;
    } catch {
      // 本机没有这个名字，试下一个。
    }
  }
  return isFontReady(family);
};

const installRemoteFontFromUrls = async (family: PersistentWoff2Family) => {
  if (await tryInstallLocalFont(family)) return true;

  await waitForFonts([family]);
  if (isFontReady(family)) return true;

  for (const url of CANGER_JINKAI_WOFF2_URLS) {
    try {
      const face = new FontFace(family, `url("${url}")`, {
        style: "normal",
        weight: "400",
      });
      await face.load();
      document.fonts.add(face);
      return true;
    } catch (error) {
      console.warn(`[fontLoader] ${family} 从 ${url} 加载失败`, error);
    }
  }
  return false;
};

/**
 * 打开 app 时触发仓耳今楷加载：本机 family 命中则不再拉网；
 * 否则走 fonts.css 的 @font-face，再按 URL 列表用 FontFace 补一次。
 */
export function ensurePersistentRemoteFont(family: PersistentWoff2Family) {
  if (
    typeof document === "undefined" ||
    typeof FontFace === "undefined" ||
    !("fonts" in document)
  ) {
    return Promise.resolve(false);
  }

  const existing = persistentFontLoads.get(family);
  if (existing) return existing;

  const load = installRemoteFontFromUrls(family).catch((error) => {
    console.warn(`[fontLoader] ${family} 远端加载失败`, error);
    persistentFontLoads.delete(family);
    return false;
  });
  persistentFontLoads.set(family, load);
  return load;
}

/** 切换字体时后台备字，不挡住 UI。本机自定义名也只后台匹配。 */
export async function ensureEditorFontAvailable(
  fontFamily: "default" | "serif" | "mono" | undefined,
  customFonts: CustomFonts,
) {
  if (fontFamily !== "serif") return;

  const serifFamilies = splitFontList(customFonts.serif.font);
  const usesBuiltInSerif =
    serifFamilies.length === 0 ||
    serifFamilies.includes(DEFAULT_FONT_NAMES.serif);
  if (usesBuiltInSerif) {
    void ensurePersistentRemoteFont(DEFAULT_FONT_NAMES.serif);
    return;
  }

  void waitForFonts(serifFamilies);
}

export function applyFontVariables(customFonts: CustomFonts) {
  if (typeof document === "undefined") return;
  ensureHarmonyOSSplitCss();
  const fallbacks = getPlatformFallbacks();
  const root = document.documentElement;
  const customDefaultList = splitFontList(customFonts.default.font);
  const customSerifList = splitFontList(customFonts.serif.font);
  const customMonoList = splitFontList(customFonts.mono.font);

  root.style.setProperty(
    "--font-default",
    buildFontStack(
      customDefaultList,
      DEFAULT_FONT_NAMES.default,
      UI_SANS_FALLBACKS,
      [],
      "sans-serif",
    ),
  );
  root.style.setProperty(
    "--font-serif",
    buildFontStack(
      customSerifList,
      DEFAULT_FONT_NAMES.serif,
      ["仓耳今楷", ...SERIF_LOCAL_FALLBACKS],
      fallbacks.serif,
      "serif",
    ),
  );
  root.style.setProperty(
    "--font-mono",
    buildFontStack(
      customMonoList,
      DEFAULT_FONT_NAMES.mono,
      UI_MONO_FALLBACKS,
      [],
      "monospace",
    ),
  );
}

export function getEditorFontFamilies(
  fontFamily: "default" | "serif" | "mono" | undefined,
  customFonts: CustomFonts,
) {
  const targetType = fontFamily ?? "default";
  const targetFontMap = {
    default: customFonts.default.font || DEFAULT_FONT_NAMES.default,
    serif: customFonts.serif.font || DEFAULT_FONT_NAMES.serif,
    mono: customFonts.mono.font || DEFAULT_FONT_NAMES.mono,
  };
  const fallbackMap = {
    default: UI_SANS_FALLBACKS,
    serif: ["仓耳今楷", ...SERIF_LOCAL_FALLBACKS],
    mono: UI_MONO_FALLBACKS,
  };

  const families = [
    ...splitFontList(targetFontMap[targetType]),
    ...fallbackMap[targetType],
  ];

  return Array.from(new Set(families));
}

export async function waitForFonts(families: string[]) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const uniqueFamilies = Array.from(new Set(families))
    .map(trimFontName)
    .filter(Boolean);
  if (!uniqueFamilies.length) return;

  await Promise.allSettled(
    uniqueFamilies.map((family) => document.fonts.load(`1em "${family}"`)),
  );
}
