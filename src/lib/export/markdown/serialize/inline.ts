import { sanitizeCssColor } from "../blockPropsProperties";
import { sanitizePageMentionProps, serializePageMentionMarkdown } from "@/components/editor/inline/pageMention";

function serializeInlineText(
  text: string,
  styles: Record<string, unknown>,
): string {
  const hasUnderline = styles.underline === true;
  const textColor = sanitizeCssColor(styles.textColor);
  const backgroundColor = sanitizeCssColor(styles.backgroundColor);
  const hasColor = textColor && textColor !== "default";
  const hasBg = backgroundColor && backgroundColor !== "default";
  const isYellowHighlight = hasBg && backgroundColor === "yellow" && !hasColor;

  if (styles.bold) text = `**${text}**`;
  if (styles.italic) text = `*${text}*`;
  if (styles.strike) text = `~~${text}~~`;
  if (styles.code) text = `\`${text}\``;
  if (isYellowHighlight) {
    text = `==${text}==`;
  } else if (hasColor || hasBg) {
    const parts: string[] = [];
    if (hasColor) parts.push(`color:${textColor}`);
    if (hasBg) parts.push(`background-color:${backgroundColor}`);
    text = `<span style="${escapeHtmlAttribute(parts.join("; "))}">${text}</span>`;
  }
  return hasUnderline ? `<u>${text}</u>` : text;
}

function extractLinkText(linkContent: any): string {
  if (typeof linkContent === "string") return linkContent;
  if (!Array.isArray(linkContent)) return "";
  return linkContent
    .map((child: any) => {
      if (typeof child === "string") return child;
      return serializeInlineText(child?.text || "", child?.styles || {});
    })
    .join("");
}

export function blockNoteInlineToText(content: any): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  // BlockNote 0.50 TableCell 对象形态: { type: "tableCell", content: InlineContent[] | [Paragraph] }
  if (
    typeof content === "object" &&
    !Array.isArray(content) &&
    Array.isArray(content.content)
  ) {
    return blockNoteInlineToText(content.content);
  }
  if (!Array.isArray(content)) return "";
  return content
    .map((item: any) => {
      if (typeof item === "string") return item;
      if (item == null) return "";
      // 嵌套 paragraph（markdown 导入时表格 cell 会包一层 paragraph）
      if (item.type === "paragraph" && Array.isArray(item.content)) {
        return blockNoteInlineToText(item.content);
      }
      if (item.type === "link") {
        const linkText = extractLinkText(item.content);
        return `[${linkText}](${item.href || ""})`;
      }
      if (item.type === "pageMention") {
        const mention = sanitizePageMentionProps(item);
        return mention ? serializePageMentionMarkdown(mention) : "";
      }
      return serializeInlineText(item.text || "", item.styles || {});
    })
    .join("");
}

export function escapePipeInCell(value: string): string {
  // GFM 表格 cell 里的 | 必须转义，否则会被解析成列分隔符
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
