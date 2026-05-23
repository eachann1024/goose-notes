import type { CardTheme } from "./themes";
import type { WatermarkConfig } from "./watermark";
import { DEFAULT_WATERMARK_CONFIG, getWatermarkHTML } from "./watermark";

// ── Utilities ──────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BLOCKNOTE_TEXT_COLORS: Record<string, string> = {
  gray: "#9b9a97",
  brown: "#64473a",
  red: "#e03e3e",
  orange: "#d9730d",
  yellow: "#dfab01",
  green: "#4d6461",
  blue: "#0b6e99",
  purple: "#6940a5",
  pink: "#ad1a72",
};

const BLOCKNOTE_BACKGROUND_COLORS: Record<string, string> = {
  gray: "#ebeced",
  brown: "#e9e5e3",
  red: "#fbe4e4",
  orange: "#f6e9d9",
  yellow: "#fbf3db",
  green: "#ddedea",
  blue: "#ddebf1",
  purple: "#eae4f2",
  pink: "#f4dfeb",
};

function resolveExportColor(
  value: unknown,
  palette: Record<string, string>,
): string | null {
  if (typeof value !== "string" || value === "" || value === "default") return null;
  return palette[value] || value;
}

// ── Google Fonts Loader ────────────────────────────────────────
function getGoogleFontsUrl(): string {
  const families = [
    "Inter:wght@400;500;600;700;800;900",
    "Noto+Sans+SC:wght@300;400;500;600;700",
    "Noto+Serif+SC:wght@400;600;700",
    "JetBrains+Mono:wght@400;500",
    "Georgia",
    "Courier+Prime:wght@400;700",
    "ZCOOL+XiaoWei",
    "Ma+Shan+Zheng",
    "Geist:wght@400;500;600;700",
    "Geist+Mono:wght@400;500",
    "Space+Grotesk:wght@400;500;600;700",
    "Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600",
    "IBM+Plex+Sans:wght@400;500;600",
    "IBM+Plex+Mono:wght@400;500",
  ];
  return `https://fonts.googleapis.com/css2?family=${families.join("&family=")}&display=swap`;
}

