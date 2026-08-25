/**
 * PDF 字体注册（中文支持）。
 *
 * @react-pdf 的 Font.register({ src }) 若给普通 URL，渲染阶段会 fetch。
 * uTools / ZTools 以 file:// 打开 index.html，根路径 `/fonts/xxx`
 * 会变成 file:///fonts/xxx（磁盘根目录）→ ERR_FILE_NOT_FOUND → Failed to fetch。
 * 因此不能把 src 设成站点根 `/fonts/...`，必须先读成 data: URL 再注册。
 *
 * react-pdf 只稳吃 static TTF；WOFF2 / OTF 会 Offset、空白字形。
 * 默认嵌入 Noto Sans SC static TTF。失败则 ready=false，不假装 Helvetica/Inter 成功。
 */

export const PDF_FONT_FAMILY = "NotoSansSC";
export const PDF_DM_MONO_FAMILY = "DM Mono";

export type PdfPageFontFamily = "default" | "serif" | "mono";

export type PdfCustomFonts = {
  default: { font: string | null };
  serif: { font: string | null };
  mono: { font: string | null };
};

export type PdfEmbedKind = "noto" | "dm-mono";

export type PdfFontPlan = {
  category: PdfPageFontFamily;
  embed: PdfEmbedKind;
  bodyFamily: string;
  pageFontFamily: string | string[];
  bodyUrls: readonly string[];
  bodyFallbackUrls: readonly string[];
  monoUrls: readonly string[];
};

/** 仅作 file:// 相对解析的文档/测例，不再作为加载来源。 */
export const PDF_FONT_RELATIVE_PATHS = [
  "fonts/NotoSansSC-Regular.ttf",
  "fonts/NotoSansSC-Regular.otf",
] as const;

/** Noto Sans SC static TTF（fontsource 分包，钉版本）。不要 WOFF2 / OTF。 */
export const PDF_CJK_FONT_URLS = [
  "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5.2.8/chinese-simplified-400-normal.ttf",
  "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5.1.0/chinese-simplified-400-normal.ttf",
] as const;

export const PDF_DM_MONO_TTF_URLS = [
  "https://cdn.jsdelivr.net/fontsource/fonts/dm-mono@5.2.6/latin-400-normal.ttf",
  "https://github.com/google/fonts/raw/main/ofl/dmmono/DMMono-Regular.ttf",
] as const;

const MIN_CJK_FONT_BYTES = 100_000;
const MIN_LATIN_FONT_BYTES = 4_000;

const dataUrlByUrl = new Map<string, string | null>();
const inflightByUrl = new Map<string, Promise<string | null>>();
let registeredKey: string | null = null;
let lastRegisterResult: { ready: boolean; pageFontFamily: string | string[] } | null =
  null;
let hyphenationRegistered = false;

export function resolvePdfFontUrl(relativePath: string, baseHref: string): string {
  return new URL(relativePath, baseHref).href;
}

export function fileUrlToLocalPath(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  try {
    const decoded = decodeURIComponent(new URL(url).pathname);
    if (/^\/[A-Za-z]:\//.test(decoded)) return decoded.slice(1);
    return decoded;
  } catch {
    return null;
  }
}

export function toPdfFontDataUrl(base64: string, mime = "font/ttf"): string {
  return `data:${mime};base64,${base64}`;
}

export function resetPdfFontLoadCache(): void {
  dataUrlByUrl.clear();
  inflightByUrl.clear();
  registeredKey = null;
  lastRegisterResult = null;
}

export function isEmbeddablePdfFontUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".ttf");
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function guessFontMime(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".ttf")) return "font/ttf";
  if (path.endsWith(".otf")) return "font/otf";
  if (path.endsWith(".woff2")) return "font/woff2";
  if (path.endsWith(".woff")) return "font/woff";
  return "font/ttf";
}

