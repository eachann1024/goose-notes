import type { BlockNoteContent } from "@/lib/blocknote-content";
import {
  normalizeBlockContent,
  normalizePageContent,
  createEmptyBlockNoteContent,
} from "@/lib/blocknote-content";

export interface ImportResult {
  title: string;
  content: BlockNoteContent;
  success: boolean;
  error?: string;
  filename?: string;
}

const CODE_BLOCK_META_PREFIX = "goose-note=";

function isLegacyCodeBlockMetaComment(line: string): boolean {
  return /^<!--\s*goose-note:codeblock\s+.+?\s*-->$/.test(line);
}

function normalizeCodeBlockSummary(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n]+/g, " ").trim();
}

function parseCodeFenceInfo(infoLine: string): {
  language: string;
  summary: string;
  collapsed: boolean;
} {
  const tokens = infoLine.trim().split(/\s+/).filter(Boolean);
  let language = "";
  let summary = "";
  let collapsed = false;

  for (const token of tokens) {
    if (token.startsWith(CODE_BLOCK_META_PREFIX)) {
      const encoded = token.slice(CODE_BLOCK_META_PREFIX.length);
      if (!encoded) continue;

      try {
        const parsed = JSON.parse(decodeURIComponent(encoded));
        if (parsed && typeof parsed === "object") {
          const candidateSummary = normalizeCodeBlockSummary(
            (parsed as Record<string, unknown>).summary,
          );
          if (candidateSummary) {
            summary = candidateSummary;
          }
          if ((parsed as Record<string, unknown>).collapsed === true) {
            collapsed = true;
          }
        }
      } catch {}
      continue;
    }

    if (!language) {
      language = token;
    }
  }

  return {
    language,
    summary,
    collapsed,
  };
}

function alignToContainerStyle(align: "left" | "center" | "right"): string {
  const marginMap = {
    left: "margin: 0 auto 0 0;",
    center: "margin: 0 auto;",
    right: "margin: 0 0 0 auto;",
  };
  return marginMap[align];
}