// ── Styled HTML Builder ────────────────────────────────────────
export function buildStyledHTML(params: {
  title: string;
  blocksHtml: string;
  theme: CardTheme;
  isSelection?: boolean;
  watermarkConfig?: WatermarkConfig;
}): string {
  const { title, blocksHtml, theme, watermarkConfig } = params;
  const t = theme;

  const decoStyle = t.showDecorations
    ? `
    .gooseshot-container::before {
      content: '';
      position: absolute;
      top: -120px; right: -80px;
      width: 360px; height: 360px;
      background: radial-gradient(circle, ${t.decorationColor} 0%, transparent 70%);
      border-radius: 50%;
    }
    .gooseshot-container::after {
      content: '';
      position: absolute;
      bottom: -100px; left: -60px;
      width: 280px; height: 280px;
      background: radial-gradient(circle, ${t.decorationColor} 0%, transparent 70%);
      border-radius: 50%;
    }`
    : "";

  const titleStyle = `
    font-family: ${t.titleFont};
    font-size: ${t.titleFontSize}px;
    font-weight: ${t.titleFontWeight};
    line-height: ${t.titleLineHeight};
    letter-spacing: ${t.titleLetterSpacing};
    color: ${t.textColor};
    text-align: ${t.titleAlign};
  `;

  const headerBorder = "margin-bottom: 24px; padding-bottom: 0; border-bottom: none;";

  const bodyTextAlign = t.id === "academic" ? "text-align: justify;" : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="${getGoogleFontsUrl()}">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: ${t.bodyFont};
  color: ${t.textColor};
  line-height: ${t.bodyLineHeight};
  font-size: ${t.bodyFontSize}px;
  letter-spacing: ${t.bodyLetterSpacing};
  ${bodyTextAlign}
}
.gooseshot-container {
  background: ${t.background};
  padding: ${t.containerPaddingY}px ${t.containerPaddingX}px;
  min-width: 680px;
  max-width: 1200px;
  position: relative;
  overflow: hidden;
}
${decoStyle}
.gooseshot-card {
  background: ${t.cardBg};
  border-radius: ${t.cardRadius}px;
  padding: ${t.cardPaddingY}px ${t.cardPaddingX}px;
  box-shadow: ${t.cardShadow};
  position: relative;
  z-index: 1;
  border: ${t.cardBorder};
}
.gooseshot-header {
  ${headerBorder}
}
.gooseshot-title {
  ${titleStyle}
}
.gooseshot-content > * { margin-bottom: 14px; }
.gooseshot-content > *:last-child { margin-bottom: 0; }
.gooseshot-content h1 {
  font-family: ${t.titleFont};
  font-size: ${Math.round(t.titleFontSize * 0.85)}px;
  font-weight: ${t.titleFontWeight};
  margin-top: 28px;
  margin-bottom: 14px;
  color: ${t.textColor};
  line-height: 1.3;
}
.gooseshot-content h2 {
  font-family: ${t.titleFont};
  font-size: ${Math.round(t.titleFontSize * 0.7)}px;
  font-weight: ${Math.max(t.titleFontWeight - 100, 400)};
  margin-top: 24px;
  margin-bottom: 12px;
  color: ${t.textColor};
}
.gooseshot-content h3 {
  font-family: ${t.titleFont};
  font-size: ${Math.round(t.titleFontSize * 0.6)}px;
  font-weight: 600;
  margin-top: 20px;
  margin-bottom: 10px;
  color: ${t.textColor};
}
.gooseshot-content p {
  margin-bottom: 12px;
  line-height: ${t.bodyLineHeight};
}
.gooseshot-content ul, .gooseshot-content ol {
  margin-bottom: 12px;
  padding-left: 22px;
}
.gooseshot-content li {
  margin-bottom: 5px;
  line-height: 1.75;
}
.gooseshot-content ul li::marker { color: ${t.secondaryText}; }
.gooseshot-content code {
  font-family: ${t.codeFont};
  font-size: 0.86em;
  background: ${t.codeBg};
  padding: 2px 6px;
  border-radius: 4px;
  color: ${t.codeTextColor ?? t.textColor};
}
.gooseshot-content pre {
  background: ${t.codeBg};
  border-radius: 10px;
  padding: 16px 18px;
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid ${t.tableBorder};
  color: ${t.codeTextColor ?? t.textColor};
}
.gooseshot-content pre code {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.7;
  font-family: ${t.codeFont};
  color: inherit;
}
.gooseshot-content blockquote {
  border-left: 3px solid ${t.quoteBorder};
  padding-left: 18px;
  margin: 16px 0;
  color: ${t.secondaryText};
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
  border: 1px solid ${t.tableBorder};
  padding: 8px 12px;
  text-align: left;
}
.gooseshot-content th {
  background: ${t.codeBg};
  font-weight: 600;
}
.gooseshot-content hr {
  border: none;
  border-top: 1px solid ${t.divider};
  margin: 20px 0;
}
.gooseshot-content .callout {
  background: ${t.calloutBg};
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
  border-top: 1px solid ${t.divider};
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
  color: ${t.watermark};
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.gooseshot-watermark-date {
  color: ${t.watermark};
  font-size: 11px;
  font-weight: 400;
}
.gooseshot-content strong { font-weight: 600; }
.gooseshot-content em { font-style: italic; }
.gooseshot-content del { text-decoration: line-through; }
.gooseshot-content a {
  color: ${t.accent};
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
  border: 2px solid ${t.tableBorder};
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gooseshot-content .task-checkbox.checked {
  background: ${t.accent};
  border-color: ${t.accent};
}
.gooseshot-content .task-checkbox.checked::after {
  content: '✓';
  color: white;
  font-size: 11px;
}
.gooseshot-selection-tag {
  display: inline-block;
  background: ${t.accent}15;
  color: ${t.accent};
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
    ${(watermarkConfig?.showTitle ?? true) ? `<div class="gooseshot-header">
      <div class="gooseshot-title">${escapeHtml(title || "无标题")}</div>
    </div>` : ""}
    <div class="gooseshot-content">
      ${blocksHtml}
    </div>
    ${getWatermarkHTML(theme, watermarkConfig ?? DEFAULT_WATERMARK_CONFIG)}
  </div>
</div>
</body>
</html>`;
}

// ── Block Renderer ─────────────────────────────────────────────
export function renderBlock(block: any, theme: CardTheme): string {
  if (!block || typeof block !== "object") return "";

  const inlineHtml = renderInline(block.content);
  const alignStyle = block.props?.textAlignment === "center"
    ? ' style="text-align:center"'
    : block.props?.textAlignment === "right"
      ? ' style="text-align:right"'
      : block.props?.textAlignment === "justify"
        ? ' style="text-align:justify"'
        : "";

  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(block.props?.level || 1, 1), 3);
      return `<h${level}${alignStyle}>${inlineHtml}</h${level}>`;
    }

    case "bulletListItem": {
      const children = block.children?.length
        ? `<ul>${block.children.map((c: any) => renderBlock(c, theme)).join("")}</ul>`
        : "";
      return `<li${alignStyle}>${inlineHtml}${children}</li>`;
    }

    case "numberedListItem": {
      const children = block.children?.length
        ? `<ol>${block.children.map((c: any) => renderBlock(c, theme)).join("")}</ol>`
        : "";
      return `<li${alignStyle}>${inlineHtml}${children}</li>`;
    }

    case "checkListItem": {
      const checked = block.props?.checked;
      const checkboxClass = checked ? "task-checkbox checked" : "task-checkbox";
      return `<div class="task-item"${alignStyle}><div class="${checkboxClass}"></div><span>${inlineHtml}</span></div>`;
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
      return `<blockquote${alignStyle}>${inlineHtml}</blockquote>`;
    }

    case "paragraph": {
      return inlineHtml ? `<p${alignStyle}>${inlineHtml}</p>` : `<p${alignStyle}></p>`;
    }

    case "image":
    case "imageResize":
    case "file": {
      const src = block.props?.url || block.props?.src || "";
      const alt = block.props?.caption || block.props?.alt || block.props?.name || "";
      if (!src) return "";
      const alignment = block.props?.textAlignment || block.props?.alignment;
      const imgAlignStyle = alignment === "center" ? "display:block;margin-left:auto;margin-right:auto;"
        : alignment === "right" ? "display:block;margin-left:auto;"
        : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${imgAlignStyle}" />`;
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
      return inlineHtml ? `<p${alignStyle}>${inlineHtml}</p>` : "";
    }
  }
}