function firstFamilyName(font: string | null | undefined): string {
  if (!font) return "";
  return font
    .split(",")[0]
    .trim()
    .replace(/^["']+|["']+$/g, "");
}

function classifyCustomName(name: string): PdfEmbedKind | "empty" {
  if (!name) return "empty";
  if (/dm\s*mono/i.test(name)) return "dm-mono";
  return "noto";
}

function notoPlan(category: PdfPageFontFamily): PdfFontPlan {
  return {
    category,
    embed: "noto",
    bodyFamily: PDF_FONT_FAMILY,
    pageFontFamily: PDF_FONT_FAMILY,
    bodyUrls: PDF_CJK_FONT_URLS,
    bodyFallbackUrls: [],
    monoUrls: PDF_DM_MONO_TTF_URLS,
  };
}

export function resolvePdfFontPlan(
  fontFamily?: PdfPageFontFamily | null,
  customFonts?: PdfCustomFonts | null,
): PdfFontPlan {
  const category: PdfPageFontFamily = fontFamily ?? "default";
  const customName = firstFamilyName(customFonts?.[category]?.font);
  const named = classifyCustomName(customName);

  if (named === "dm-mono" || (named === "empty" && category === "mono")) {
    return {
      category,
      embed: "dm-mono",
      bodyFamily: PDF_FONT_FAMILY,
      pageFontFamily: [PDF_DM_MONO_FAMILY, PDF_FONT_FAMILY],
      bodyUrls: PDF_CJK_FONT_URLS,
      bodyFallbackUrls: [],
      monoUrls: PDF_DM_MONO_TTF_URLS,
    };
  }

  return notoPlan(category);
}

async function loadCachedFontDataUrl(
  url: string,
  minBytes: number,
): Promise<string | null> {
  if (!isEmbeddablePdfFontUrl(url)) return null;
  if (dataUrlByUrl.has(url)) return dataUrlByUrl.get(url) ?? null;
  const existing = inflightByUrl.get(url);
  if (existing) return existing;

  const job = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        dataUrlByUrl.set(url, null);
        return null;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength < minBytes) {
        dataUrlByUrl.set(url, null);
        return null;
      }
      const mime = guessFontMime(url);
      if (mime !== "font/ttf") {
        dataUrlByUrl.set(url, null);
        return null;
      }
      const dataUrl = toPdfFontDataUrl(uint8ToBase64(new Uint8Array(buf)), mime);
      dataUrlByUrl.set(url, dataUrl);
      return dataUrl;
    } catch {
      dataUrlByUrl.set(url, null);
      return null;
    }
  })();

  inflightByUrl.set(url, job);
  try {
    return await job;
  } finally {
    inflightByUrl.delete(url);
  }
}

export async function loadFirstPdfFontDataUrl(
  urls: readonly string[],
  minBytes = MIN_CJK_FONT_BYTES,
): Promise<string | null> {
  for (const url of urls) {
    const src = await loadCachedFontDataUrl(url, minBytes);
    if (src) return src;
  }
  return null;
}

/** Noto CJK static TTF（测例与主路径）。 */
export async function loadPdfFontDataUrl(): Promise<string | null> {
  return loadFirstPdfFontDataUrl(PDF_CJK_FONT_URLS);
}

function registerFamilyVariants(Font: typeof import("@react-pdf/renderer").Font, family: string, src: string) {
  Font.register({ family, src });
  Font.register({ family, src, fontWeight: "bold" });
  Font.register({ family, src, fontStyle: "italic" });
  Font.register({ family, src, fontWeight: "bold", fontStyle: "italic" });
}

function failedRegisterResult(): { ready: boolean; pageFontFamily: string | string[] } {
  return { ready: false, pageFontFamily: PDF_FONT_FAMILY };
}

export async function registerPdfFonts(options?: {
  fontFamily?: PdfPageFontFamily | null;
  customFonts?: PdfCustomFonts | null;
}): Promise<{ ready: boolean; pageFontFamily: string | string[] }> {
  const plan = resolvePdfFontPlan(options?.fontFamily, options?.customFonts);
  const planKey = `${plan.embed}:${plan.category}:${firstFamilyName(options?.customFonts?.[plan.category]?.font)}`;
  if (registeredKey === planKey && lastRegisterResult?.ready) {
    return lastRegisterResult;
  }

  try {
    const { Font } = await import("@react-pdf/renderer");
    const bodySrc = await loadFirstPdfFontDataUrl(plan.bodyUrls);
    if (!bodySrc) {
      console.warn("[pdfExport] 未能加载 Noto Sans SC TTF，中止 react-pdf 字体注册。");
      return failedRegisterResult();
    }

    const monoSrc = await loadFirstPdfFontDataUrl(
      plan.monoUrls,
      MIN_LATIN_FONT_BYTES,
    );
    if (!monoSrc) {
      console.warn("[pdfExport] 未能加载 DM Mono TTF，代码块回退已注册的 CJK 字体。");
    }

    const aliases = new Set([plan.bodyFamily, PDF_FONT_FAMILY, "Inter"]);
    for (const family of aliases) {
      registerFamilyVariants(Font, family, bodySrc);
    }

    if (monoSrc) {
      registerFamilyVariants(Font, PDF_DM_MONO_FAMILY, monoSrc);
      registerFamilyVariants(Font, "GeistMono", monoSrc);
    } else {
      registerFamilyVariants(Font, PDF_DM_MONO_FAMILY, bodySrc);
      registerFamilyVariants(Font, "GeistMono", bodySrc);
    }

    if (!hyphenationRegistered) {
      Font.registerHyphenationCallback((word) => [word]);
      hyphenationRegistered = true;
    }

    let pageFontFamily: string | string[];
    if (plan.embed === "dm-mono") {
      const stack: string[] = [];
      if (monoSrc) stack.push(PDF_DM_MONO_FAMILY);
      stack.push(plan.bodyFamily);
      pageFontFamily = stack.length === 1 ? stack[0] : stack;
    } else {
      pageFontFamily = plan.bodyFamily;
    }

    lastRegisterResult = { ready: true, pageFontFamily };
    registeredKey = planKey;
    return lastRegisterResult;
  } catch (error) {
    console.warn("[pdfExport] 字体注册失败。", error);
    return failedRegisterResult();
  }
}
