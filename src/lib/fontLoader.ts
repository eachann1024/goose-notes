import type { CustomFonts } from "@/stores/useSettings";

export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const DEFAULT_FONT_NAMES = {
  default: SYSTEM_FONT_STACK,
  serif: "仓耳今楷",
  mono: "DM Mono",
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

/** 仓耳今楷仅在用户选择衬线体时按需加载。 */
export const REMOTE_FONT_SOURCES = {
  仓耳今楷: CANGER_JINKAI_WOFF2_URLS,
} as const;

const UI_MONO_FALLBACKS = [
  "ui-monospace",
  "Menlo",
  "Consolas",
  "PingFang SC",
  "Hiragino Sans GB",
  "Microsoft YaHei",
  "Noto Sans SC",
];

type PersistentWoff2Family = "仓耳今楷";

const persistentFontLoads = new Map<string, Promise<boolean>>();

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
  "-apple-system",
  "BlinkMacSystemFont",
].map((family) => family.toLowerCase()));

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

const buildFontStack = (
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

const withTimeout = <T>(promise: Promise<T>, timeoutMs = 4000) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Font loading timed out")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
};

const hasLoadedFont = async (family: string) => {
  try {
    const faces = await withTimeout(
      document.fonts.load(`400 1em ${toCssFontFamily(family)}`, "中文"),
    );
    return faces.some((face) => face.status === "loaded");
  } catch {
    return false;
  }
};

const tryInstallLocalFont = async (family: PersistentWoff2Family) => {
  if (await hasLoadedFont(family)) return true;

  for (const localName of CANGER_JINKAI_LOCAL_NAMES) {
    try {
      const face = new FontFace(family, `local("${localName}")`, {
        style: "normal",
        weight: "400",
      });
      await withTimeout(face.load());
      document.fonts.add(face);
      return true;
    } catch {
      // 本机没有这个名字，试下一个。
    }
  }
  return hasLoadedFont(family);
};

const installRemoteFontFromUrls = async (family: PersistentWoff2Family) => {
  if (await tryInstallLocalFont(family)) return true;

  await waitForFonts([family]);
  if (await hasLoadedFont(family)) return true;

  for (const url of REMOTE_FONT_SOURCES[family]) {
    try {
      const face = new FontFace(family, `url("${url}")`, {
        style: "normal",
        weight: "400",
      });
      await withTimeout(face.load());
      document.fonts.add(face);
      return true;
    } catch (error) {
      console.warn(`[fontLoader] ${family} 从 ${url} 加载失败`, error);
    }
  }
  return false;
};

/** 用户选择衬线体时，本机字体优先；网络加载在后台且有超时。 */
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
  const category = fontFamily ?? "default";
  const selectedFamilies = splitFontList(customFonts[category].font);
  const selectsJinKai = selectedFamilies.some((family) =>
    CANGER_JINKAI_LOCAL_NAMES.some(
      (localName) => localName.toLowerCase() === family.toLowerCase(),
    ),
  );
  const usesBuiltInSerif =
    category === "serif" &&
    (selectedFamilies.length === 0 ||
      selectedFamilies.includes(DEFAULT_FONT_NAMES.serif));

  if (selectsJinKai || usesBuiltInSerif) {
    void ensurePersistentRemoteFont(DEFAULT_FONT_NAMES.serif);
    return;
  }

  void waitForFonts(selectedFamilies);
}

export function applyFontVariables(
  customFonts: CustomFonts,
  fonts: {
    uiFontFamily?: string | null;
    sidebarFontFamily?: string | null;
  } = {},
) {
  if (typeof document === "undefined") return;
  const fallbacks = getPlatformFallbacks();
  const root = document.documentElement;
  const uiFont = normalizeLocalFontName(fonts.uiFontFamily);
  const sidebarFont = normalizeLocalFontName(fonts.sidebarFontFamily);
  root.style.setProperty(
    "--font-ui",
    uiFont
      ? `${toCssFontFamily(uiFont)}, ${SYSTEM_FONT_STACK}`
      : SYSTEM_FONT_STACK,
  );
  root.style.setProperty(
    "--font-sidebar",
    sidebarFont
      ? `${toCssFontFamily(sidebarFont)}, ${SYSTEM_FONT_STACK}`
      : SYSTEM_FONT_STACK,
  );
  const customDefaultList = splitFontList(customFonts.default.font);
  const customSerifList = splitFontList(customFonts.serif.font);
  const customMonoList = splitFontList(customFonts.mono.font);

  root.style.setProperty(
    "--font-default",
    buildFontStack(
      customDefaultList,
      DEFAULT_FONT_NAMES.default,
      splitFontList(SYSTEM_FONT_STACK),
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
    default: splitFontList(SYSTEM_FONT_STACK),
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
    uniqueFamilies.map((family) =>
      withTimeout(
        document.fonts.load(`400 1em ${toCssFontFamily(family)}`, "中文"),
      ),
    ),
  );
}
