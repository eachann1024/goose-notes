import type { Page } from "@/types";
import type { BlockNoteContent } from "./blocknote-content";
import { extractTitleFromContent } from "./content-text-extractor";
import { toPng } from "html-to-image";
import { trackEvent } from "./analytics";

// ── Design System ──────────────────────────────────────────────
// 4 curated gradient presets for the share card
const GRADIENT_PRESETS = {
  light: {
    background: "linear-gradient(155deg, #f5f0ff 0%, #e8f4fd 35%, #fff8f0 70%, #f0f7ff 100%)",
    cardBg: "#ffffff",
    textColor: "#1a1a2e",
    secondaryText: "#6b7280",
    codeBg: "#f8f9fa",
    quoteBorder: "#e5e7eb",
    calloutBg: "#fef9e7",
    tableBorder: "#e5e7eb",
    divider: "#e5e7eb",
    watermark: "#9ca3af",
    accent: "#6366f1",
  },
  dark: {
    background: "linear-gradient(155deg, #0f0c29 0%, #1a1a3e 35%, #16213e 70%, #0f3460 100%)",
    cardBg: "#1a1a2e",
    textColor: "#f3f4f6",
    secondaryText: "#9ca3af",
    codeBg: "#111827",
    quoteBorder: "#374151",
    calloutBg: "#1f2937",
    tableBorder: "#374151",
    divider: "#374151",
    watermark: "#6b7280",
    accent: "#818cf8",
  },
  warm: {
    background: "linear-gradient(155deg, #fff5eb 0%, #ffecd2 35%, #fcb69f 70%, #ffecd2 100%)",
    cardBg: "#fffaf5",
    textColor: "#2d1b0e",
    secondaryText: "#8b7355",
    codeBg: "#fff5eb",
    quoteBorder: "#e8d5c4",
    calloutBg: "#fff8e7",
    tableBorder: "#e8d5c4",
    divider: "#e8d5c4",
    watermark: "#a89080",
    accent: "#d97706",
  },
  cool: {
    background: "linear-gradient(155deg, #e0f7fa 0%, #e8f5e9 35%, #f3e5f5 70%, #e3f2fd 100%)",
    cardBg: "#f8fffe",
    textColor: "#0d1b2a",
    secondaryText: "#5c6b73",
    codeBg: "#f0f7f4",
    quoteBorder: "#c8d6e5",
    calloutBg: "#f0f9ff",
    tableBorder: "#c8d6e5",
    divider: "#c8d6e5",
    watermark: "#7a8b99",
    accent: "#0891b2",
  },
};

type ThemeKey = keyof typeof GRADIENT_PRESETS;

interface ExportOptions {
  theme?: ThemeKey | "auto";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function detectTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const html = document.documentElement;
  const className = html.className || "";
  if (className.includes("dark")) return "dark";
  return "light";
}

function getTheme(theme: ThemeKey | "auto" | undefined): typeof GRADIENT_PRESETS.light {
  if (theme && theme !== "auto" && theme in GRADIENT_PRESETS) {
    return GRADIENT_PRESETS[theme];
  }
  const detected = detectTheme();
  return GRADIENT_PRESETS[detected];
}

// ── Watermark SVG ──────────────────────────────────────────────
function getWatermarkHTML(theme: typeof GRADIENT_PRESETS.light): string {
  return `<div class="gooseshot-watermark">
    <div class="gooseshot-watermark-left">
      <span class="gooseshot-watermark-icon">🪿</span>
      <span class="gooseshot-watermark-brand">uTools - 鹅的笔记</span>
    </div>
    <div class="gooseshot-watermark-date">${new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>`;
}

