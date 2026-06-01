import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { isBlockNoteContent } from "@/components/editor/utils/blocknote-content";

const LUCIDE_ICON_TO_EMOJI: Record<string, string> = {
  Lightbulb: "💡",
  AlertTriangle: "⚠️",
  CircleAlert: "❗",
  CircleCheck: "✅",
  Flame: "🔥",
  Pin: "📌",
  MessageSquare: "💬",
  Target: "🎯",
  Rocket: "🚀",
  Star: "⭐",
  Bell: "🔔",
  Bug: "🐛",
};

function resolveCalloutIcon(raw: string | undefined): string {
  if (!raw) return "💡";
  return LUCIDE_ICON_TO_EMOJI[raw] ?? raw;
}

const CODE_BLOCK_META_PREFIX = "goose-note=";

function normalizeCodeBlockSummary(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n]+/g, " ").trim();
}

function serializeCodeFenceInfo(
  language: string,
  attrs?: Record<string, unknown>,
): string {
  const tokens: string[] = [];
  const normalizedLanguage = typeof language === "string" ? language.trim() : "";
  if (normalizedLanguage) {
    tokens.push(normalizedLanguage);
  }

  const summary = normalizeCodeBlockSummary(attrs?.summary);
  const collapsed = attrs?.collapsed === true;
  const metadata: Record<string, unknown> = {};

  if (summary) {
    metadata.summary = summary;
  }
  if (collapsed) {
    metadata.collapsed = true;
  }

  if (Object.keys(metadata).length > 0) {
    tokens.push(
      `${CODE_BLOCK_META_PREFIX}${encodeURIComponent(JSON.stringify(metadata))}`,
    );
  }

  return tokens.join(" ");
}

function extractLinkText(linkContent: any): string {
  if (typeof linkContent === "string") return linkContent;
  if (!Array.isArray(linkContent)) return "";
  return linkContent
    .map((child: any) => {
      if (typeof child === "string") return child;
      let text = child?.text || "";
      const styles = child?.styles || {};
      if (styles.bold) text = `**${text}**`;
      if (styles.italic) text = `*${text}*`;
      if (styles.strike) text = `~~${text}~~`;
      if (styles.code) text = `\`${text}\``;
      return text;
    })
    .join("");
}

function blockNoteInlineToText(content: any): string {
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
      let text = item.text || "";
      const styles = item.styles || {};
      if (styles.bold) text = `**${text}**`;
      if (styles.italic) text = `*${text}*`;
      if (styles.strike) text = `~~${text}~~`;
      if (styles.code) text = `\`${text}\``;
      return text;
    })
    .join("");
}

function escapePipeInCell(value: string): string {
  // GFM 表格 cell 里的 | 必须转义，否则会被解析成列分隔符
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function blockNoteBlockToMarkdown(block: any): string {
  const text = blockNoteInlineToText(block.content);
  let result = "";
  switch (block.type) {
    case "heading":
      result = `${"#".repeat(block.props?.level || 1)} ${text}`;
      break;
    case "bulletListItem":
      result = `- ${text}`;
      break;
    case "numberedListItem":
      result = `1. ${text}`;
      break;
    case "checkListItem":
      result = `- [${block.props?.checked ? "x" : " "}] ${text}`;
      break;
    case "quote":
      result = `> ${text}`;
      break;
    case "codeBlock": {
      const lang = (block.props?.language || "").trim();
      // 数学公式走 $$...$$，让 remark-math/KaTeX 渲染；其他用 fenced code
      if (lang === "math" || lang === "latex") {
        result = `$$\n${text}\n$$`;
      } else {
        result = `\`\`\`${serializeCodeFenceInfo(lang, block.props)}\n${text}\n\`\`\``;
      }
      break;
    }
    case "image":
      result = `![${block.props?.caption || ""}](${block.props?.url || ""})`;
      break;
    case "table": {
      const rows = block.content?.rows || [];
      if (!rows.length) return "";
      const tableRows = rows.map((row: any) => (Array.isArray(row?.cells) ? row.cells : []));
      const colCount = Math.max(...tableRows.map((r: any[]) => r.length), 1);
      const padRow = (cells: any[]) => {
        const out = cells.map((cell) => escapePipeInCell(blockNoteInlineToText(cell)));
        while (out.length < colCount) out.push("");
        return out;
      };
      const header = padRow(tableRows[0]);
      const separator = new Array(colCount).fill("---");
      const body = tableRows.slice(1).map(padRow);
      result = [
        `| ${header.join(" | ")} |`,
        `| ${separator.join(" | ")} |`,
        ...body.map((row: string[]) => `| ${row.join(" | ")} |`),
      ].join("\n");
      break;
    }
    case "callout":
      result = `> [!INFO] ${resolveCalloutIcon(block.props?.icon)} ${text}`;
      break;
    case "divider":
      result = "---";
      break;
    case "file":
      result = `[📎 ${block.props?.name || "文件"}](${block.props?.url || ""})`;
      break;
    default:
      result = text;
  }

  if (block.children?.length) {
    const childrenMarkdown = block.children
      .map((child: any) => blockNoteBlockToMarkdown(child))
      .filter(Boolean)
      .join("\n");
    if (childrenMarkdown) {
      result += (result ? "\n" : "") + childrenMarkdown;
    }
  }

  return result;
}

export function jsonContentToMarkdown(
  content: BlockNoteContent,
  skipFirstH1 = false,
): string {
  if (isBlockNoteContent(content)) {
    let blocks = content as any[];
    if (skipFirstH1 && blocks[0]?.type === "heading") {
      blocks = blocks.slice(1);
    }
    return blocks
      .map(blockNoteBlockToMarkdown)
      .filter((s) => s !== "")
      .join("\n\n");
  }

  return "";
}
