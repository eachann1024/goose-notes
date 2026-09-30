// ── Remote Image Resolver ──────────────────────────────────────
// Resolves image URLs (att:/uuid:, http/https) to base64 data URLs
// for safe use during html-to-image SVG serialization.
// Object URLs (blob:) cannot be resolved inside SVG foreignObject context,
// so we must use inline data URLs.

import { blobToBase64 } from "../imageStorage/utils";

function loadImageViaCanvas(url: string, timeoutMs = 8000): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => { img.src = ""; resolve(null); }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) { resolve(null); return; }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

async function resolveSingleUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;

  if (url.startsWith("att:") || url.startsWith("uuid:")) {
    try {
      const { imageStorage } = await import("../imageStorage");
      const blob = await imageStorage.load(url);
      if (blob) return blobToBase64(blob);
    } catch { /* fallthrough */ }
    return null;
  }
  if (url.startsWith("http:") || url.startsWith("https:")) {
    const bridge = (window as any).gooseFs?.fetchRemoteImage;
    if (typeof bridge === "function") {
      try {
        const dataUrl = await bridge(url, 8000);
        if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
          return dataUrl;
        }
      } catch { /* fallthrough to renderer fetch */ }
    }
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (res.ok) {
        const blob = await res.blob();
        return blobToBase64(blob);
      }
    } catch { /* fallthrough to canvas */ }
    try {
      const dataUrl = await loadImageViaCanvas(url);
      if (dataUrl) return dataUrl;
    } catch { /* give up */ }
    return null;
  }
  return null;
}

export async function resolveImageUrls(blocks: any[]): Promise<void> {
  const tasks: Promise<void>[] = [];

  for (const block of blocks) {
    if (block.type === "image" || block.type === "imageResize" || block.type === "file") {
      const url = block.props?.url || block.props?.src;
      if (typeof url === "string") {
        tasks.push(
          resolveSingleUrl(url).then((resolved) => {
            if (resolved) block.props = { ...block.props, url: resolved };
          }),
        );
      }
    }
    if (Array.isArray(block.content)) {
      for (const item of block.content) {
        const inlineSrc = item?.attrs?.src || item?.props?.url || item?.props?.src;
        if (item?.type === "image" && typeof inlineSrc === "string") {
          tasks.push(
            resolveSingleUrl(inlineSrc).then((resolved) => {
              if (resolved) item.attrs = { ...item.attrs, src: resolved };
            }),
          );
        }
      }
    }
    if (Array.isArray(block.children)) {
      tasks.push(resolveImageUrls(block.children));
    }
  }

  await Promise.all(tasks);
}