// ── Styled HTML Builder ────────────────────────────────────────
function buildStyledHTML(params: {
  title: string;
  blocksHtml: string;
  theme: typeof GRADIENT_PRESETS.light;
  isSelection?: boolean;
}): string {
  const { title, blocksHtml, theme, isSelection } = params;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: ${theme.textColor};
  line-height: 1.85;
  font-size: 16px;
}
.gooseshot-container {
  background: ${theme.background};
  padding: 64px 56px;
  min-width: 680px;
  max-width: 840px;
  position: relative;
  overflow: hidden;
}
.gooseshot-container::before {
  content: '';
  position: absolute;
  top: -120px;
  right: -80px;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
  border-radius: 50%;
}
.gooseshot-container::after {
  content: '';
  position: absolute;
  bottom: -100px;
  left: -60px;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);
  border-radius: 50%;
}
.gooseshot-card {
  background: ${theme.cardBg};
  border-radius: 20px;
  padding: 40px 44px;
  box-shadow:
    0 1px 2px rgba(0,0,0,0.02),
    0 4px 12px rgba(0,0,0,0.03),
    0 8px 24px rgba(0,0,0,0.04),
    0 16px 48px rgba(0,0,0,0.05),
    0 32px 96px rgba(0,0,0,0.06);
  position: relative;
  z-index: 1;
  border: 1px solid rgba(0,0,0,0.04);
}
.gooseshot-header {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid ${theme.divider};
}
.gooseshot-title {
  font-family: 'Noto Serif SC', Georgia, serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.35;
  color: ${theme.textColor};
  letter-spacing: -0.02em;
}
.gooseshot-subtitle {
  font-size: 13px;
  color: ${theme.secondaryText};
  margin-top: 8px;
  font-weight: 400;
}
.gooseshot-content > * { margin-bottom: 14px; }
.gooseshot-content > *:last-child { margin-bottom: 0; }
.gooseshot-content h1 {
  font-size: 24px;
  font-weight: 700;
  margin-top: 28px;
  margin-bottom: 14px;
  color: ${theme.textColor};
  letter-spacing: -0.01em;
}
.gooseshot-content h2 {
  font-size: 20px;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 12px;
  color: ${theme.textColor};
}
.gooseshot-content h3 {
  font-size: 17px;
  font-weight: 600;
  margin-top: 20px;
  margin-bottom: 10px;
  color: ${theme.textColor};
}
.gooseshot-content p {
  margin-bottom: 12px;
  line-height: 1.85;
}
.gooseshot-content ul, .gooseshot-content ol {
  margin-bottom: 12px;
  padding-left: 22px;
}
.gooseshot-content li {
  margin-bottom: 5px;
  line-height: 1.75;
}
.gooseshot-content ul li::marker { color: ${theme.secondaryText}; }
.gooseshot-content code {
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  font-size: 0.86em;
  background: ${theme.codeBg};
  padding: 2px 6px;
  border-radius: 4px;
  color: ${theme.textColor};
}
.gooseshot-content pre {
  background: ${theme.codeBg};
  border-radius: 10px;
  padding: 16px 18px;
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid ${theme.tableBorder};
}
.gooseshot-content pre code {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.7;
  font-family: 'JetBrains Mono', monospace;
}
.gooseshot-content blockquote {
  border-left: 3px solid ${theme.quoteBorder};
  padding-left: 18px;
  margin: 16px 0;
  color: ${theme.secondaryText};
  font-style: italic;
}
.gooseshot-content img {
  max-width: 100%;
  height: auto;
  border-radius: 10px;
  margin: 16px 0;
}
.gooseshot-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 14px;
}
.gooseshot-content th, .gooseshot-content td {
  border: 1px solid ${theme.tableBorder};
  padding: 8px 12px;
  text-align: left;
}
.gooseshot-content th {
  background: ${theme.codeBg};
  font-weight: 600;
}
.gooseshot-content hr {
  border: none;
  border-top: 1px solid ${theme.divider};
  margin: 20px 0;
}
.gooseshot-content .callout {
  background: ${theme.calloutBg};
  border-radius: 10px;
  padding: 14px 18px;
  margin: 14px 0;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.gooseshot-content .callout-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}
