import { TEXT_COLORS } from "@/lib/textColors";
import { blobToBase64 } from "@/lib/imageStorage/utils";
import { isRasterPdfImageSrc, rasterizeSvgMarkup } from "./pdfImageRaster";

const PDF_LIGHT_MATH = {
  color: TEXT_COLORS.light.primary,
  background: "#ffffff",
} as const;

export function getCodeBlockText(block: { content?: unknown } | null | undefined): string {
  const content = block?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return "";
        const rec = item as { type?: string; text?: string };
        if (rec.type === "hardBreak") return "\n";
        return typeof rec.text === "string" ? rec.text : "";
      })
      .join("");
  }
  return content == null ? "" : String(content);
}


export function isVisualCodeLanguage(language: string): boolean {
  const lang = language.trim().toLowerCase();
  return lang === "mermaid" || lang === "math" || lang === "latex" || lang === "tex";
}


export async function renderMermaidPngDataUrl(source: string): Promise<string | null> {
  const trimmed = source.trim();
  if (!trimmed) return null;
  const { renderMermaidSvgForExport } = await import("@/lib/imageExport/mermaid");
  const svg = await renderMermaidSvgForExport(trimmed, "light");
  if (!svg?.trim()) return null;
  return rasterizeSvgMarkup(svg);
}

export async function renderMathPngDataUrl(source: string): Promise<string | null> {
  const trimmed = source.trim();
  if (!trimmed) return null;
  if (typeof document === "undefined") {
    throw new Error("当前环境不支持导出公式图片");
  }
  const { default: katex } = await import("katex");
  const { captureElementAsPngBlob } = await import("@/lib/imageExport/svgToPng");
  const html = katex.renderToString(trimmed, {
    displayMode: true,
    throwOnError: false,
    output: "html",
  });

  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "position:fixed",
    "left:-99999px",
    "top:0",
    "z-index:-1",
    "padding:16px 24px",
    `color:${PDF_LIGHT_MATH.color}`,
    `background:${PDF_LIGHT_MATH.background}`,
    "font-size:18px",
    "line-height:1.4",
    "display:inline-block",
  ].join(";");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  try {
    await document.fonts.ready.catch(() => undefined);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const blob = await captureElementAsPngBlob(wrapper, { targetLongEdge: 1600 });
    const dataUrl = await blobToBase64(blob);
    if (!isRasterPdfImageSrc(dataUrl)) {
      throw new Error("公式截图结果不是 PNG data URL");
    }
    return dataUrl;
  } finally {
    document.body.removeChild(wrapper);
  }
}

export type CodeBlockVisual =
  | { kind: "png"; src: string; language: "mermaid" | "math" }
  | { kind: "source-fallback"; text: string; language: "mermaid" | "math" }
  | { kind: "empty"; language: "mermaid" | "math" }
  | { kind: "code" };

export type CodeBlockVisualHooks = {
  renderMermaidPng?: (source: string) => Promise<string | null>;
  renderMathPng?: (source: string) => Promise<string | null>;
};

export async function resolveCodeBlockVisual(
  block: { props?: { language?: string }; content?: unknown },
  hooks?: CodeBlockVisualHooks,
): Promise<CodeBlockVisual> {
  const language = String(block?.props?.language || "").trim().toLowerCase();
  const text = getCodeBlockText(block);
  const source = text.trim();

  if (language === "mermaid") {
    if (!source) return { kind: "empty", language: "mermaid" };
    try {
      const render = hooks?.renderMermaidPng ?? renderMermaidPngDataUrl;
      const png = await render(source);
      if (png && isRasterPdfImageSrc(png)) {
        return { kind: "png", src: png, language: "mermaid" };
      }
      console.error("[pdfExport] mermaid render returned no PNG");
    } catch (error) {
      console.error("[pdfExport] mermaid render failed:", error);
    }
    return { kind: "source-fallback", text, language: "mermaid" };
  }

  if (language === "math" || language === "latex" || language === "tex") {
    if (!source) return { kind: "empty", language: "math" };
    try {
      const render = hooks?.renderMathPng ?? renderMathPngDataUrl;
      const png = await render(source);
      if (png && isRasterPdfImageSrc(png)) {
        return { kind: "png", src: png, language: "math" };
      }
      console.error("[pdfExport] math render returned no PNG");
    } catch (error) {
      console.error("[pdfExport] math render failed:", error);
    }
    return { kind: "source-fallback", text, language: "math" };
  }

  return { kind: "code" };
}
