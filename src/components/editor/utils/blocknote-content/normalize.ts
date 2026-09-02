import type { PartialBlock } from "@blocknote/core";
import type { BlockNoteContent } from "./emptyContent";
import {
  TITLE_HEADING_LEVEL,
  titleHeadingBlock,
  createEmptyBlockNoteContent,
} from "./emptyContent";

export const VALID_BLOCK_TYPES = new Set([
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
  "callout",
  "alert",
  "link",
  "embed",
  "toggleListItem",
]);

export const LEGACY_BLOCK_TYPES = new Set([
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

const INLINE_CONTENT_TYPES = new Set(["text", "link"]);

/** 写在 props/attrs 里、用户能看见或会拿来搜的字段（不含 url / language 等元数据） */
const SEARCHABLE_PROP_KEYS = ["caption", "name", "summary", "alt", "title"] as const;

function extractBlockPropText(block: any): string {
  if (!block || typeof block !== "object" || Array.isArray(block)) return "";
  const source = block.props ?? block.attrs;
  if (!source || typeof source !== "object") return "";
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const key of SEARCHABLE_PROP_KEYS) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    parts.push(trimmed);
  }
  return parts.join(" ");
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function extractInlinePiece(inline: any): string {
  if (inline == null) return "";
  if (typeof inline === "string") return inline;
  if (typeof inline !== "object") return "";
  if (inline.type === "hardBreak") return "\n";
  if (inline.type === "link") {
    const text = simpleExtractText(inline.content ?? "");
    const href = typeof inline.href === "string" ? inline.href.trim() : "";
    if (href && isHttpUrl(href) && href !== text) {
      return text ? `${text} ${href}` : href;
    }
    return text;
  }
  if (inline.type === "paragraph" || inline.type === "tableCell") {
    return simpleExtractText(inline);
  }
  if (typeof inline.text === "string") return inline.text;
  if (inline.content != null) return simpleExtractText(inline);
  return "";
}

function extractBlockContentText(block: any): string {
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content.map(extractInlinePiece).join("");
  }
  if (block.content?.rows) {
    const rows = block.content.rows as any[];
    return rows
      .flatMap((row) => (row.cells ?? []).map((cell: any) => simpleExtractText(cell)))
      .join(" ");
  }
  if (typeof block.text === "string") return block.text;
  return "";
}

export function simpleExtractText(block: any): string {
  if (block == null) return "";
  if (typeof block === "string") return block;
  if (Array.isArray(block)) {
    return block.map(extractInlinePiece).join("");
  }
  if (typeof block !== "object") return "";
  const contentText = extractBlockContentText(block);
  const propText = extractBlockPropText(block);
  if (!contentText) return propText;
  if (!propText) return contentText;
  return `${contentText} ${propText}`;
}

function isStructuredBlockLike(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const candidateType = (node as { type?: unknown }).type;
  if (
    typeof candidateType === "string" &&
    INLINE_CONTENT_TYPES.has(candidateType)
  ) {
    return false;
  }
  return (
    typeof candidateType === "string" &&
    (VALID_BLOCK_TYPES.has(candidateType) || LEGACY_BLOCK_TYPES.has(candidateType))
  );
}

