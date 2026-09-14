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
 * 文档首块是「文档标题」（恒为 H1，见 ensureFirstTitleHeading / titleHeadingBlock）。
 *
 * 项目原则：**标题一是特殊的存在，任何编辑器改造都不应影响它**——它恒为物理首块、
 * 恒为 H1，上方不可被前置任何块，自身也不可被推到下面。
 *
 * 本扩展处理「光标在 heading 上按 Enter」：
 *
 * 1. **标题一（物理首块）**：无论光标在开头 / 中间 / 末尾，都保证在标题**下方**
 *    产生可写的正文空行，绝不在标题上方拆块。
 *
 * 2. **非首块 heading**：光标在开头时，默认 splitBlock 会在前面拆出同类型空 heading。
 *    改为在它**前面插入空 paragraph**，光标仍留在原 heading。折叠标题的行首同样走这条，
 *    不能先插到 section 尾部，否则看起来像按了回车却没在标题前空出一行。
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

  // 正文标题行首：在前面插空段落。必须先于折叠节尾插入，否则行首回车会跑到章节末尾。
  if (atStart && !isFirstTitle) {
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