function parseInlineMarkdown(text: string): any[] {
  const result: any[] = [];
  if (!text) return result;

  const regex =
    /(\$((?:\\\$|[^\$])+?)\$|<span\s+style="([^"]+)">(.+?)<\/span>|==(.+?)==|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  function pushPlain(t: string) {
    if (!t) return;
    result.push(t);
  }

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      pushPlain(`$${match[2]}$`);
    } else if (match[3] && match[4]) {
      const style = match[3];
      const innerText = match[4];
      const styles: Record<string, any> = {};

      const colorMatch = style.match(/color:\s*([^;]+)/);
      if (colorMatch) {
        styles.textColor = colorMatch[1].trim();
      }

      const bgMatch = style.match(/background-color:\s*([^;]+)/);
      if (bgMatch) {
        styles.backgroundColor = bgMatch[1].trim();
      }

      result.push({ type: "text", text: innerText, styles });
    } else if (match[5]) {
      result.push({ type: "text", text: match[5], styles: { backgroundColor: "yellow" } });
    } else if (match[6]) {
      result.push({ type: "text", text: match[6], styles: { bold: true } });
    } else if (match[7]) {
      result.push({ type: "text", text: match[7], styles: { italic: true } });
    } else if (match[8]) {
      result.push({ type: "text", text: match[8], styles: { strike: true } });
    } else if (match[9]) {
      result.push({ type: "text", text: match[9], styles: { code: true } });
    } else if (match[10] && match[11]) {
      result.push({
        type: "link",
        href: match[11],
        content: [{ type: "text", text: match[10], styles: {} }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    pushPlain(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}

function markdownToJsonContent(markdown: string): any {
  const lines = markdown
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const content: any[] = [];
  let i = 0;

  if (lines.length > 0 && lines[0].trim() === "---") {
    const frontmatterLines: string[] = [];
    i++;
    while (i < lines.length && lines[i].trim() !== "---") {
      frontmatterLines.push(lines[i]);
      i++;
    }
    if (i < lines.length && lines[i].trim() === "---") {
      content.push({
        type: "codeBlock",
        attrs: { language: "yaml-frontmatter" },
        content: [{ type: "text", text: frontmatterLines.join("\n") }],
      });
      i++;
    } else {
      i = 0;
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (isLegacyCodeBlockMetaComment(trimmedLine)) {
      i++;
      continue;
    }

    if (trimmedLine.startsWith("<details>")) {
      const detailsLines: string[] = [];
      let summaryText = "详情";
      i++;
      while (i < lines.length && !lines[i].trim().includes("</details>")) {
        const line = lines[i].trim();
        if (line.startsWith("<summary>") && line.endsWith("</summary>")) {
          summaryText = line.replace("<summary>", "").replace("</summary>", "");
        } else {
          detailsLines.push(lines[i]);
        }
        i++;
      }

      const subContent = markdownToJsonContent(detailsLines.join("\n"));
      content.push({
        type: "details",
        content: [
          {
            type: "detailsSummary",
            content: [{ type: "text", text: summaryText }],
          },
          {
            type: "detailsContent",
            content: subContent.content || [],
          },
        ],
      });
      i++;
      continue;
    }

    if (trimmedLine === "$$") {
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "$$") {
        mathLines.push(lines[i]);
        i++;
      }
      content.push({
        type: "codeBlock",
        attrs: { language: "math" },
        content: [{ type: "text", text: mathLines.join("\n") }],
      });
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const fenceInfo = parseCodeFenceInfo(line.slice(3).trim());
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      const codeBlockAttrs: Record<string, unknown> = {
        language: fenceInfo.language,
      };
      if (fenceInfo.summary) {
        codeBlockAttrs.summary = fenceInfo.summary;
      }
      if (fenceInfo.collapsed) {
        codeBlockAttrs.collapsed = true;
      }
      content.push({
        type: "codeBlock",
        attrs: codeBlockAttrs,
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInlineMarkdown(headingMatch[2]),
      });
      i++;
      continue;
    }

    if (line.match(/^---+$/)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    if (trimmedLine.startsWith(">")) {
      const quoteLines: string[] = [];
      const firstLine = trimmedLine.slice(1).trim();

      const calloutMatch = firstLine.match(
        /^\[!INFO\]\s+(?:([\uD800-\uDBFF][\uDC00-\uDFFF]|\S))\s+(.+)$/i,
      );

      if (calloutMatch) {
        content.push({
          type: "callout",
          attrs: { emoji: calloutMatch[1] },
          content: parseInlineMarkdown(calloutMatch[2]),
        });
        i++;
        continue;
      }

      quoteLines.push(firstLine);
      i++;

      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().slice(1).trim());
        i++;
      }
      content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: parseInlineMarkdown(quoteLines.join(" ")),
          },
        ],
      });
      continue;
    }

    const isTableSeparator = (value: string) => {
      const v = value.trim();
      return /^\|?(\s*:?-+:?\s*\|?)+$/.test(v) && v.includes("-");
    };

    const splitTableRow = (value: string) => {
      const trimmed = value.trim();
      const content = trimmed.replace(/^\|/, "").replace(/\|$/, "");
      return content.split("|").map((cell: any) => cell.trim());
    };

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headerCells = splitTableRow(line);
      i += 2;

      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        if (isTableSeparator(lines[i])) {
          i++;
          continue;
        }
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }

      const toCell = (text: string, type: "tableHeader" | "tableCell") => ({
        type: "tableCell",
        attrs: { ...((type === "tableHeader" && { isHeader: true }) || {}) },
        content: [
          {
            type: "paragraph",
            content: parseInlineMarkdown(text.replace(/\\\|/g, "|")),
          },
        ],
      });

      const headerRow = {
        type: "tableRow",
        content: headerCells.map((cell: any) => toCell(cell, "tableHeader")),
      };

      const bodyRowNodes = bodyRows.map((row: any) => ({
        type: "tableRow",
        content: row.map((cell: any) => toCell(cell, "tableCell")),
      }));

      content.push({
        type: "table",
        content: [headerRow, ...bodyRowNodes],
      });
      continue;
    }

    const taskMatch = line.match(/^-\s+\[([ x])\]\s+(.+)$/);
    if (taskMatch) {
      const items: any[] = [];
      while (i < lines.length) {
        const tm = lines[i].match(/^-\s+\[([ x])\]\s+(.+)$/);
        if (!tm) break;
        items.push({
          type: "taskItem",
          attrs: { checked: tm[1] === "x" },
          content: [{ type: "paragraph", content: parseInlineMarkdown(tm[2]) }],
        });
        i++;
      }
      content.push({ type: "taskList", content: items });
      continue;
    }

    if (line.match(/^-\s+/)) {
      const items: any[] = [];
      while (i < lines.length && lines[i].match(/^-\s+/)) {
        const text = lines[i].replace(/^-\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInlineMarkdown(text) }],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    if (line.match(/^\d+\.\s+/)) {
      const items: any[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const text = lines[i].replace(/^\d+\.\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInlineMarkdown(text) }],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?$/);
    if (imgMatch) {
      const metaRaw = imgMatch[3] || "";
      const metaMap = new Map<string, string>();
      metaRaw
        .split(/\s+/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .forEach((chunk) => {
          const [key, value] = chunk.split("=");
          if (key && value) metaMap.set(key, value);
        });

      const align = metaMap.get("align") as
        | "left"
        | "center"
        | "right"
        | undefined;
      const containerStyle = align ? alignToContainerStyle(align) : undefined;
      const width = metaMap.get("width");
      const height = metaMap.get("height");
      const widthValue = width ? Number(width) : undefined;
      const heightValue = height ? Number(height) : undefined;
      content.push({
        type: "imageResize",
        attrs: {
          src: imgMatch[2],
          alt: imgMatch[1],
          containerStyle,
          ...(Number.isFinite(widthValue) ? { width: widthValue } : {}),
          ...(Number.isFinite(heightValue) ? { height: heightValue } : {}),
        },
      });
      i++;
      continue;
    }

    if (line.trim()) {
      const paragraphLines: string[] = [];

      while (i < lines.length) {
        const currentLine = lines[i];
        const trimmed = currentLine.trim();

        if (!trimmed) break;

        if (paragraphLines.length > 0) {
          if (
            currentLine.startsWith("#") ||
            currentLine.startsWith(">") ||
            currentLine.startsWith("```") ||
            currentLine.startsWith("$$") ||
            currentLine.match(/^-\s+\[[ x]\]/) ||
            currentLine.match(/^[-*+]\s+/) ||
            currentLine.match(/^\d+\.\s+/) ||
            currentLine.match(/^---+$/) ||
            currentLine.match(/^\|/)
          ) {
            break;
          }
        }

        paragraphLines.push(currentLine);
        i++;
      }

      if (paragraphLines.length > 0) {
        const isHtmlBlock = paragraphLines[0].trim().startsWith("<");
        const combinedText = paragraphLines.join(isHtmlBlock ? "\n" : " ");

        const inline = parseInlineMarkdown(combinedText);
        content.push(
          inline.length > 0
            ? { type: "paragraph", content: inline }
            : { type: "paragraph" },
        );
        continue;
      }
    } else if (
      content.length > 0 &&
      content[content.length - 1].type !== "paragraph"
    ) {
      content.push({ type: "paragraph" });
    }
    i++;
  }

  return { type: "doc", content };
}

export function importFromMarkdown(
  markdown: string,
  filename?: string,
): ImportResult {
  try {
    const legacyContent = markdownToJsonContent(markdown);
    const content = normalizePageContent(legacyContent);

    let title = filename || "导入的页面";
    if (!filename) {
      const h1Match = markdown.match(/^#\s+(.+)$/m);
      if (h1Match) {
        title = h1Match[1].trim();
      }
    }

    return { title, content, success: true };
  } catch (e) {
    return {
      title: "",
      content: createEmptyBlockNoteContent(),
      success: false,
      error: "解析 Markdown 失败",
    };
  }
}

export function importMarkdownFragment(markdown: string): BlockNoteContent | null {
  try {
    const parsed = markdownToJsonContent(markdown);
    const content = normalizeBlockContent(
      Array.isArray(parsed) ? parsed : parsed?.content,
    );
    return content.length > 0 ? content : null;
  } catch {
    return null;
  }
}
