import type { CustomFonts } from "@/stores/useSettings";
import {
  SYSTEM_FONT_STACK,
  DEFAULT_FONT_NAMES,
  SERIF_LOCAL_FALLBACKS,
  UI_MONO_FALLBACKS,
  normalizeLocalFontName,
  toCssFontFamily,
  splitFontList,
  buildFontStack,
  getPlatformFallbacks,
} from "./fonts/families";
export {
  SYSTEM_FONT_STACK,
  DEFAULT_FONT_NAMES,
  REMOTE_FONT_SOURCES,
  toCssFontFamily,
  normalizeLocalFontName,
  isLocalFontAvailable,
} from "./fonts/families";
export {
  ensurePersistentRemoteFont,
  ensureEditorFontAvailable,
  waitForFonts,
} from "./fonts/loading";

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
