import { isLocalFilePath, readLocalFileAsBlobAsync, resolveToAbsolute } from "@/lib/imageStorage/strategies/file-system";
import { fileUrlToLocalPath } from "./fontConfig";
import { rasterizeIfNeeded, blobToPdfImageDataUrl } from "./pdfImageRaster";

function resolveLocalMediaPath(
  src: string,
  pageLocalFilePath?: string | null,
): string | null {
  if (src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src)) return src;
  if (!pageLocalFilePath) return null;
  const dir = pageLocalFilePath.replace(/[\\/][^\\/]+$/, "");
  return dir ? resolveToAbsolute(dir, src) : null;
}


function guessImageMime(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
  return "image/png";
}

async function readGooseFsBase64(fullPath: string): Promise<string | null> {
  const gfs =
    typeof window !== "undefined"
      ? (window as Window & {
          gooseFs?: {
            readFileBase64Async?: (path: string) => Promise<string | null>;
            readFileBase64?: (path: string) => string | null;
          };
        }).gooseFs
      : undefined;
  if (!gfs) return null;
  if (typeof gfs.readFileBase64Async === "function") {
    const base64 = await gfs.readFileBase64Async(fullPath);
    if (base64) return base64;
  }
  if (typeof gfs.readFileBase64 === "function") {
    return gfs.readFileBase64(fullPath) ?? null;
  }
  return null;
}

async function readLocalPathAsDataUrl(fullPath: string): Promise<string | null> {
  try {
    const base64 = await readGooseFsBase64(fullPath);
    if (base64) {
      const dataUrl = `data:${guessImageMime(fullPath)};base64,${base64}`;
      return await rasterizeIfNeeded(dataUrl);
    }
    const blob = await readLocalFileAsBlobAsync(fullPath);
    if (blob) return blobToPdfImageDataUrl(blob);
  } catch (error) {
    console.error("[pdfExport] 读取本地图片失败:", fullPath, error);
  }
  return null;
}


async function blobUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "blob";
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) {
          resolve(xhr.response as Blob);
          return;
        }
        reject(new Error(`blob 读取失败（${xhr.status}）`));
      };
      xhr.onerror = () => reject(new Error("blob 读取失败"));
      xhr.send();
    });
    return blobToPdfImageDataUrl(blob);
  } catch (error) {
    console.error("[pdfExport] blob 图片读取失败:", error);
    return null;
  }
}

export async function resolvePdfImageDataUrl(
  url: string,
  pageLocalFilePath?: string | null,
): Promise<string | null> {
  const src = String(url || "").trim();
  if (!src) return null;

  try {
    if (src.startsWith("data:")) {
      return await rasterizeIfNeeded(src);
    }

    if (src.startsWith("blob:")) {
      return await blobUrlToDataUrl(src);
    }

    if (src.startsWith("file:")) {
      const localPath = fileUrlToLocalPath(src);
      if (!localPath) return null;
      return await readLocalPathAsDataUrl(localPath);
    }

    if (isLocalFilePath(src)) {
      const abs = resolveLocalMediaPath(src, pageLocalFilePath);
      if (abs) {
        const fromDisk = await readLocalPathAsDataUrl(abs);
        if (fromDisk) return fromDisk;
      }
    }

    if (
      src.startsWith("att:") ||
      src.startsWith("uuid:") ||
      /^https?:\/\//i.test(src)
    ) {
      const { resolveRemoteImageToDataUrl } = await import(
        "@/lib/imageExport/remoteImageResolver"
      );
      const remote = await resolveRemoteImageToDataUrl(src);
      if (remote) return await rasterizeIfNeeded(remote);
      return null;
    }

    if (typeof window !== "undefined" && !src.includes("://")) {
      try {
        const absUrl = new URL(src, window.location.href).href;
        if (absUrl && absUrl !== src) {
          return await resolvePdfImageDataUrl(absUrl, pageLocalFilePath);
        }
      } catch {
        // ignore invalid relative URL
      }
    }
  } catch (error) {
    console.error("[pdfExport] 图片解析失败:", src, error);
  }

  return null;
}
