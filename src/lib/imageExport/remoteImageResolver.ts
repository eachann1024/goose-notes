// ── Remote Image Resolver ──────────────────────────────────────
// Resolves image URLs (att:/uuid:, http/https) to data URLs or object URLs
// for safe use during html-to-image canvas export (avoids CORS taint).

async function resolveSingleUrl(url: string): Promise<string | null> {
  if (url.startsWith("att:") || url.startsWith("uuid:")) {
    try {
      const { imageStorage } = await import("../imageStorage");
      const blob = await imageStorage.load(url);
      if (blob) return URL.createObjectURL(blob);
    } catch { /* fallthrough */ }
    return null;
  }
  // Remote images: pre-fetch to avoid canvas taint during html-to-image export.
  // Without this, cross-origin <img> renders fine in the DOM but canvas can't read
  // its pixels, so the export silently falls back to the placeholder SVG.
  if (url.startsWith("http:") || url.startsWith("https:")) {
    // Prefer the uTools Node bridge — it ignores browser CORS entirely.
    const bridge = (window as any).gooseFs?.fetchRemoteImage;
    if (typeof bridge === "function") {
      try {
        const dataUrl = await bridge(url, 8000);
        if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
          return dataUrl;
        }
      } catch { /* fallthrough to renderer fetch */ }
    }
    // Web/dev fallback: renderer fetch with timeout.
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
        return URL.createObjectURL(blob);
      }
    } catch { /* give up */ }
    return null;
  }
  return null;
}

export async function resolveImageUrls(blocks: any[]): Promise<void> {
  for (const block of blocks) {
    if (block.type === "image" || block.type === "imageResize" || block.type === "file") {
      const url = block.props?.url || block.props?.src;
      if (typeof url === "string") {
        const resolved = await resolveSingleUrl(url);
        if (resolved) {
          block.props = { ...block.props, url: resolved };
        }
      }
    }
    // Also resolve inline images
    if (Array.isArray(block.content)) {
      for (const item of block.content) {
        const inlineSrc = item?.attrs?.src || item?.props?.url || item?.props?.src;
        if (item?.type === "image" && typeof inlineSrc === "string") {
          const resolved = await resolveSingleUrl(inlineSrc);
          if (resolved) {
            item.attrs = { ...item.attrs, src: resolved };
          }
        }
      }
    }
    if (Array.isArray(block.children)) {
      await resolveImageUrls(block.children);
    }
  }
}
