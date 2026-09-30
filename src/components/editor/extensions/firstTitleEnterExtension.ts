import { createExtension } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import {
  getSectionInsertAnchorId,
  isFoldableHeadingBlock,
  readHeadingCollapsed,
} from "@/components/editor/core/headingSectionFold";

const EMPTY_PARAGRAPH = { type: "paragraph" as const, content: [] };

function blockContainerIdAt($from: {
  depth: number;
  node: (depth: number) => { type: { name: string }; attrs?: { id?: unknown } };
}): string | null {
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "blockContainer") {
      const id = node.attrs?.id;
      return typeof id === "string" && id.length > 0 ? id : null;
    }
  }
  return null;
}

function insertEmptyParagraphBeforeHeading(
  editor: BlockNoteEditor<any, any, any>,
  headingBlock: { id: string },
): boolean {
  editor.insertBlocks([EMPTY_PARAGRAPH], headingBlock, "before");
  editor.setTextCursorPosition(headingBlock, "start");
  return true;
}

function insertEmptyParagraphAfter(
  editor: BlockNoteEditor<any, any, any>,
  anchor: { id: string },
): boolean {
  const [inserted] = editor.insertBlocks([EMPTY_PARAGRAPH], anchor, "after");
  if (inserted) editor.setTextCursorPosition(inserted, "start");
  return true;
}

/**
 * 文档首块由 firstTitleGuard 保持为 H1。
 *
 * 行首 Enter 在当前 heading 前插入空段落，光标留在原 heading，原内容下移。
 * 对首块，守卫将新插入的空段落设为 H1；原 heading 的内容和属性保持不变。
 * 首块行中 / 行尾 Enter 继续在下方拆出正文段落。
 * 折叠正文标题的行首也优先处理，避免把空行插到章节末尾。
 */
function applyHeadingEnter(
  editor: BlockNoteEditor<any, any, any>,
): boolean {
  const state = editor.prosemirrorState;
  const { selection } = state;
  if (!selection.empty) return false;

  const $from = selection.$from;
  const containerId = blockContainerIdAt($from);
  let headingBlock = containerId ? editor.getBlock(containerId) : null;
  if (!headingBlock || headingBlock.type !== "heading") {
    try {
      headingBlock = editor.getTextCursorPosition().block;
    } catch {
      return false;
    }
  }
  if (!headingBlock || headingBlock.type !== "heading") return false;

  const offset = $from.parentOffset;
  const contentSize = $from.parent.content.size;
  const atStart = offset === 0;
  const atEnd = offset >= contentSize;
  const firstBlockId = editor.document[0]?.id;
  const isFirstTitle = headingBlock.id === firstBlockId;

  // 非空标题行首：在前面插空段落，原内容下移；空标题仍走下方插入。
  if (atStart && (!isFirstTitle || contentSize > 0)) {
    return insertEmptyParagraphBeforeHeading(editor, headingBlock);
  }

  if (
    readHeadingCollapsed(headingBlock) &&
    isFoldableHeadingBlock(headingBlock, firstBlockId)
  ) {
    const anchorId = getSectionInsertAnchorId(
      editor.document as any,
      headingBlock.id,
    );
    const anchor = editor.getBlock(anchorId) ?? headingBlock;
    const handled = insertEmptyParagraphAfter(editor, anchor);
    editor.focus();
    return handled;
  }

  if (!isFirstTitle) return false;

  if (atStart || atEnd) {
    return insertEmptyParagraphAfter(editor, headingBlock);
  }

  const textAfter = $from.parent.textBetween(offset, contentSize, undefined, "");
  const [inserted] = editor.insertBlocks(
    [
      {
        type: "paragraph",
        content: textAfter ? [{ type: "text", text: textAfter }] : [],
      },
    ],
    headingBlock,
    "after",
  );

  const textBefore = $from.parent.textBetween(0, offset, undefined, "");
  editor.updateBlock(headingBlock, {
    content: textBefore ? [{ type: "text", text: textBefore }] : [],
  } as any);

  if (inserted) editor.setTextCursorPosition(inserted, "start");
  return true;
}

export const gooseFirstTitleEnterExtension = createExtension({
  key: "goose-first-title-enter",
  // 不要 runsBefore: ["default"]：那会把 TipTap priority 压到默认 keymap 之下，
  // 标题行首 Enter 被 splitBlock 先吃掉，扩展永远不跑。
  keyboardShortcuts: {
    Enter: ({ editor }) => applyHeadingEnter(editor),
  },
});
