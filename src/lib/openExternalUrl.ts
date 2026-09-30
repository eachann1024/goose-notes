import { shell } from "@/lib/electron-platform/shell";

export function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function openExternalUrl(url: string): void {
  const targetUrl = normalizeExternalUrl(url);
  if (!targetUrl) return;

  shell.openUrl(targetUrl);
}
