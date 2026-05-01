import type { PartialBlock } from "@blocknote/core";

export type BlockNoteContent = PartialBlock[];

export interface LegacyPageContent {
  type?: string;
  text?: string;
  attrs?: Record<string, any>;
  marks?: Array<{ type?: string; attrs?: Record<string, any> }>;
  content?: LegacyPageContent[];
}

export type PageContent = BlockNoteContent | LegacyPageContent;

const emptyBlock = (): PartialBlock => ({ type: "paragraph", content: "" });

export function createEmptyBlockNoteContent(title = ""): BlockNoteContent {
  return [
    { type: "heading", props: { level: 1 }, content: title },
    emptyBlock(),
  ];
}

export function isBlockNoteContent(content: unknown): content is BlockNoteContent {
  return Array.isArray(content);
}

function textFromLegacy(node: LegacyPageContent | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(textFromLegacy).join("");
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
          props: { level: Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 3) },
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
          props: { language: node.attrs?.language || "" },
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
  if (isBlockNoteContent(content)) return content.length ? content : createEmptyBlockNoteContent();
  const blocks = childrenFromLegacy(content.content);
  return blocks.length ? blocks : createEmptyBlockNoteContent();
}

export function clonePageContent<T extends PageContent>(content: T): T {
  return JSON.parse(JSON.stringify(content)) as T;
}

export function getContentSignature(content: unknown): string {
  try {
    return JSON.stringify(content ?? null);
  } catch {
    return "__goose-note-unserializable-content__";
  }
}

export function extractPlainText(content: PageContent | undefined): string {
  if (!content) return "";
  if (!isBlockNoteContent(content)) return textFromLegacy(content).trim();

  const parts: string[] = [];
  const visit = (block: any) => {
    if (typeof block.content === "string") parts.push(block.content);
    else if (Array.isArray(block.content)) {
      for (const inline of block.content) {
        if (typeof inline === "string") parts.push(inline);
        else if (inline?.text) parts.push(inline.text);
      }
    } else if (block.content?.rows) {
      for (const row of block.content.rows) {
        for (const cell of row.cells ?? []) {
          if (typeof cell === "string") parts.push(cell);
          else parts.push(extractPlainText(cell as PageContent));
        }
      }
    }
    for (const child of block.children ?? []) visit(child);
  };
  for (const block of content) visit(block);
  return parts.join(" ").trim();
}

export function extractBlockNoteTitle(content: PageContent | undefined): string {
  const blocks = normalizePageContent(content);
  const first = blocks[0] as any;
  if (first?.type === "heading") {
    const text = extractPlainText([first]);
    if (text) return text;
  }
  return "无标题";
}
