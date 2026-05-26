import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// 让光标位于行内 code mark 左右边界时，输入产生普通文本而不是继承 code 样式。
// 解决 ProseMirror 默认对 inclusive mark 在边界处"困住"光标导致无法从 code 前/后接续普通文字的问题。
function inlineCodeEscapePlugin() {
  return new Plugin({
    key: new PluginKey("gooseInlineCodeEscape"),
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.selectionSet)) return null;
      const { selection, schema, storedMarks } = newState;
      if (!selection.empty) return null;
      const codeType = schema.marks.code;
      if (!codeType) return null;

      const $cursor = (selection as any).$cursor ?? selection.$from;
      const nodeBefore = $cursor.nodeBefore;
      const nodeAfter = $cursor.nodeAfter;
      const beforeHasCode = nodeBefore ? codeType.isInSet(nodeBefore.marks) : false;
      const afterHasCode = nodeAfter ? codeType.isInSet(nodeAfter.marks) : false;

      const atStartBoundary = !beforeHasCode && afterHasCode;
      const atEndBoundary = beforeHasCode && !afterHasCode;
      if (!atStartBoundary && !atEndBoundary) return null;

      const currentMarks = storedMarks ?? $cursor.marks();
      if (!codeType.isInSet(currentMarks)) return null;

      const next = codeType.removeFromSet(currentMarks);
      return newState.tr.setStoredMarks(next);
    },
  });
}

export const gooseInlineCodeEscapeExtension = createExtension({
  key: "inlineCodeEscape",
  prosemirrorPlugins: [inlineCodeEscapePlugin()],
});
