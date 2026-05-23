import type { Page } from "@/types";
import type { BlockNoteContent } from "../blocknote-content";
import { extractTitleFromContent } from "../content-text-extractor";
import { toPng } from "html-to-image";
import { trackEvent } from "../analytics";
import type { CardThemeId } from "./themes";
import { getCardTheme } from "./themes";
import type { WatermarkConfig } from "./watermark";
import { buildStyledHTML, renderBlock, extractInlineText } from "./domSerializer";
import { resolveImageUrls } from "./remoteImageResolver";

// ── Loading Overlay ────────────────────────────────────────────
function createLoadingOverlay(): HTMLElement {
  const overlay = document.createElement("div");
  overlay.id = "goose-image-export-loading";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.35); backdrop-filter: blur(2px);
    transition: opacity 0.2s ease;
  `;
  overlay.innerHTML = `
    <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:goose-spin 0.8s linear infinite;"></div>
    <div style="margin-top:16px;color:#fff;font-size:14px;font-weight:500;letter-spacing:0.02em;">正在生成图片</div>
    <style>@keyframes goose-spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function removeLoadingOverlay(): void {
  const overlay = document.getElementById("goose-image-export-loading");
  if (!overlay) return;
  overlay.style.opacity = "0";
  setTimeout(() => overlay.remove(), 200);
}

// ── Core Capture ───────────────────────────────────────────────
async function waitForImages(container: HTMLElement): Promise<void> {
  const images = container.querySelectorAll("img");
  if (images.length === 0) return Promise.resolve();

  const promises = Array.from(images).map((img) => {
    return new Promise<void>((resolve) => {
      if (img.complete) { resolve(); return; }
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(() => resolve(), 3000);
    });
  });

  return Promise.all(promises).then(() => {});
}

async function captureElementToPng(element: HTMLElement, filename: string) {
  const overlay = createLoadingOverlay();

  try {
    await Promise.all([
      document.fonts.ready,
      waitForImages(element),
    ]);

    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    const dataUrl = await toPng(element, {
      pixelRatio: 4,
      quality: 0.92,
      cacheBust: true,
      skipFonts: false,
      imagePlaceholder:
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7lr4bnoIHnvJbnsbvlkI7lj5bor4E8L3RleHQ+PC9zdmc+",
    });

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const { saveBlobAndReveal } = await import("../export");
    const saved = await saveBlobAndReveal(blob, filename);
    const { toast } = await import("sonner");
    if (saved) {
      toast.success("图片已保存到下载文件夹");
    } else {
      throw new Error("保存图片失败");
    }
  } catch (error) {
    const { toast } = await import("sonner");
    toast.error("导出图片失败，请重试");
    console.error("[imageExport] capture failed:", error);
  } finally {
    removeLoadingOverlay();
  }
}

// ── File Name Helpers ──────────────────────────────────────────
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

function buildFileName(title: string, theme: ReturnType<typeof getCardTheme>, suffix?: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const parts = [sanitizeFileName(title || "untitled"), sanitizeFileName(theme.nameEn), ts];
  if (suffix) parts.splice(1, 0, suffix);
  return `${parts.join("_")}.png`;
}

// ── Public API: Full Page Export ───────────────────────────────
export async function exportPageToImage(
  page: Page,
  themeId: CardThemeId = "notion",
  watermarkConfig?: WatermarkConfig,
) {
  const theme = getCardTheme(themeId);
  const title = extractTitleFromContent(page.content);
  const content = JSON.parse(JSON.stringify(page.content)) as BlockNoteContent;
  await resolveImageUrls(content as any[]);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  try {
    // 跳过第一个 heading，避免标题重复
    const firstBlock = content[0];
    const blocksToRender = firstBlock?.type === "heading" ? content.slice(1) : content;
    const blocksHtml = blocksToRender.map((block: any) => renderBlock(block, theme)).join("\n");
    const html = buildStyledHTML({ title, blocksHtml, theme, watermarkConfig });
    container.innerHTML = html;

    const cardElement = container.querySelector(".gooseshot-container") as HTMLElement;
    if (!cardElement) throw new Error("Failed to create preview element");

    await captureElementToPng(cardElement, buildFileName(title, theme));
    trackEvent("share_image_full", { page_title_length: title?.length ?? 0, theme: themeId });
  } finally {
    document.body.removeChild(container);
  }
}

// ── Public API: Selection Export ───────────────────────────────
export async function exportSelectionToImage(
  selectionBlocks: BlockNoteContent,
  pageTitle?: string,
  themeId: CardThemeId = "notion",
  watermarkConfig?: WatermarkConfig,
) {
  if (!Array.isArray(selectionBlocks) || selectionBlocks.length === 0) return;

  const theme = getCardTheme(themeId);
  const title = pageTitle || "选中内容";

  // Deep clone to avoid mutating the original blocks
  const clonedBlocks = JSON.parse(JSON.stringify(selectionBlocks)) as any[];
  await resolveImageUrls(clonedBlocks);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  try {
    const blocksHtml = clonedBlocks
      .map((block: any) => renderBlock(block, theme))
      .join("\n");

    const html = buildStyledHTML({
      title,
      blocksHtml,
      theme,
      isSelection: true,
      watermarkConfig,
    });
    container.innerHTML = html;

    const cardElement = container.querySelector(".gooseshot-container") as HTMLElement;
    if (!cardElement) throw new Error("Failed to create preview element");

    await captureElementToPng(cardElement, buildFileName(title, theme, "选中"));
    const selectionLength = selectionBlocks
      .map((block: any) => extractInlineText(block.content))
      .join("\n").length;
    trackEvent("share_image_selection", { selection_length: selectionLength, theme: themeId });
  } finally {
    document.body.removeChild(container);
  }
}

// ── Legacy alias ───────────────────────────────────────────────
export async function exportToImage(page: Page, themeId: CardThemeId = "notion") {
  return exportPageToImage(page, themeId);
}
