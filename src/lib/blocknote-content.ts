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

const TITLE_HEADING_LEVEL = 1;

const titleHeadingBlock = (content = ""): PartialBlock =>
  ({
    type: "heading",
    props: { level: TITLE_HEADING_LEVEL, isToggleable: true },
    content,
  }) as PartialBlock;

function withToggleableHeadingProps(block: PartialBlock): PartialBlock {
  if (block.type !== "heading") return block;
  return {
    ...block,
    props: {
      ...block.props,
      isToggleable: true,
    },
  } as PartialBlock;
}

export function ensureToggleableHeadings(content: BlockNoteContent): BlockNoteContent {
  return content.map((block) => {
    const nextBlock = withToggleableHeadingProps(block);
    if (!Array.isArray(nextBlock.children) || nextBlock.children.length === 0) {
      return nextBlock;
    }
    return {
      ...nextBlock,
      children: ensureToggleableHeadings(nextBlock.children as BlockNoteContent),
    } as PartialBlock;
  });
}

export function createEmptyBlockNoteContent(title = ""): BlockNoteContent {
  return [titleHeadingBlock(title), emptyBlock()];
}

export function isBlockNoteContent(content: unknown): content is BlockNoteContent {
  return Array.isArray(content);
}

const VALID_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "table",
  "image",
  "video",
  "file",
  "audio",
  "codeBlock",
  "quote",
  "alert",
  "link",
  "embed",
  "toggleListItem",
]);

function simpleExtractText(block: any): string {
  if (!block || typeof block !== "object") return "";
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((inline: any) =>
        typeof inline === "string" ? inline : inline?.text ?? "",
      )
      .join("");
  }
  if (block.content?.rows) {
    const rows = block.content.rows as any[];
    return rows
      .flatMap((row) =>
        (row.cells ?? []).map((cell: any) =>
          typeof cell === "string" ? cell : simpleExtractText(cell),
        ),
      )
      .join(" ");
  }
  return "";
}

function sanitizeBlock(block: any): PartialBlock | null {
  if (!block || typeof block !== "object") return null;

  const type = block.type;
  if (!type || !VALID_BLOCK_TYPES.has(type)) {
    const text = simpleExtractText(block).trim();
    if (text) return { type: "paragraph", content: text };
    return null;
  }

  const children = Array.isArray(block.children)
    ? (block.children.map(sanitizeBlock).filter(Boolean) as PartialBlock[])
    : undefined;

  const sanitized: PartialBlock = { type };
  if (block.props) sanitized.props = block.props;
  if (block.content !== undefined) sanitized.content = block.content;
  if (children?.length) sanitized.children = children;

  return withToggleableHeadingProps(sanitized);
}

function canUseAsHeadingContent(block: PartialBlock): boolean {
  return typeof block.content === "string" || Array.isArray(block.content);
}

export function ensureFirstTitleHeading(content: BlockNoteContent): BlockNoteContent {
  const [firstBlock, ...restBlocks] = content;

  if (!firstBlock) {
    return createEmptyBlockNoteContent();
  }

  if (firstBlock.type === "heading") {
    return [
      {
        ...firstBlock,
        props: {
          ...firstBlock.props,
          level: TITLE_HEADING_LEVEL,
          isToggleable: true,
        },
      } as PartialBlock,
      ...restBlocks,
    ];
  }

  if (canUseAsHeadingContent(firstBlock)) {
    const content =
      typeof firstBlock.content === "string" || Array.isArray(firstBlock.content)
        ? firstBlock.content
        : "";

    return [
      {
        type: "heading",
        props: {
          ...firstBlock.props,
          level: TITLE_HEADING_LEVEL,
          isToggleable: true,
        },
        content,
        children: firstBlock.children,
      } as PartialBlock,
      ...restBlocks,
    ];
  }

  return [titleHeadingBlock(), firstBlock, ...restBlocks];
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
          props: {
            level: Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 3),
            isToggleable: true,
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
    const sanitized = content.map(sanitizeBlock).filter(Boolean) as PartialBlock[];
    return sanitized.length
      ? ensureToggleableHeadings(ensureFirstTitleHeading(sanitized))
      : createEmptyBlockNoteContent();
  }
  const blocks = childrenFromLegacy(content.content);
  return blocks.length
    ? ensureToggleableHeadings(ensureFirstTitleHeading(blocks))
    : createEmptyBlockNoteContent();
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
