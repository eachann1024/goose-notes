import type { CustomFonts } from "@/stores/useSettings";

const DEFAULT_FONTS = {
  default: "DM Sans",
  serif: "仓耳今楷",
  mono: "DM Mono",
};

// 远程字体 URL（体积大，需预加载）
const REMOTE_FONTS = [
  "https://cdn.jsdelivr.net/gh/eachann1024/Resources@d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E9%B8%BF%E8%92%99%E9%BB%91%E4%BD%93-HarmonyOS%20Sans%20SC.woff2",
  "https://cdn.jsdelivr.net/gh/eachann1024/Resources@d6dc229cd882dc0983dc5ce7cf28fb85047a4a76/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2",
];

const trimFontName = (font: string) =>
  font.trim().replace(/^["']+|["']+$/g, "");

const splitFontList = (font: string | null | undefined) =>
  font ? font.split(",").map(trimFontName).filter(Boolean) : [];

/**
 * 应用启动时调用，后台静默预加载远程字体
 * 浏览器会自动缓存，下次访问秒加载
 */
export function preloadFonts() {
  if (typeof document === "undefined") return;
  REMOTE_FONTS.forEach((url) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.href = url;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  });
}

export function applyFontVariables(customFonts: CustomFonts) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const fontDefault = customFonts.default.font || DEFAULT_FONTS.default;
  const fontSerif = customFonts.serif.font || DEFAULT_FONTS.serif;
  const fontMono = customFonts.mono.font || DEFAULT_FONTS.mono;

  root.style.setProperty(
    "--font-default",
    `"${fontDefault}", "DM Sans", "HarmonyOS Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
  );
  root.style.setProperty(
    "--font-serif",
    `"${fontSerif}", "仓耳今楷", Georgia, Cambria, "Times New Roman", Times, serif`,
  );
  root.style.setProperty(
    "--font-mono",
    `"${fontMono}", "DM Mono", "HarmonyOS Sans SC", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`,
  );
}

export function getEditorFontFamilies(
  fontFamily: "default" | "serif" | "mono" | undefined,
  customFonts: CustomFonts,
) {
  const targetType = fontFamily ?? "default";
  const targetFontMap = {
    default: customFonts.default.font || DEFAULT_FONTS.default,
    serif: customFonts.serif.font || DEFAULT_FONTS.serif,
    mono: customFonts.mono.font || DEFAULT_FONTS.mono,
  };
  const fallbackMap = {
    default: ["DM Sans", "HarmonyOS Sans SC"],
    serif: ["仓耳今楷"],
    mono: ["DM Mono", "HarmonyOS Sans SC"],
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