export function renderInline(content: unknown): string {
  if (typeof content === "string") return escapeHtml(content).replace(/\n/g, "<br>");
  if (!Array.isArray(content)) return "";

  return content
    .map((item: any) => {
      if (typeof item === "string") return escapeHtml(item).replace(/\n/g, "<br>");
      if (!item || typeof item !== "object") return "";

      // Handle inline image nodes (e.g. pasted/dragged images within text)
      if (item.type === "image" && item.attrs?.src) {
        const src = item.attrs.src;
        const alt = item.attrs.alt || "";
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;border-radius:8px;display:inline-block;vertical-align:middle;" />`;
      }

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
      if (styles.underline || marks.some((m: any) => m?.type === "underline")) {
        wrapper = `<u>${wrapper}</u>`;
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

      const textColor =
        styles.textColor ||
        marks.find((m: any) => m?.type === "textColor")?.attrs?.color ||
        marks.find((m: any) => m?.type === "textStyle")?.attrs?.color ||
        styles.color;
      const resolvedTextColor = resolveExportColor(textColor, BLOCKNOTE_TEXT_COLORS);
      if (resolvedTextColor) {
        wrapper = `<span style="color:${escapeHtml(resolvedTextColor)}">${wrapper}</span>`;
      }

      const bgColor =
        styles.backgroundColor ||
        marks.find((m: any) => m?.type === "backgroundColor")?.attrs?.color ||
        marks.find((m: any) => m?.type === "highlight")?.attrs?.color;
      const resolvedBgColor = resolveExportColor(bgColor, BLOCKNOTE_BACKGROUND_COLORS);
      if (resolvedBgColor) {
        wrapper = `<span style="background-color:${escapeHtml(resolvedBgColor)};border-radius:2px;padding:0 2px;">${wrapper}</span>`;
      }

      if (item.type === "inlineMath" && item.attrs?.value) {
        wrapper = `<code>${escapeHtml(item.attrs.value)}</code>`;
      }

      return wrapper;
    })
    .join("");
}

export function extractInlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item: any) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      if (item.type === "inlineMath" && item.attrs?.value) {
        return item.attrs.value;
      }
      return item.text || "";
    })
    .join("");
}

export function extractCellTextForHtml(cell: any): string {
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
