import { createExtension } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { findParentBlock } from "./collapsedToggleEnterExtension";

type InlineItem = { type: string; text?: string; styles?: Record<string, unknown> };

type BlockLike = {
  id: string;
  type: string;
  props?: { isToggleable?: boolean };
  content?: unknown;
  children?: BlockLike[];
};

function asInlineArray(content: unknown): InlineItem[] {
  return Array.isArray(content) ? (content as InlineItem[]) : [];
}

function hasInlineContent(block: BlockLike): boolean {
  if (typeof block.content === "string") return block.content.length > 0;
  return asInlineArray(block.content).length > 0;
}

function isToggleableHeading(block: BlockLike | null | undefined): boolean {
  return (
    block?.type === "heading" && block.props?.isToggleable === true
  );
}

function contentRange(
  editor: { prosemirrorState: { doc: { descendants: (fn: (node: any, pos: number) => boolean | void) => void } } },
  blockId: string,
): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name !== "blockContainer" || String(node.attrs.id) !== blockId) {
      return true;
    }
    if (node.firstChild?.isTextblock) {
      const from = pos + 2;
      found = { from, to: from + node.firstChild.content.size };
    }
    return false;
  });
  return found;
}

function setCursorAtOffset(editor: any, blockId: string, offset: number): void {
  const range = contentRange(editor, blockId);
  if (!range) {
    try {
      editor.setTextCursorPosition(blockId, "end");
    } catch {
      /* ignore */
    }
    return;
  }
  const pos = Math.max(range.from, Math.min(range.from + offset, range.to));
  editor.transact((tr: { doc: unknown; setSelection: (sel: unknown) => void }) => {
    tr.setSelection(TextSelection.create(tr.doc as never, pos));
  });
}

/**
 * 折叠标题 children 内，非空段落行首 Backspace 一次合并到上一兄弟段落。
 *
 * 默认 joinBackward 在 blockGroup 里第一次会把当前段 nest 进上一段、第二次才
 * 真正 merge。这里在默认 join 之前用 BlockNote 块 API 直接拼接 inline。
 *
 * 只覆盖 heading + isToggleable；toggleListItem / 顶层段落 / 空段一律放行。
 */
export function tryJoinToggleHeadingChildBackward(editor: any): boolean {
  const state = editor.prosemirrorState;
  if (!state.selection.empty) return false;
  if (state.selection.$from.parentOffset !== 0) return false;

  const block = editor.getTextCursorPosition().block as BlockLike;
  if (block.type !== "paragraph") return false;
  if (!hasInlineContent(block)) return false;
  if (block.children && block.children.length > 0) return false;

  const parent = findParentBlock(
    editor.document as BlockLike[],
    block.id,
  ) as BlockLike | null | undefined;
  if (!isToggleableHeading(parent)) return false;

  const siblings = (parent!.children ?? []) as BlockLike[];
  const index = siblings.findIndex((child) => child.id === block.id);
  if (index <= 0) return false;
  const prev = siblings[index - 1];
  if (prev.type !== "paragraph") return false;

  const prevRange = contentRange(editor, prev.id);
  const mergeOffset = prevRange ? prevRange.to - prevRange.from : 0;
  const merged = [...asInlineArray(prev.content), ...asInlineArray(block.content)];

  editor.transact(() => {
    editor.updateBlock(prev, { content: merged as never });
    editor.removeBlocks([block]);
  });
  setCursorAtOffset(editor, prev.id, mergeOffset);
  return true;
}

export const gooseToggleHeadingJoinBackwardExtension = createExtension({
  key: "goose-toggle-heading-join-backward",
  keyboardShortcuts: {
    Backspace: ({ editor }) => tryJoinToggleHeadingChildBackward(editor),
  },
});
