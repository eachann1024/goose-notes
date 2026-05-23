import type { PartialBlock } from "@blocknote/core";
import type { BlockNoteContent } from "./emptyContent";
import { isBlockNoteContent, createEmptyBlockNoteContent } from "./emptyContent";
import { normalizeBlockContent, ensureFirstTitleHeading } from "./normalize";

export interface LegacyPageContent {
  type?: string;
  text?: string;
  attrs?: Record<string, any>;
  marks?: Array<{ type?: string; attrs?: Record<string, any> }>;
  content?: LegacyPageContent[];
}

export type PageContent = BlockNoteContent | LegacyPageContent;

function textFromLegacy(node: LegacyPageContent | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map(textFromLegacy).join("");
}

function inlineFromLegacy(node: LegacyPageContent | undefined): any[] | string {
  const text = textFromLegacy(node);
  return text || "";
}

function childrenFromLegacy(nodes: LegacyPageContent[] | undefined): PartialBlock[] {
  return (nodes ?? []).flatMap((node) => legacyNodeToBlocks(node));
}

function listItemsToBlocks(
  nodes: LegacyPageContent[] | undefined,
  type: "bulletListItem" | "numberedListItem" | "checkListItem",
): PartialBlock[] {
  return (nodes ?? []).map((item) => {
    const first = item.content?.[0];
    const nested = item.content?.slice(1) ?? [];
    return {
      type,
      props:
        type === "checkListItem"
          ? { checked: item.attrs?.checked === true }
          : undefined,
      content: inlineFromLegacy(first),
      children: childrenFromLegacy(nested),
    } as PartialBlock;
  });
}

function tableFromLegacy(node: LegacyPageContent): PartialBlock {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) => textFromLegacy(cell)),
  );
  return {
    type: "table",
    content: {
      type: "tableContent",
      rows: rows.map((cells) => ({ cells })),
    },
  } as PartialBlock;
}

function legacyNodeToBlocks(node: LegacyPageContent): PartialBlock[] {
  switch (node.type) {
    case "heading":
      return [
        {
          type: "heading",
          props: {
            level: Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 3),
          },
          content: inlineFromLegacy(node),
        } as PartialBlock,
      ];
    case "paragraph":
      return [{ type: "paragraph", content: inlineFromLegacy(node) } as PartialBlock];
    case "blockquote":
      return [{ type: "quote", content: inlineFromLegacy(node) } as PartialBlock];
    case "codeBlock":
      return [
        {
          type: "codeBlock",
          props: {
            language: node.attrs?.language || "",
            ...(node.attrs?.summary ? { summary: node.attrs.summary } : {}),
            ...(node.attrs?.collapsed ? { collapsed: node.attrs.collapsed } : {}),
            ...(node.attrs?.wrap != null ? { wrap: node.attrs.wrap } : {}),
          },
          content: textFromLegacy(node),
        } as PartialBlock,
      ];
    case "bulletList":
      return listItemsToBlocks(node.content, "bulletListItem");
    case "orderedList":
      return listItemsToBlocks(node.content, "numberedListItem");
    case "taskList":
      return listItemsToBlocks(node.content, "checkListItem");
    case "table":
      return [tableFromLegacy(node)];
    case "image":
    case "imageResize":
      return [
        {
          type: "image",
          props: {
            url: node.attrs?.src || node.attrs?.url || "",
            caption: node.attrs?.alt || node.attrs?.title || "",
          },
        } as PartialBlock,
      ];
    case "horizontalRule":
      return [{ type: "paragraph", content: "---" } as PartialBlock];
    default: {
      const text = textFromLegacy(node).trim();
      if (text) return [{ type: "paragraph", content: text } as PartialBlock];
      return childrenFromLegacy(node.content);
    }
  }
}

export function normalizePageContent(content: PageContent | null | undefined): BlockNoteContent {
  if (!content) return createEmptyBlockNoteContent();
  if (isBlockNoteContent(content)) {
    const sanitized = normalizeBlockContent(content);
    return sanitized.length
      ? ensureFirstTitleHeading(sanitized)
      : createEmptyBlockNoteContent();
  }
  const blocks = normalizeBlockContent(childrenFromLegacy(content.content));
  return blocks.length
    ? ensureFirstTitleHeading(blocks)
    : createEmptyBlockNoteContent();
}
