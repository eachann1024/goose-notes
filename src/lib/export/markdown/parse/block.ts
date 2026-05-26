import { parseInlineMarkdown } from "./inline";
import {
  isLegacyCodeBlockMetaComment,
  parseCodeFenceInfo,
  alignToContainerStyle,
  parseTableBlock,
} from "./blockHelpers";

export function markdownToJsonContent(markdown: string): any {
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

    // Try parsing table
    const tableResult = parseTableBlock(lines, i, parseInlineMarkdown);
    if (tableResult) {
      content.push(tableResult.block);
      i = tableResult.nextIndex;
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
