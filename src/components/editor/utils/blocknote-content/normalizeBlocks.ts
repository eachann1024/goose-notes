import type { PartialBlock } from "@blocknote/core";
import { normalizeParsedImageProps } from "@/components/editor/blocks/image/imageCaption";
import {
  VALID_BLOCK_TYPES,
  LEGACY_BLOCK_TYPES,
  INLINE_CONTENT_TYPES,
} from "./blockTypes";
import { simpleExtractText } from "./normalizeText";
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
    (VALID_BLOCK_TYPES.has(candidateType) ||
      LEGACY_BLOCK_TYPES.has(candidateType))
  );
}

export function hasStructuredBlocks(value: unknown): value is any[] {
  return (
    Array.isArray(value) && value.some((item) => isStructuredBlockLike(item))
  );
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
    return content.trim()
      ? ({ type: "paragraph", content } as PartialBlock)
      : null;
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
  const contentChildren = hasStructuredBlocks(block.content)
    ? block.content
    : [];
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
    return leadingParagraph
      ? [leadingParagraph, ...nestedBlocks]
      : nestedBlocks;
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
  if (type === "horizontalRule") {
    return [{ type: "divider" } as PartialBlock];
  }
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
  if (block.props || block.attrs) {
    const rawProps = (block.props ?? block.attrs) as Record<string, unknown>;
    sanitized.props =
      type === "image" ? normalizeParsedImageProps(rawProps) : rawProps;
  }
  if (block.content !== undefined) {
    sanitized.content =
      type === "codeBlock" ? simpleExtractText(block) : block.content;
  }
  if (children?.length) sanitized.children = children;

  return [sanitized];
}
