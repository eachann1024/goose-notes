/**
 * 图片处理工具：压缩、转换、存储
 *
 * 规则：
 * - 非 SVG 统一输出 WebP@80%
 * - 已是 WebP（含 MIME 为空但文件头是 WebP）不再二次压缩
 * - 不做 JPEG / 多档质量 / dataURL 等兜底
 * - 复制与下载时再转 PNG
 */

import type { StorageConfig } from "./imageStorage/types";
import {
  DEFAULT_STORAGE_CONFIG,
  MAX_IMAGE_STORE_BYTES,
} from "./imageStorage/types";

import {
  WEBP_MIME,
  PNG_MIME,
  SVG_MIME,
  materializeImageBlob,
} from "./imageMaterialization";
export { materializeImageBlob } from "./imageMaterialization";

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob | null> {
  // 项目锁 ES2022，不能用 Promise.withResolvers
  return new Promise((resolve) => {
    if (typeof quality === "number") {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), mimeType);
  });
}

function resolveTargetSize(
  origW: number,
  origH: number,
  maxEdge: number,
): { width: number; height: number } {
  if (Math.max(origW, origH) <= maxEdge) {
    return { width: origW, height: origH };
  }

  if (origW >= origH) {
    return {
      width: maxEdge,
      height: Math.max(1, Math.round((origH / origW) * maxEdge)),
    };
  }

  return {
    width: Math.max(1, Math.round((origW / origH) * maxEdge)),
    height: maxEdge,
  };
}

async function decodeBitmap(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("当前环境不支持图片解码（缺少 createImageBitmap）");
  }

  try {
    return await createImageBitmap(blob);
  } catch {
    throw new Error(
      `图片解码失败（${blob.type || "unknown"}，${(blob.size / (1024 * 1024)).toFixed(1)}MB），请确认不是损坏文件`,
    );
  }
}

async function encodeWebp(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
): Promise<Blob> {
  const size = resolveTargetSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("无法创建画布，图片处理失败");
  }

  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  const encoded = await canvasToBlob(canvas, WEBP_MIME, quality);
  if (!encoded || encoded.size === 0) {
    throw new Error("WebP 编码失败");
  }
  return encoded;
}

/**
 * 统一压缩入口：只输出 WebP@80%
 */
export async function compressIfNeeded(
  input: Blob | File,
  cfg: StorageConfig = DEFAULT_STORAGE_CONFIG,
): Promise<Blob> {
  // 调用方可能已 materialize；这里再保证一次字节与 MIME 正确
  const source =
    input.type === SVG_MIME ? input : await materializeImageBlob(input);

  if (source.type === SVG_MIME) {
    return source;
  }

  // 已是 WebP：不二次压缩
  if (source.type === WEBP_MIME) {
    if (source.size > MAX_IMAGE_STORE_BYTES) {
      throw new Error(
        `图片过大（约 ${(source.size / (1024 * 1024)).toFixed(1)}MB），超过 ${Math.floor(MAX_IMAGE_STORE_BYTES / (1024 * 1024))}MB 上限`,
      );
    }
    return source;
  }

  const maxEdge = cfg.maxEdge ?? DEFAULT_STORAGE_CONFIG.maxEdge;
  const quality = cfg.compressQuality ?? DEFAULT_STORAGE_CONFIG.compressQuality;
  const bitmap = await decodeBitmap(source);
  const encoded = await encodeWebp(bitmap, maxEdge, quality);

  if (encoded.size > MAX_IMAGE_STORE_BYTES) {
    throw new Error(
      `图片过大（约 ${(encoded.size / (1024 * 1024)).toFixed(1)}MB），压缩后仍超过 ${Math.floor(MAX_IMAGE_STORE_BYTES / (1024 * 1024))}MB 上限`,
    );
  }

  return encoded;
}

/**
 * 复制剪贴板 / 下载：统一转 PNG
 */
export async function convertImageBlobToPng(input: Blob): Promise<Blob> {
  const source =
    input.type === SVG_MIME ? input : await materializeImageBlob(input);

  if (source.type === SVG_MIME) {
    return source;
  }
  if (source.type === PNG_MIME) {
    return source;
  }

  const bitmap = await decodeBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("无法创建画布，PNG 转换失败");
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const png = await canvasToBlob(canvas, PNG_MIME);
  if (!png || png.size === 0) {
    throw new Error("转换为 PNG 失败");
  }
  return png;
}

/**
 * 压缩图片（向后兼容薄封装）
 */
export async function compressImage(
  file: File,
  quality = DEFAULT_STORAGE_CONFIG.compressQuality,
): Promise<Blob> {
  return compressIfNeeded(file, {
    ...DEFAULT_STORAGE_CONFIG,
    compressQuality: quality,
  });
}

/**
 * 文件/Blob 转 base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 从剪切板事件提取图片文件
 */
export function getImageFromClipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }

  return null;
}

/**
 * 校验是否为有效的图片 URL
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "data:"
    );
  } catch {
    return false;
  }
}
