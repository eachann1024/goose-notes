/** PDF visual assets: raster conversion, image resolution and code visuals. */
export { PDF_RASTER_DATA_URL_RE, isRasterPdfImageSrc, isSvgDataUrl } from "./pdfImageRaster";
export { resolvePdfImageDataUrl } from "./pdfImageSource";
export { getCodeBlockText, isVisualCodeLanguage, renderMermaidPngDataUrl, renderMathPngDataUrl, resolveCodeBlockVisual } from "./pdfCodeVisual";
export type { CodeBlockVisual, CodeBlockVisualHooks } from "./pdfCodeVisual";