export function hasStructuredBlocks(value: unknown): value is any[] {
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

export function normalizeBlocks(blocks: any[] | undefined): PartialBlock[] {
  return normalizeRedundantNumberedListStarts(
    repairDetachedListMarkers(
      (blocks ?? []).flatMap((block) => normalizeBlock(block)),
    ),
  );
}

/**
 * BlockNote 只在一段连续有序列表的首项读取 `props.start`。后续项上的 start
 * 平时虽然不影响显示，但当前面的列表项被删除、它变成首项后就会突然生效，造成
 * 「删掉 1. 后仍显示 2.」的错觉。
 *
 * 因此只移除同一 sibling run 内后续项的冗余 start；被非列表块隔开的新 run、
 * 以及每个嵌套 blockGroup 的首项仍保留显式起始序号。
 */
function normalizeRedundantNumberedListStarts(
  blocks: PartialBlock[],
): PartialBlock[] {
  let previousWasNumbered = false;

  return blocks.map((block) => {
    const isNumbered = block.type === "numberedListItem";
    const hasRedundantStart =
      isNumbered &&
      previousWasNumbered &&
      (block.props as Record<string, unknown> | undefined)?.start != null;

    previousWasNumbered = isNumbered;
    if (!hasRedundantStart) return block;

    const { start: _start, ...props } = block.props as Record<string, unknown>;
    return {
      ...block,
      ...(Object.keys(props).length > 0 ? { props } : { props: undefined }),
    } as PartialBlock;
  });
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

  // 所有 heading 都保留 children；物理首块拍平由 ensureFirstTitleHeading 负责。
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
  // 只把 paragraph 提升为标题。codeBlock / table / image / list 等结构化块保持原样，
  // 否则会被撕掉外壳变成 heading 丢数据（例如：本地文件首块若是 codeBlock 包住的
  // frontmatter，原实现会把它强转成 H1 露出 raw-block marker 文本）。
  if (block.type !== "paragraph") return false;
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
        collapsed: false,
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
          collapsed: false,
        },
        content,
      } as PartialBlock,
      ...nestedChildren,
      ...restBlocks,
    ];
  }

  // 首块是结构化块：保持原样，不前置空标题，避免在编辑器顶部塞无关 H1。
  return content;
}

export function normalizeBlockContent(content: unknown): BlockNoteContent {
  if (!Array.isArray(content)) return [];
  return normalizeBlocks(content);
}

function normalizeHeadingProps(props: unknown): Record<string, unknown> {
  const next = {
    ...(typeof props === "object" && props ? (props as Record<string, unknown>) : {}),
  };
  delete next.isToggleable;
  if (next.collapsed == null) next.collapsed = false;
  return next;
}

function normalizeSectionFoldBlock(block: PartialBlock): PartialBlock[] {
  let working = block;
  if (working.type === "toggleListItem") {
    working = {
      type: "bulletListItem",
      props: working.props,
      content: working.content,
      ...((working as { children?: PartialBlock[] }).children?.length
        ? { children: (working as { children?: PartialBlock[] }).children }
        : {}),
    } as PartialBlock;
  }

  if (working.type === "heading") {
    const nestedChildren = Array.isArray((working as { children?: PartialBlock[] }).children)
      ? ((working as { children?: PartialBlock[] }).children as PartialBlock[])
      : [];
    const { children: _ignored, ...headingOnly } = working as PartialBlock & {
      children?: PartialBlock[];
    };
    const flat: PartialBlock[] = [
      {
        ...headingOnly,
        props: normalizeHeadingProps(headingOnly.props),
      } as PartialBlock,
    ];
    if (nestedChildren.length > 0) {
      flat.push(...normalizeHeadingSectionFold(normalizeBlocks(nestedChildren)));
    }
    return flat;
  }

  const children = (working as { children?: PartialBlock[] }).children;
  if (Array.isArray(children) && children.length > 0) {
    return [
      {
        ...working,
        children: normalizeHeadingSectionFold(children),
      } as PartialBlock,
    ];
  }
  return [working];
}

/**
 * 标题区块折叠数据规范：拍平 heading children 为后续兄弟；toggleListItem → bulletListItem；
 * 所有 heading isToggleable 清除；collapsed 缺省 false。
 */
export function normalizeHeadingSectionFold(
  blocks: PartialBlock[],
): PartialBlock[] {
  return blocks.flatMap((block) => normalizeSectionFoldBlock(block));
}

/** @deprecated 使用 normalizeHeadingSectionFold */
export function normalizeHeadingToggleableFlags(
  blocks: PartialBlock[],
): PartialBlock[] {
  return normalizeHeadingSectionFold(blocks);
}
