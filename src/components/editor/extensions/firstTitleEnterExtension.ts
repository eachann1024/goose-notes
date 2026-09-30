import { createExtension } from "@blocknote/core";

/**
 * 文档首块是「文档标题」（恒为 H1，见 ensureFirstTitleHeading / titleHeadingBlock）。
 *
 * 项目原则：**标题一是特殊的存在，任何编辑器改造都不应影响它**——它恒为物理首块、
 * 恒为 H1，上方不可被前置任何块，自身也不可被推到下面。
 *
 * 本扩展处理两种「光标停在某个 heading 块开头按 Enter」的场景，覆盖 ProseMirror 默认行为：
 *
 * 1. 该 heading 是文档**物理首块（标题一）**：直接**拦截不做任何事**——既不在前面拆块，
 *    也不在后面插块。标题一受保护、保持原样。
 *
 * 2. 该 heading 是**非首块**（例如正文里另起的 H1/H2…）：默认 splitBlock 会在前面拆出一个
 *    同类型的**空 heading**（显示 placeholder「标题」），不符合预期。改为在它**前面插入一个
 *    空 paragraph（普通空行）**，光标仍留在原 heading 上，原 heading 整体下移。
 */
export const gooseFirstTitleEnterExtension = createExtension({
  key: "goose-first-title-enter",
  keyboardShortcuts: {
    Enter: ({ editor }) => {
      const state = editor.prosemirrorState;
      const { selection } = state;
      if (!selection.empty) return false;

      const $from = selection.$from;
      // 光标必须落在块内容的最开头
      if ($from.parentOffset !== 0) return false;
      // 当前块必须是 heading（文档标题块）
      if ($from.parent.type.name !== "heading") return false;

      // 必须是「文档物理首块」。注意：文档结构是 doc > blockGroup > blockContainer*，
      // 所以 $from.index(0) 拿到的是 blockGroup 在 doc 下的索引（恒为 0），无法区分第几块。
      // 第二个 heading（如另起的 H1）会被误判成首块。正确做法：比较当前光标所在
      // blockContainer 的位置与文档第一个 blockContainer 的位置。
      let firstContainerPos: number | null = null;
      state.doc.descendants((node, pos) => {
        if (firstContainerPos !== null) return false;
        if (node.type.name === "blockContainer") {
          firstContainerPos = pos;
          return false;
        }
        return true;
      });
      let curContainerPos: number | null = null;
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === "blockContainer") {
          curContainerPos = $from.before(d);
          break;
        }
      }
      if (firstContainerPos === null || curContainerPos !== firstContainerPos) {
        // 非首块的 heading（如正文里另起的 H1/H2…）：默认会在前面拆出空 heading，
        // 不符合预期。改为在它前面插入一个空 paragraph，光标留在原 heading 上。
        const headingBlock = editor.getTextCursorPosition().block;
        editor.insertBlocks(
          [{ type: "paragraph", content: "" }],
          headingBlock,
          "before",
        );
        editor.setTextCursorPosition(headingBlock, "start");
        return true;
      }

      // 走到这里：光标在「标题一」开头（parentOffset === 0）。
      // 标题一受保护，绝不能在其上方插块、也不能把它拆下去。
      //
      // 空标题一按 Enter：现在会「什么都不做」，体验上是按了没反应。改为在标题一
      // **正下方插入一个新的空 paragraph 并把光标移过去**——光标顺势进入正文区，
      // 标题一原样保留在物理首块。（用户要求：空标题回车总是新增一个空行。）
      const titleBlock = editor.getTextCursorPosition().block;
      const titleEmpty =
        Array.isArray(titleBlock.content) && titleBlock.content.length === 0;
      if (titleEmpty) {
        const [inserted] = editor.insertBlocks(
          [{ type: "paragraph", content: "" }],
          titleBlock,
          "after",
        );
        if (inserted) editor.setTextCursorPosition(inserted, "start");
        return true;
      }

      // 非空标题一、光标在开头：维持拦截（不可在标题上方前置块、不可拆分标题）。
      return true;
    },
  },
});
