import { blobToBase64 } from "@/lib/imageStorage/utils";

export const PDF_RASTER_DATA_URL_RE =
  /^data:image\/(png|jpe?g|gif|webp|bmp)(;|$)/i;

export function isRasterPdfImageSrc(url: string): boolean {
  return PDF_RASTER_DATA_URL_RE.test(url);
}

export function isSvgDataUrl(url: string): boolean {
  return /^data:image\/svg\+xml/i.test(url);
}


function decodeSvgDataUrl(url: string): string {
  const match = url.match(/^data:image\/svg\+xml([^,]*),(.*)$/is);
  if (!match) throw new Error("不是 SVG data URL");
  const meta = match[1] ?? "";
  const payload = match[2] ?? "";
  if (/;base64/i.test(meta)) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(payload);
}

export async function rasterizeSvgMarkup(svg: string): Promise<string> {
  const { svgMarkupToPngBlob } = await import("@/lib/imageExport/svgToPng");
  const blob = await svgMarkupToPngBlob(svg, { targetLongEdge: 2048, padding: 12 });
  const dataUrl = await blobToBase64(blob);
  if (!isRasterPdfImageSrc(dataUrl)) {
    throw new Error("SVG 栅格化结果不是 PNG data URL");
  }
  return dataUrl;
}

export async function rasterizeIfNeeded(dataUrl: string): Promise<string | null> {
  if (isRasterPdfImageSrc(dataUrl)) return dataUrl;
  if (isSvgDataUrl(dataUrl)) {
    return rasterizeSvgMarkup(decodeSvgDataUrl(dataUrl));
  }
  return dataUrl.startsWith("data:image/") ? dataUrl : null;
}

export async function blobToPdfImageDataUrl(blob: Blob): Promise<string | null> {
  if (!blob || blob.size === 0) return null;
  if (blob.type.includes("svg") || blob.type === "image/svg+xml") {
    const svg = await blob.text();
    return rasterizeSvgMarkup(svg);
  }
  const dataUrl = await blobToBase64(blob);
  return rasterizeIfNeeded(dataUrl);
}
