import type { BlockNoteContent } from "@/lib/blocknote-content";
import { isBlockNoteContent } from "@/lib/blocknote-content";

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
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item: any) => {
      if (typeof item === "string") return item;
      if (item?.type === "link") {
        const linkText = extractLinkText(item.content);
        return `[${linkText}](${item.href || ""})`;
      }
      let text = item?.text || "";
      const styles = item?.styles || {};
      if (styles.bold) text = `**${text}**`;
      if (styles.italic) text = `*${text}*`;
      if (styles.strike) text = `~~${text}~~`;
      if (styles.code) text = `\`${text}\``;
      return text;
    })
    .join("");
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
    case "codeBlock":
      result = `\`\`\`${serializeCodeFenceInfo(block.props?.language || "", block.props)}\n${text}\n\`\`\``;
      break;
    case "image":
      result = `![${block.props?.caption || ""}](${block.props?.url || ""})`;
      break;
    case "table": {
      const rows = block.content?.rows || [];
      if (!rows.length) return "";
      const tableRows = rows.map((row: any) => row.cells || []);
      const header = tableRows[0].map((cell: any) => blockNoteInlineToText(cell)).join(" | ");
      const separator = tableRows[0].map(() => "---").join(" | ");
      const body = tableRows.slice(1).map((row: any[]) => row.map((cell: any) => blockNoteInlineToText(cell)).join(" | "));
      result = [`| ${header} |`, `| ${separator} |`, ...body.map((row: string) => `| ${row} |`)].join("\n");
      break;
    }
    case "callout":
      result = `> [!INFO] ${block.props?.icon || "💡"} ${text}`;
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
    return blocks.map(blockNoteBlockToMarkdown).join("\n");
  }

  return "";
}