.gooseshot-content .callout-text {
  flex: 1;
  line-height: 1.75;
}
.gooseshot-watermark {
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid ${theme.divider};
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.gooseshot-watermark-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gooseshot-watermark-icon {
  font-size: 16px;
  line-height: 1;
}
.gooseshot-watermark-brand {
  color: ${theme.watermark};
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.gooseshot-watermark-date {
  color: ${theme.watermark};
  font-size: 11px;
  font-weight: 400;
}
.gooseshot-content strong { font-weight: 600; }
.gooseshot-content em { font-style: italic; }
.gooseshot-content del { text-decoration: line-through; }
.gooseshot-content a {
  color: ${theme.accent};
  text-decoration: none;
}
.gooseshot-content a:hover { text-decoration: underline; }
.gooseshot-content .task-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 5px;
}
.gooseshot-content .task-checkbox {
  width: 16px;
  height: 16px;
  border: 2px solid ${theme.tableBorder};
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gooseshot-content .task-checkbox.checked {
  background: ${theme.accent};
  border-color: ${theme.accent};
}
.gooseshot-content .task-checkbox.checked::after {
  content: '✓';
  color: white;
  font-size: 11px;
}
.gooseshot-selection-tag {
  display: inline-block;
  background: ${theme.accent}15;
  color: ${theme.accent};
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 12px;
  letter-spacing: 0.02em;
}
</style>
</head>
<body>
<div class="gooseshot-container">
  <div class="gooseshot-card">
    <div class="gooseshot-header">
      <div class="gooseshot-title">${escapeHtml(title || "无标题")}</div>
      ${isSelection ? '<div class="gooseshot-selection-tag">📌 选中内容</div>' : '<div class="gooseshot-subtitle">来自 鹅的笔记</div>'}
    </div>
    <div class="gooseshot-content">
      ${blocksHtml}
    </div>
    ${getWatermarkHTML(theme)}
  </div>
</div>
</body>
</html>`;
}

// ── Block Renderer ─────────────────────────────────────────────
function renderBlock(block: any, theme: typeof GRADIENT_PRESETS.light): string {
  if (!block || typeof block !== "object") return "";

  const inlineHtml = renderInline(block.content);

  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(block.props?.level || 1, 1), 3);
      return `<h${level}>${inlineHtml}</h${level}>`;
    }

    case "bulletListItem": {
      const children = block.children?.length
        ? `<ul>${block.children.map((c: any) => renderBlock(c, theme)).join("")}</ul>`
        : "";
      return `<li>${inlineHtml}${children}</li>`;
    }

    case "numberedListItem": {
      const children = block.children?.length
        ? `<ol>${block.children.map((c: any) => renderBlock(c, theme)).join("")}</ol>`
        : "";
      return `<li>${inlineHtml}${children}</li>`;
    }

    case "checkListItem": {
      const checked = block.props?.checked;
      const checkboxClass = checked ? "task-checkbox checked" : "task-checkbox";
      return `<div class="task-item"><div class="${checkboxClass}"></div><span>${inlineHtml}</span></div>`;
    }

    case "codeBlock": {
      const lang = block.props?.language || "";
      const code = block.content || "";
      const codeStr = typeof code === "string"
        ? escapeHtml(code)
        : Array.isArray(code)
          ? code.map((c: any) => escapeHtml(typeof c === "string" ? c : c?.text || "")).join("")
          : escapeHtml(String(code));
      return `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${codeStr}</code></pre>`;
    }

    case "quote": {
      return `<blockquote>${inlineHtml}</blockquote>`;
    }

    case "paragraph": {
      return inlineHtml ? `<p>${inlineHtml}</p>` : "<p></p>";
    }

    case "image":
    case "imageResize": {
      const src = block.props?.url || block.props?.src || "";
      const alt = block.props?.caption || block.props?.alt || "";
      if (!src) return "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
    }

    case "table": {
      const rows = block.content?.rows || [];
      if (!rows.length) return "";
      const htmlRows = rows.map((row: any, i: number) => {
        const cells = row.cells || [];
        const tag = i === 0 ? "th" : "td";
        return `<tr>${cells.map((cell: any) => {
          const text = typeof cell === "string" ? cell : extractCellTextForHtml(cell);
          return `<${tag}>${escapeHtml(text)}</${tag}>`;
        }).join("")}</tr>`;
      });
      return `<table><tbody>${htmlRows.join("")}</tbody></table>`;
    }

    case "divider": {
      return `<hr />`;
    }

    case "callout": {
      const icon = block.props?.icon || block.props?.emoji || "💡";
      return `<div class="callout"><div class="callout-icon">${escapeHtml(icon)}</div><div class="callout-text">${inlineHtml}</div></div>`;
    }

    case "bulletList": {
      const items = block.content || [];
      return `<ul>${items.map((item: any) => renderBlock(item, theme)).join("")}</ul>`;
    }

    case "orderedList": {
      const items = block.content || [];
      return `<ol>${items.map((item: any) => renderBlock(item, theme)).join("")}</ol>`;
    }

    default: {
      return inlineHtml ? `<p>${inlineHtml}</p>` : "";
    }
  }
}

function renderInline(content: unknown): string {
  if (typeof content === "string") return escapeHtml(content).replace(/\n/g, "<br>");
  if (!Array.isArray(content)) return "";

  return content
    .map((item: any) => {
      if (typeof item === "string") return escapeHtml(item).replace(/\n/g, "<br>");
      if (!item || typeof item !== "object") return "";

      let text = escapeHtml(item.text || "").replace(/\n/g, "<br>");
      const styles = item.styles || {};
      const marks = item.marks || [];

      let wrapper = text;

      if (styles.bold || marks.some((m: any) => m?.type === "bold")) {
        wrapper = `<strong>${wrapper}</strong>`;
      }
      if (styles.italic || marks.some((m: any) => m?.type === "italic")) {
        wrapper = `<em>${wrapper}</em>`;
      }
      if (styles.strike || marks.some((m: any) => m?.type === "strike")) {
        wrapper = `<del>${wrapper}</del>`;
      }
      if (styles.code || marks.some((m: any) => m?.type === "code")) {
        wrapper = `<code>${wrapper}</code>`;
      }

      if (item.type === "link" && item.href) {
        wrapper = `<a href="${escapeHtml(item.href)}">${wrapper}</a>`;
      }

      const linkMark = marks.find((m: any) => m?.type === "link");
      if (linkMark?.attrs?.href && item.type !== "link") {
        wrapper = `<a href="${escapeHtml(linkMark.attrs.href)}">${wrapper}</a>`;
      }

      const color = styles.color || marks.find((m: any) => m?.type === "textStyle")?.attrs?.color;
      if (color) {
        wrapper = `<span style="color:${escapeHtml(color)}">${wrapper}</span>`;
      }

      if (styles.backgroundColor || marks.some((m: any) => m?.type === "highlight")) {
        wrapper = `<mark>${wrapper}</mark>`;
      }

      if (item.type === "inlineMath" && item.attrs?.value) {
        wrapper = `<code>${escapeHtml(item.attrs.value)}</code>`;
      }

      return wrapper;
    })
    .join("");
}

function extractCellTextForHtml(cell: any): string {
  if (typeof cell === "string") return cell;
  if (Array.isArray(cell)) {
    return cell.map((c: any) => {
      if (typeof c === "string") return c;
      if (c?.text) return c.text;
      return "";
    }).join("");
  }
  if (cell?.text) return cell.text;
  if (cell?.content) {
    if (typeof cell.content === "string") return cell.content;
    if (Array.isArray(cell.content)) {
      return cell.content.map((c: any) => {
        if (typeof c === "string") return c;
        if (c?.text) return c.text;
        return "";
      }).join("");
    }
  }
  return "";
}

// ── Core Capture Logic ─────────────────────────────────────────
async function captureElementToPng(element: HTMLElement, filename: string) {
  await Promise.all([
    document.fonts.ready,
    waitForImages(element),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 300));

  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    quality: 0.95,
    cacheBust: true,
    skipFonts: false,
  });

  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const { saveBlobAndReveal } = await import("./export");
  await saveBlobAndReveal(blob, filename);
}

function waitForImages(container: HTMLElement): Promise<void> {
  const images = container.querySelectorAll("img");
  if (images.length === 0) return Promise.resolve();

  const promises = Array.from(images).map((img) => {
    return new Promise<void>((resolve) => {
      if (img.complete) { resolve(); return; }
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(() => resolve(), 2000);
    });
  });

  return Promise.all(promises).then(() => {});
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

// ── Public API: Full Page Export ───────────────────────────────
export async function exportPageToImage(page: Page, options: ExportOptions = {}) {
  const theme = getTheme(options.theme);
  const title = extractTitleFromContent(page.content);
  const content = page.content as BlockNoteContent;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  try {
    const blocksHtml = content.map((block: any) => renderBlock(block, theme)).join("\n");
    const html = buildStyledHTML({ title, blocksHtml, theme });
    container.innerHTML = html;

    const cardElement = container.querySelector(".gooseshot-container") as HTMLElement;
    if (!cardElement) throw new Error("Failed to create preview element");

    await captureElementToPng(cardElement, `${sanitizeFileName(title || "untitled")}.png`);
    trackEvent("share_image_full", { page_title_length: title?.length ?? 0 });
  } finally {
    document.body.removeChild(container);
  }
}

// ── Public API: Selection Export ───────────────────────────────
export async function exportSelectionToImage(selectionText: string, pageTitle?: string, options: ExportOptions = {}) {
  if (!selectionText.trim()) return;

  const theme = getTheme(options.theme);
  const title = pageTitle || "选中内容";

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  document.body.appendChild(container);

  try {
    // Convert plain text selection to styled paragraphs
    const paragraphs = selectionText
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("\n");

    const html = buildStyledHTML({
      title,
      blocksHtml: paragraphs,
      theme,
      isSelection: true,
    });
    container.innerHTML = html;

    const cardElement = container.querySelector(".gooseshot-container") as HTMLElement;
    if (!cardElement) throw new Error("Failed to create preview element");

    await captureElementToPng(cardElement, `${sanitizeFileName(title)}_选中内容.png`);
    trackEvent("share_image_selection", { selection_length: selectionText.length });
  } finally {
    document.body.removeChild(container);
  }
}

// ── Legacy alias ───────────────────────────────────────────────
export async function exportToImage(page: Page, options: ExportOptions = {}) {
  return exportPageToImage(page, options);
}
