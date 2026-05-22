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
    props: { level: TITLE_HEADING_LEVEL },
    content,
  }) as PartialBlock;

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

const LEGACY_BLOCK_TYPES = new Set([
  "blockquote",
  "paragraph",
  "heading",
  "codeBlock",
  "bulletList",
  "orderedList",
  "taskList",
  "table",
  "image",
  "imageResize",
  "horizontalRule",
]);

function simpleExtractText(block: any): string {
  if (!block || typeof block !== "object") return "";
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((inline: any) => {
        if (typeof inline === "string") return inline;
        if (inline?.type === "link" && Array.isArray(inline.content)) {
          return inline.content.map((c: any) => c?.text ?? "").join("");
        }
        return inline?.text ?? "";
      })
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

function isStructuredBlockLike(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const candidateType = (node as { type?: unknown }).type;
  return (
    typeof candidateType === "string" &&
    (VALID_BLOCK_TYPES.has(candidateType) || LEGACY_BLOCK_TYPES.has(candidateType))
  );
}

function hasStructuredBlocks(value: unknown): value is any[] {
  return Array.isArray(value) && value.some((item) => isStructuredBlockLike(item));
}

function normalizeInlineContent(content: unknown): PartialBlock["content"] {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content) && !hasStructuredBlocks(content)) {
    return content;
  }
  const text = simpleExtractText({ content });
  return text || "";
}

function createParagraphFromInlineContent(
  content: PartialBlock["content"] | undefined,
): PartialBlock | null {
  if (typeof content === "string") {
    return content.trim() ? ({ type: "paragraph", content } as PartialBlock) : null;
  }
  if (Array.isArray(content)) {
    const text = simpleExtractText({ content }).trim();
    return text ? ({ type: "paragraph", content } as PartialBlock) : null;
  }
  return null;
}

function hasInlineText(content: unknown): boolean {
  return simpleExtractText({ content }).trim().length > 0;
}

function isEmptyWrapperBlock(type: string, block: any): boolean {
  if (
    ![
      "paragraph",
      "heading",
      "bulletListItem",
      "numberedListItem",
      "checkListItem",
    ].includes(type)
  ) {
    return false;
  }
  return !hasInlineText(block.content);
}

function getPlainBlockText(block: PartialBlock | undefined): string {
  if (!block) return "";
  return simpleExtractText(block).trim();
}

function getDetachedListMarkerType(
  block: PartialBlock | undefined,
): "bulletListItem" | "numberedListItem" | null {
  if (!block || block.type !== "paragraph") return null;
  if ((block as any).children?.length) return null;

  const text = getPlainBlockText(block);
  if (/^(?:[•·.]|-|\*)$/.test(text)) return "bulletListItem";
  if (/^\d+\.$/.test(text)) return "numberedListItem";
  return null;
}

function repairDetachedListMarkers(blocks: PartialBlock[]): PartialBlock[] {
  const repaired: PartialBlock[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const markerType = getDetachedListMarkerType(blocks[index]);
    const nextBlock = blocks[index + 1];

    if (
      markerType &&
      nextBlock?.type === "paragraph" &&
      getPlainBlockText(nextBlock)
    ) {
      repaired.push({
        type: markerType,
        content: nextBlock.content,
        ...((nextBlock as any).children?.length
          ? { children: (nextBlock as any).children }
          : {}),
      } as PartialBlock);
      index += 1;
      continue;
    }

    repaired.push(blocks[index]);
  }

  return repaired;
}

function normalizeBlocks(blocks: any[] | undefined): PartialBlock[] {
  return repairDetachedListMarkers(
    (blocks ?? []).flatMap((block) => normalizeBlock(block)),
  );
}

