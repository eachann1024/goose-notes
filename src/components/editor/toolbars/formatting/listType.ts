import type { BlockNoteEditor } from "@blocknote/core";
import { getSelectedBlocksSafe } from "@/components/editor/toolbars/formatting/helpers";

export const LIST_BLOCK_TYPES = [
  "checkListItem",
  "bulletListItem",
  "numberedListItem",
] as const;

export type ListBlockType = (typeof LIST_BLOCK_TYPES)[number];

const CONVERTIBLE_BLOCK_TYPES = new Set<string>([
  "paragraph",
  "heading",
  "quote",
  "toggleListItem",
  ...LIST_BLOCK_TYPES,
]);

export type ListTypeToolbarState = {
  show: boolean;
  active: ListBlockType | null;
  mixed: boolean;
};

function isProtectedFirstTitle(
  editor: BlockNoteEditor<any, any, any>,
  block: { id?: string; type?: string; props?: { level?: number } },
): boolean {
  const first = editor.document?.[0] as
    | { id?: string; type?: string; props?: { level?: number } }
    | undefined;
  if (!first || first.id !== block.id) return false;
  return block.type === "heading" && Number(block.props?.level) === 1;
}

export function isConvertibleListBlock(
  editor: BlockNoteEditor<any, any, any>,
  block: { id?: string; type?: string; props?: { level?: number } } | null,
): boolean {
  if (!block?.type || !CONVERTIBLE_BLOCK_TYPES.has(block.type)) return false;
  return !isProtectedFirstTitle(editor, block);
}

export function getConvertibleListBlocks(
  editor: BlockNoteEditor<any, any, any>,
): any[] {
  return getSelectedBlocksSafe(editor).filter((block) =>
    isConvertibleListBlock(editor, block),
  );
}

export function getActiveListType(blocks: { type?: string }[]): ListBlockType | null {
  if (blocks.length === 0) return null;
  return (
    LIST_BLOCK_TYPES.find((type) => blocks.every((block) => block.type === type)) ??
    null
  );
}

export function getListTypeToolbarState(
  editor: BlockNoteEditor<any, any, any>,
): ListTypeToolbarState {
  const blocks = getConvertibleListBlocks(editor);
  const active = getActiveListType(blocks);
  const present = LIST_BLOCK_TYPES.filter((type) =>
    blocks.some((block) => block.type === type),
  );
  return {
    show: blocks.length > 0,
    active,
    mixed: present.length > 1 || (present.length === 1 && active == null),
  };
}

function listTypeUpdate(
  block: { type?: string; props?: { checked?: boolean; start?: number } },
  target: ListBlockType,
): { type: ListBlockType; props: Record<string, unknown> } {
  return {
    type: target,
    // checked 只在 checkListItem 之间保留；start 只留给原本有序的块。
    // 其余情况显式覆盖为默认值，避免换类型后残留在 PM attrs 里。
    props: {
      checked:
        target === "checkListItem" && block.type === "checkListItem"
          ? Boolean(block.props?.checked)
          : false,
      start:
        target === "numberedListItem" && block.type === "numberedListItem"
          ? block.props?.start
          : undefined,
    },
  };
}

/** 方案 A：已全是目标类型时再点一次取消回 paragraph。 */
export function applySelectedListType(
  editor: BlockNoteEditor<any, any, any>,
  target: ListBlockType,
): boolean {
  const blocks = getConvertibleListBlocks(editor);
  if (blocks.length === 0) return false;

  const resetToParagraph = getActiveListType(blocks) === target;

  editor.transact(() => {
    for (const block of blocks) {
      try {
        editor.updateBlock(
          block,
          resetToParagraph ? { type: "paragraph" } : listTypeUpdate(block, target),
        );
      } catch {
        /* 选区块可能已不在文档里 */
      }
    }
  });
  return true;
}
