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

/** section 插入锚点：最后一个被扫描到的 sibling id；没有则返回 headingId。 */
export function getSectionInsertAnchorId(
  blocks: SectionFoldBlock[],
  headingId: string,
): string {
  const ids = collectSectionBlockIds(blocks, headingId);
  return ids.length > 0 ? ids[ids.length - 1] : headingId;
}

/** 捕获折叠快照：collapse 那一刻 section 扫描到的 sibling id 列表。 */
export function captureFoldSnapshot(
  blocks: SectionFoldBlock[],
  headingId: string,
): string[] {
  return collectSectionBlockIds(blocks, headingId);
}

/**
 * 推进折叠快照：展开→折叠重新 capture；仍折叠保留旧快照（剔除已不在文档的 id，
 * 不吸收新 sibling）；展开或 heading 被删则丢弃。prevDocument 为 null 表示初始化，
 * 对所有 collapsed heading 直接 capture。
 */
export function updateFoldSnapshots(
  snapshots: Map<string, string[]>,
  prevDocument: SectionFoldBlock[] | null,
  nextDocument: SectionFoldBlock[],
  firstBlockId: string | undefined,
): Map<string, string[]> {
  const nextIds = new Set<string>();
  collectDescendantIds(nextDocument, nextIds);

  const prevCollapsed = new Map<string, boolean>();
  if (prevDocument) {
    const scanPrev = (blocks: SectionFoldBlock[]) => {
      for (const block of blocks) {
        if (block.type === "heading" && block.id) {
          prevCollapsed.set(block.id, isCollapsedProp(block.props?.collapsed));
        }
        if (block.children?.length) scanPrev(block.children);
      }
    };
    scanPrev(prevDocument);
  }

  const next = new Map<string, string[]>();
  const walk = (blocks: SectionFoldBlock[]) => {
    for (const block of blocks) {
      if (
        block.type === "heading" &&
        isCollapsedProp(block.props?.collapsed) &&
        isFoldableHeadingBlock(block, firstBlockId)
      ) {
        const keep =
          prevDocument !== null && prevCollapsed.get(block.id) === true
            ? (snapshots.get(block.id) ?? captureFoldSnapshot(blocks, block.id))
            : captureFoldSnapshot(blocks, block.id);
        next.set(
          block.id,
          keep.filter((id) => nextIds.has(id)),
        );
      }
      if (block.children?.length) walk(block.children);
    }
  };
  walk(nextDocument);
  return next;
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