function normalizeQuoteBlock(block: any): PartialBlock[] {
  const contentChildren = hasStructuredBlocks(block.content) ? block.content : [];
  const childBlocks = Array.isArray(block.children) ? block.children : [];
  const nestedBlocks = normalizeBlocks([...contentChildren, ...childBlocks]);

  if (
    nestedBlocks.length === 1 &&
    nestedBlocks[0]?.type === "paragraph" &&
    !(nestedBlocks[0] as any).children?.length
  ) {
    return [
      {
        type: "quote",
        content: normalizeInlineContent(nestedBlocks[0].content),
      } as PartialBlock,
    ];
  }

  if (nestedBlocks.length > 0) {
    const leadingParagraph = hasStructuredBlocks(block.content)
      ? null
      : createParagraphFromInlineContent(normalizeInlineContent(block.content));
    return leadingParagraph ? [leadingParagraph, ...nestedBlocks] : nestedBlocks;
  }

  return [
    {
      type: "quote",
      content: normalizeInlineContent(block.content),
    } as PartialBlock,
  ];
}

function normalizeBlock(block: any): PartialBlock[] {
  if (!block || typeof block !== "object") return [];

  const type = block.type;
  if (type === "quote" || type === "blockquote") {
    const flattened = normalizeQuoteBlock(block);
    // 引用块不允许有 children，剥离并展平
    return flattened.flatMap((b) => {
      const children = (b as any).children;
      if (!children?.length) return [b];
      const { children: _, ...withoutChildren } = b as any;
      return [withoutChildren as PartialBlock, ...normalizeBlocks(children)];
    });
  }

  if (!type || !VALID_BLOCK_TYPES.has(type)) {
    const nestedBlocks = [
      ...(hasStructuredBlocks(block.content) ? block.content : []),
      ...(Array.isArray(block.children) ? block.children : []),
    ];
    if (nestedBlocks.length > 0) {
      return normalizeBlocks(nestedBlocks);
    }
    const text = simpleExtractText(block).trim();
    if (text) return [{ type: "paragraph", content: text }];
    return [];
  }

  const children = normalizeBlocks(block.children);

  if (children.length > 0 && type === "heading") {
    if (!hasInlineText(block.content)) {
      return children;
    }
    const headingBlock: PartialBlock = { type };
    if (block.props || block.attrs) headingBlock.props = block.props ?? block.attrs;
    if (block.content !== undefined) headingBlock.content = block.content;
    return [headingBlock, ...children];
  }

  if (children.length > 0 && isEmptyWrapperBlock(type, block)) {
    return children;
  }

  const sanitized: PartialBlock = { type };
  if (block.props || block.attrs) sanitized.props = block.props ?? block.attrs;
  if (block.content !== undefined) {
    sanitized.content = type === "codeBlock" ? simpleExtractText(block) : block.content;
  }
  if (children?.length) sanitized.children = children;

  return [sanitized];
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
    const nestedChildren = Array.isArray(firstBlock.children) ? firstBlock.children : [];
    const { children: headingChildren, ...titleBase } = firstBlock as PartialBlock;
    void headingChildren;
    const normalizedTitle = {
      ...titleBase,
      props: {
        ...firstBlock.props,
        level: TITLE_HEADING_LEVEL,
      },
    } as PartialBlock;

    return [
      normalizedTitle,
      ...nestedChildren,
      ...restBlocks,
    ];
  }

  if (canUseAsHeadingContent(firstBlock)) {
    const nestedChildren = Array.isArray(firstBlock.children) ? firstBlock.children : [];
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
        },
        content,
      } as PartialBlock,
      ...nestedChildren,
      ...restBlocks,
    ];
  }

  return [titleHeadingBlock(), firstBlock, ...restBlocks];
}

export function normalizeBlockContent(content: unknown): BlockNoteContent {
  if (!Array.isArray(content)) return [];
  return normalizeBlocks(content);
}

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
  if (!isBlockNoteContent(content)) {
    if (typeof content === "object" && (content as any).type !== "doc") {
      return simpleExtractText(content as any).trim();
    }
    return textFromLegacy(content).trim();
  }

  const parts: string[] = [];
  const visit = (block: any) => {
    if (typeof block.content === "string") parts.push(block.content);
    else if (Array.isArray(block.content)) {
      for (const inline of block.content) {
        if (typeof inline === "string") parts.push(inline);
        else if (inline?.type === "link" && Array.isArray(inline.content)) {
          parts.push(...inline.content.map((c: any) => c?.text ?? ""));
        }
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
