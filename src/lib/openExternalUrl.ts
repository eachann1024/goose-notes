export function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function openExternalUrl(url: string): void {
  const targetUrl = normalizeExternalUrl(url);
  if (!targetUrl) return;

  const utools = typeof window !== "undefined" ? window.utools : null;
  if (typeof utools?.shellOpenExternal === "function") {
    utools.shellOpenExternal(targetUrl);
    return;
  }

  window.open(targetUrl, "_blank", "noopener,noreferrer");
}
