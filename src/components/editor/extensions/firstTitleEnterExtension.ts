import { createExtension } from "@blocknote/core";

/**
 * 文档首块是「文档标题」（恒为 H1，见 ensureFirstTitleHeading / titleHeadingBlock）。
 *
 * 默认行为：光标停在首个标题块**开头**按 Enter，ProseMirror 会从该位置拆块，
 * 在标题前面留下一个空的 heading 块（placeholder 显示「标题」）。这违反「首块标题
 * 唯一且恒在顶部」的约定，且 restoreFirstTitleHeading 因新空块同为 H1 而不会回滚，
 * 导致顶部凭空多出一个空标题（见用户反馈截图）。
 *
 * 修复：光标在首个标题块开头、选区为空时按 Enter，不在前面拆块，改为在标题块
 * **之后**插入一个空段落并把光标移过去。标题内容保持完整，文档顶部不再出现空标题。
 */
export const gooseFirstTitleEnterExtension = createExtension({
  key: "goose-first-title-enter",
  keyboardShortcuts: {
    Enter: ({ editor }) => {
      const state = editor.prosemirrorState;
      const { selection } = state;
      if (!selection.empty) return false;

      const $from = selection.$from;
      // 必须是文档第一个顶层块
      if ($from.index(0) !== 0) return false;
      // 光标必须落在块内容的最开头
      if ($from.parentOffset !== 0) return false;
      // 当前块必须是 heading（文档标题块）
      if ($from.parent.type.name !== "heading") return false;

      const titleBlock = editor.getTextCursorPosition().block;
      const [inserted] = editor.insertBlocks(
        [{ type: "paragraph", content: "" }],
        titleBlock,
        "after",
      );
      if (inserted) editor.setTextCursorPosition(inserted);
      return true;
    },
  },
});
