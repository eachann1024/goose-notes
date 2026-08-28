import type { BlockNoteEditor } from "@blocknote/core";

export type SectionFoldBlock = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: SectionFoldBlock[];
};

export function isCollapsedProp(value: unknown): boolean {
  return value === true || value === "true";
}

export function getHeadingLevel(block: SectionFoldBlock): number {
  if (block.type !== "heading") return 0;
  const level = block.props?.level;
  if (typeof level === "number" && level > 0) return level;
  const parsed = Number(level);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function collectDescendantIds(
  blocks: SectionFoldBlock[] | undefined,
  into: Set<string> | string[],
): void {
  if (!blocks?.length) return;
  for (const child of blocks) {
    if (into instanceof Set) into.add(child.id);
    else into.push(child.id);
    collectDescendantIds(child.children, into);
  }
}

/** 可折叠 heading：非文档物理首块（page title / document[0]）。 */
export function isFoldableHeadingBlock(
  block: { id?: string; type?: string } | null | undefined,
  firstBlockId: string | undefined,
): boolean {
  if (block?.type !== "heading" || !block.id) return false;
  if (!firstBlockId) return true;
  return block.id !== firstBlockId;
}

/** 从 heading 后扫同级兄弟，遇 level <= 当前 heading 则停。 */
export function collectSectionBlockIds(
  blocks: SectionFoldBlock[],
  headingId: string,
): string[] {
  const headingIndex = blocks.findIndex((block) => block.id === headingId);
  if (headingIndex < 0) return [];

  const headingLevel = getHeadingLevel(blocks[headingIndex]);
  const hiddenIds: string[] = [];

  for (let index = headingIndex + 1; index < blocks.length; index += 1) {
    const sibling = blocks[index];
    if (
      sibling.type === "heading" &&
      getHeadingLevel(sibling) <= headingLevel
    ) {
      break;
    }
    hiddenIds.push(sibling.id);
  }

  return hiddenIds;
}

export function collectAllHiddenSectionBlockIds(
  document: SectionFoldBlock[],
  firstBlockId: string | undefined,
): Set<string> {
  const hidden = new Set<string>();

  const walk = (blocks: SectionFoldBlock[]) => {
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (
        block.type === "heading" &&
        isCollapsedProp(block.props?.collapsed) &&
        isFoldableHeadingBlock(block, firstBlockId)
      ) {
        collectSectionBlockIds(blocks, block.id).forEach((id) => hidden.add(id));
        collectDescendantIds(block.children, hidden);
      }
      if (block.children?.length) {
        walk(block.children);
      }
    }
  };

  walk(document);
  return hidden;
}

/** 返回应展开以露出 targetBlockId 的 collapsed heading id（自顶向下）。 */
export function findCollapsedHeadingsHidingBlock(
  document: SectionFoldBlock[],
  targetBlockId: string,
  firstBlockId: string | undefined,
): string[] {
  const toExpand: string[] = [];

  const walk = (blocks: SectionFoldBlock[]) => {
    for (const block of blocks) {
      if (
        block.type === "heading" &&
        isCollapsedProp(block.props?.collapsed) &&
        isFoldableHeadingBlock(block, firstBlockId)
      ) {
        const sectionIds = collectSectionBlockIds(blocks, block.id);
        const nested = new Set<string>();
        collectDescendantIds(block.children, nested);
        if (sectionIds.includes(targetBlockId) || nested.has(targetBlockId)) {
          toExpand.push(block.id);
        }
      }
      if (block.children?.length) {
        walk(block.children);
      }
    }
  };

  walk(document);
  return toExpand;
}

export function readHeadingCollapsed(
  block: { props?: Record<string, unknown> } | null | undefined,
): boolean {
  return isCollapsedProp(block?.props?.collapsed);
}

export function toggleHeadingCollapsed(
  editor: BlockNoteEditor<any, any, any>,
  headingId: string,
): void {
  const block = editor.getBlock(headingId);
  if (!block || block.type !== "heading") return;
  const collapsed = readHeadingCollapsed(block);
  editor.updateBlock(block, {
    props: { collapsed: !collapsed },
  });
}
