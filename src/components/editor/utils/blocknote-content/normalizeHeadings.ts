import type { PartialBlock } from "@blocknote/core";
import type { BlockNoteContent } from "./emptyContent";
import {
  TITLE_HEADING_LEVEL,
  createEmptyBlockNoteContent,
} from "./emptyContent";
import { normalizeBlocks } from "./normalizeBlocks";

function canUseAsHeadingContent(block: PartialBlock): boolean {
  // 只把 paragraph 提升为标题。codeBlock / table / image / list 等结构化块保持原样，
  // 否则会被撕掉外壳变成 heading 丢数据（例如：本地文件首块若是 codeBlock 包住的
  // frontmatter，原实现会把它强转成 H1 露出 raw-block marker 文本）。
  if (block.type !== "paragraph") return false;
  return typeof block.content === "string" || Array.isArray(block.content);
}

export function ensureFirstTitleHeading(
  content: BlockNoteContent,
): BlockNoteContent {
  const [firstBlock, ...restBlocks] = content;

  if (!firstBlock) {
    return createEmptyBlockNoteContent();
  }

  if (firstBlock.type === "heading") {
    const nestedChildren = Array.isArray(firstBlock.children)
      ? firstBlock.children
      : [];
    const { children: headingChildren, ...titleBase } =
      firstBlock as PartialBlock;
    void headingChildren;
    const normalizedTitle = {
      ...titleBase,
      props: {
        ...firstBlock.props,
        level: TITLE_HEADING_LEVEL,
        collapsed: false,
      },
    } as PartialBlock;

    return [normalizedTitle, ...nestedChildren, ...restBlocks];
  }

  if (canUseAsHeadingContent(firstBlock)) {
    const nestedChildren = Array.isArray(firstBlock.children)
      ? firstBlock.children
      : [];
    const content =
      typeof firstBlock.content === "string" ||
      Array.isArray(firstBlock.content)
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
      } as unknown as PartialBlock,
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
    ...(typeof props === "object" && props
      ? (props as Record<string, unknown>)
      : {}),
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
    const nestedChildren = Array.isArray(
      (working as { children?: PartialBlock[] }).children,
    )
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
      flat.push(
        ...normalizeHeadingSectionFold(normalizeBlocks(nestedChildren)),
      );
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
