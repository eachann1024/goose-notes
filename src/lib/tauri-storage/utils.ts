import type { JSONContent } from "@tiptap/react";
import type { Page } from "@/types";

export const normalizeSlash = (value: string) => value.replace(/\\/g, "/");

export const joinPath = (dir: string, name: string) =>
  normalizeSlash(`${dir.replace(/[\\/]+$/, "")}/${name.replace(/^[\\/]+/, "")}`);

export const sanitizeFileName = (name: string): string => {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
};

export const extractTitleFromContent = (content: JSONContent): string => {
  if (!content) return "Untitled";

  const findText = (node: JSONContent): string => {
    if (node.text) return node.text;
    if (node.content) {
      for (const child of node.content) {
        const text = findText(child);
        if (text) return text;
      }
    }
    return "";
  };

  const firstHeading = content.content?.find(
    (node) => node.type === "heading" && node.attrs?.level === 1
  );

  if (firstHeading) {
    const title = findText(firstHeading).trim();
    if (title) return title;
  }

  const firstParagraph = content.content?.find((node) => node.type === "paragraph");
  if (firstParagraph) {
    const text = findText(firstParagraph).trim();
    if (text) return text.slice(0, 50);
  }

  return "Untitled";
};

export const generateFileName = (page: Page): string => {
  const title = extractTitleFromContent(page.content) || page.id;
  const sanitized = sanitizeFileName(title);
  return `${sanitized}.md`;
};

export const generateFrontmatter = (page: Page): string => {
  const meta: Record<string, unknown> = {
    id: page.id,
    title: extractTitleFromContent(page.content),
    createdAt: new Date(page.createdAt).toISOString(),
    updatedAt: new Date(page.updatedAt).toISOString(),
  };

  if (page.icon) meta.icon = page.icon;
  if (page.isFavorite) meta.isFavorite = true;
  if (page.isFullWidth) meta.isFullWidth = true;
  if (page.fontFamily && page.fontFamily !== "default") meta.fontFamily = page.fontFamily;
  if (page.parentId) meta.parentId = page.parentId;

  const lines = Object.entries(meta)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      if (typeof v === "string") return `${k}: "${v}"`;
      return `${k}: ${v}`;
    });

  return `---\n${lines.join("\n")}\n---`;
};

export const jsonContentToMarkdown = (content: JSONContent): string => {
  if (!content || !content.content) return "";

  const convertNode = (node: JSONContent): string => {
    switch (node.type) {
      case "paragraph":
        return node.content?.map(convertNode).join("") || "";
      case "text":
        let text = node.text || "";
        if (node.marks) {
          node.marks.forEach((mark) => {
            switch (mark.type) {
              case "bold":
                text = `**${text}**`;
                break;
              case "italic":
                text = `*${text}*`;
                break;
              case "code":
                text = `\`${text}\``;
                break;
              case "strike":
                text = `~~${text}~~`;
                break;
              case "link":
                text = `[${text}](${mark.attrs?.href || ""})`;
                break;
            }
          });
        }
        return text;
      case "heading": {
        const level = node.attrs?.level || 1;
        const prefix = "#".repeat(level);
        const headingText = node.content?.map(convertNode).join("") || "";
        return `${prefix} ${headingText}`;
      }
      case "bulletList":
        return (
          node.content
            ?.map((item) => `- ${convertNode(item)}`)
            .join("\n") || ""
        );
      case "orderedList":
        return (
          node.content
            ?.map((item, i) => `${i + 1}. ${convertNode(item)}`)
            .join("\n") || ""
        );
      case "listItem":
        return node.content?.map(convertNode).join("\n") || "";
      case "codeBlock":
        const lang = node.attrs?.language || "";
        const code = node.content?.map(convertNode).join("\n") || "";
        return `\`\`\`${lang}\n${code}\n\`\`\``;
      case "blockquote":
        const quote = node.content?.map(convertNode).join("\n") || "";
        return quote
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
      case "horizontalRule":
        return "---";
      case "hardBreak":
        return "\n";
      default:
        return node.content?.map(convertNode).join("") || "";
    }
  };

  return content.content.map(convertNode).join("\n\n");
};

export const pageToMarkdown = (page: Page): string => {
  const frontmatter = generateFrontmatter(page);
  const content = jsonContentToMarkdown(page.content);
  return `${frontmatter}\n\n${content}`;
};
