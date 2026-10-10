import { TextSelection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";

/**
 * 空段落（或文本末尾）紧挨表格、图片、分割线等结构块时，前向 Delete
 * 不能把焦点直接交给默认 joinForward：ProseMirror 会把那个结构块作为
 * 删除目标，用户本意只是删当前行的文字。结构块仅应在明确选中后删除。
 */
type ForwardDeleteEditor = {
  prosemirrorState: EditorState;
  getTextCursorPosition?: () => {
    nextBlock?: { content?: unknown };
  };
};

export function preventForwardDeleteIntoStructureBlock(
  editor: ForwardDeleteEditor,
): boolean {
  const state = editor.prosemirrorState as EditorState;
  if (!state.selection.empty || !(state.selection instanceof TextSelection)) {
    return false;
  }

  const { $from } = state.selection;
  // 只处理文本块末尾；块内普通 Delete 和非文本块自身的行为维持默认。
  if (
    !$from.parent.isTextblock ||
    $from.parentOffset !== $from.parent.content.size
  ) {
    return false;
  }

  const nextBlock = editor.getTextCursorPosition?.().nextBlock;
  // BlockNote 的文字块 content 为 InlineContent[]，表格/媒体/分割线等
  // 结构块不是数组。下一块仍是文字块时，保留默认的段落合并手感。
  return Boolean(nextBlock && !Array.isArray(nextBlock.content));
}

type LineDeleteEditor = {
  prosemirrorState: EditorState;
  transact: (callback: (tr: Transaction) => void) => unknown;
};

/** 删除块内由换行符或 hardBreak 分隔的空行，保留整个块及其格式。 */
export function deleteEmptyInlineLineBackward(
  editor: LineDeleteEditor,
): boolean {
  const { selection } = editor.prosemirrorState;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if (!$from.parent.isTextblock) return false;

  // 保持字符串下标与 PM inline offset 一致；不可把图片、mention 等当成空白。
  let text = "";
  $from.parent.forEach((node) => {
    text += node.isText
      ? node.text
      : node.type.name === "hardBreak"
        ? "\n"
        : "\uFFFC".repeat(node.nodeSize);
  });
  const offset = $from.parentOffset;
  const previousBreak = offset === 0 ? -1 : text.lastIndexOf("\n", offset - 1);
  const nextBreak = text.indexOf("\n", offset);
  const end = nextBreak < 0 ? text.length : nextBreak;
  if (!/^[\t ]*$/.test(text.slice(previousBreak + 1, end))) return false;
  if (previousBreak < 0 && nextBreak < 0) return false;

  const from = $from.start() + (previousBreak < 0 ? 0 : previousBreak);
  const to = $from.start() + (previousBreak < 0 ? end + 1 : end);
  editor.transact((tr) => {
    tr.delete(from, to);
    tr.setSelection(TextSelection.create(tr.doc, from));
    tr.scrollIntoView();
  });
  return true;
}

/** 空文本行按 Delete：删除本行，光标回到前面的可编辑位置。 */
export function deleteEmptyLineBackward(editor: {
  prosemirrorState: EditorState;
  transact: (callback: (tr: Transaction) => void) => unknown;
}): boolean {
  const { selection } = editor.prosemirrorState;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parent.content.size !== 0)
    return false;

  // 只删除 blockContainer 的直接文本内容，不能把空表格单元格当作空行。
  const depth = $from.depth - 1;
  if (depth < 1) return false;
  const container = $from.node(depth);
  if (container.type.name !== "blockContainer" || container.childCount !== 1) {
    return false;
  }
  const from = $from.before(depth);
  const previous = TextSelection.findFrom($from.doc.resolve(from), -1, true);
  // 本地 Markdown 没有强制标题；首个空段落也可删除，光标落入下一块。
  // 真正的首块标题以及文档唯一一行仍保留。
  const next =
    !previous && ["paragraph", "codeBlock"].includes($from.parent.type.name)
      ? TextSelection.findFrom(
          $from.doc.resolve(from + container.nodeSize),
          1,
          true,
        )
      : null;
  const target = previous ?? next;
  if (!target) {
    // 文档只剩空代码块时，退出代码框并保留一个可输入的普通段落。
    if ($from.parent.type.name === "codeBlock") {
      editor.transact((tr) => {
        tr.setNodeMarkup($from.before(), tr.doc.type.schema.nodes.paragraph);
        tr.setSelection(TextSelection.create(tr.doc, $from.start()));
      });
    }
    return true;
  }

  editor.transact((tr) => {
    tr.delete(from, from + container.nodeSize);
    tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(target.head)));
    tr.scrollIntoView();
  });
  return true;
}
