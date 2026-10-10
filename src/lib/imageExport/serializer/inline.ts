import type { CardTheme } from "../themes";
import { TEXT_COLORS } from "@/lib/textColors";
import { escapeHtml, resolveExportColor } from "./utils";
import { textPalette, bgPalette } from "./blockStyles";

export function renderInline(content: unknown, theme?: CardTheme): string {
  if (typeof content === "string") return escapeHtml(content).replace(/\n/g, "<br>");
  if (!Array.isArray(content)) return "";

  return content
    .map((item: any) => {
      if (typeof item === "string") return escapeHtml(item).replace(/\n/g, "<br>");
      if (!item || typeof item !== "object") return "";

      if (item.type === "hardBreak") return "<br>";

      // 链接：BlockNote 标准形态 { type, href, content: InlineContent[] }
      if (item.type === "link") {
        const href = item.href || item.attrs?.href || "";
        const inner = renderInline(item.content, theme) || escapeHtml(item.text || href);
        if (!href) return inner;
        return `<a href="${escapeHtml(href)}">${inner}</a>`;
      }

      if (item.type === "pageMention") {
        const title =
          typeof item.props?.title === "string" && item.props.title.trim()
            ? item.props.title.trim()
            : "未命名";
        const label = title.startsWith("@") ? title : `@${title}`;
        const color = TEXT_COLORS[theme?.mode === "dark" ? "dark" : "light"].info;
        return `<span style="display:inline-flex;align-items:center;vertical-align:middle;margin:0 0.25em;padding:0 8px;border-radius:6px;background-color:${bgPalette(theme).blue};color:${color};font-size:0.85em;line-height:1.25em;">${escapeHtml(label)}</span>`;
      }

      if (item.type === "image" && item.attrs?.src) {
        const src = item.attrs.src;
        const alt = item.attrs.alt || "";
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;border-radius:8px;display:inline-block;vertical-align:middle;" />`;
      }

      if (item.type === "inlineMath" && item.attrs?.value) {
        return `<code class="inline-math">${escapeHtml(item.attrs.value)}</code>`;
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

      const linkMark = marks.find((m: any) => m?.type === "link");
      if (linkMark?.attrs?.href) {
        wrapper = `<a href="${escapeHtml(linkMark.attrs.href)}">${wrapper}</a>`;
      }

      const textColor =
        styles.textColor ||
        marks.find((m: any) => m?.type === "textColor")?.attrs?.color ||
        marks.find((m: any) => m?.type === "textColor")?.attrs?.stringValue ||
        marks.find((m: any) => m?.type === "textStyle")?.attrs?.color ||
        styles.color;
      const resolvedTextColor = resolveExportColor(textColor, textPalette(theme));
      if (resolvedTextColor) {
        wrapper = `<span style="color:${escapeHtml(resolvedTextColor)}">${wrapper}</span>`;
      }

      const bgColor =
        styles.backgroundColor ||
        marks.find((m: any) => m?.type === "backgroundColor")?.attrs?.color ||
        marks.find((m: any) => m?.type === "backgroundColor")?.attrs?.stringValue ||
        marks.find((m: any) => m?.type === "highlight")?.attrs?.color;
      const resolvedBgColor = resolveExportColor(bgColor, bgPalette(theme));
      if (resolvedBgColor) {
        wrapper = `<span style="background-color:${escapeHtml(resolvedBgColor)};border-radius:2px;padding:0 2px;">${wrapper}</span>`;
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
      if (item.type === "hardBreak") return "\n";
      if (item.type === "link") return extractInlineText(item.content) || item.text || "";
      if (item.type === "pageMention") {
        const title =
          typeof item.props?.title === "string" && item.props.title.trim()
            ? item.props.title.trim()
            : "";
        return title ? (title.startsWith("@") ? title : `@${title}`) : "";
      }
      if (item.type === "inlineMath" && item.attrs?.value) return item.attrs.value;
      return item.text || "";
    })
    .join("");
}

export function extractCellTextForHtml(cell: any): string {
  if (typeof cell === "string") return cell;
  if (Array.isArray(cell)) {
    return cell
      .map((c: any) => {
        if (typeof c === "string") return c;
        if (c?.type === "link") return extractInlineText(c.content) || c.text || "";
        if (c?.text) return c.text;
        if (c?.type === "paragraph") return extractInlineText(c.content);
        return "";
      })
      .join("");
  }
  if (cell?.text) return cell.text;
  if (cell?.content) {
    if (typeof cell.content === "string") return cell.content;
    if (Array.isArray(cell.content)) return extractCellTextForHtml(cell.content);
  }
  return "";
}
