import { mimeToImageType, parseBase64Image } from "./docxImageCodec";

export type { ImageBufferResult } from "./docxImageCodec";
export { mimeToImageType, parseBase64Image };

export interface ResolvedDocxImage {
  buffer: Uint8Array;
  type: "png" | "jpg" | "gif" | "bmp";
  width: number;
  height: number;
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const parsed = parseBase64Image(dataUrl);
  if (parsed) {
    try {
      const binary = atob(parsed.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return { bytes, mime: parsed.mimeType };
    } catch {
      return null;
    }
  }
  return null;
}

function probePngSize(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return null;
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function probeGifSize(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function probeJpegSize(buffer: Uint8Array): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
      const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

export function probeImageSize(
  buffer: Uint8Array,
  type: ResolvedDocxImage["type"],
): { width: number; height: number } | null {
  if (type === "png") return probePngSize(buffer);
  if (type === "gif") return probeGifSize(buffer);
  if (type === "jpg") return probeJpegSize(buffer);
  if (type === "bmp" && buffer.length >= 26) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return { width: view.getInt32(18, true), height: Math.abs(view.getInt32(22, true)) };
  }
  return null;
}

async function rasterizeToPngDataUrl(src: string): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function resolveDocxImage(
  src: string,
  pageLocalFilePath?: string | null,
): Promise<ResolvedDocxImage | null> {
  const url = String(src || "").trim();
  if (!url) return null;

  const { resolvePdfImageDataUrl } = await import("@/lib/pdfExport/visualAssets");
  let dataUrl = await resolvePdfImageDataUrl(url, pageLocalFilePath);
  if (!dataUrl) return null;

  let decoded = dataUrlToBytes(dataUrl);
  if (!decoded) return null;

  let type = mimeToImageType(decoded.mime);
  if (decoded.mime.includes("webp") || decoded.mime.includes("svg")) {
    const png = await rasterizeToPngDataUrl(dataUrl);
    if (png) {
      dataUrl = png;
      decoded = dataUrlToBytes(png);
      if (!decoded) return null;
      type = "png";
    }
  }

  if (type !== "png" && type !== "jpg" && type !== "gif" && type !== "bmp") {
    const png = await rasterizeToPngDataUrl(dataUrl);
    if (!png) return null;
    decoded = dataUrlToBytes(png);
    if (!decoded) return null;
    type = "png";
  }

  const size = probeImageSize(decoded.bytes, type) ?? { width: 400, height: 300 };
  return {
    buffer: decoded.bytes,
    type,
    width: Math.max(1, size.width),
    height: Math.max(1, size.height),
  };
}
