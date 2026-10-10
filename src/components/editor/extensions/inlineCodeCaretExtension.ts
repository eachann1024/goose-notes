import { createExtension } from "@blocknote/core";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { storedMarksForCodeEdge } from "./inlineCodeWordBoundary";
import { inlineCodeEdgeAt } from "./inlineCodeCaretModel";
import {
  handleArrow,
  handleDelete,
  handleWordDelete,
  handleWordMove,
} from "./inlineCodeCaretKeyboard";
import { inlineCodeElementAt, syncCaretSide } from "./inlineCodeCaretDom";
export {
  edgeGraphemeLength,
  inlineCodeEdgeAt,
  inlineCodeEdgeArrowAction,
  shouldKeepInlineCodeDomCaret,
  type InlineCodeEdge,
  type InlineCodeEdgeArrowAction,
} from "./inlineCodeCaretModel";
export { handleArrow } from "./inlineCodeCaretKeyboard";

/**
 * 行内代码的光标进出。
 *
 * 「盒内 / 盒外」不是插件自己的状态，而是直接读 ProseMirror 的
 * storedMarks（缺省时读 `$pos.marks()`）：含 code 即盒内。code mark
 * inclusive: false，右边界缺省在盒外、左边界缺省在盒外；盒内两端由
 * storedMarks 带上 code。盒外不写 storedMarks，避免 compositionstart
 * 把 truthy storedMarks 当成 markCursor 重启、打断拼音。
 */

function inlineCodeCaretPlugin() {
  return new Plugin({
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        if (event.isComposing || view.composing) return false;
        // Cmd+Backspace 等整行删除保持浏览器 / PM 默认，可连同行内代码一起删。
        if (event.metaKey) return false;

        if (event.altKey && !event.ctrlKey) {
          if (event.key === "Backspace" || event.keyCode === 8) {
            return handleWordDelete(view, "backward");
          }
          if (event.key === "Delete" || event.keyCode === 46) {
            return handleWordDelete(view, "forward");
          }
          if (event.key === "ArrowLeft" || event.keyCode === 37) {
            return handleWordMove(view, "backward", event.shiftKey);
          }
          if (event.key === "ArrowRight" || event.keyCode === 39) {
            return handleWordMove(view, "forward", event.shiftKey);
          }
        }

        if (event.shiftKey || event.ctrlKey || event.altKey) return false;
        if (event.key === "ArrowLeft" || event.keyCode === 37) {
          return handleArrow(view, "left");
        }
        if (event.key === "ArrowRight" || event.keyCode === 39) {
          return handleArrow(view, "right");
        }
        if (event.key === "Backspace" || event.keyCode === 8) {
          return handleDelete(view, "backward");
        }
        if (event.key === "Delete" || event.keyCode === 46) {
          return handleDelete(view, "forward");
        }
        return false;
      },
      handleDOMEvents: {
        beforeinput(view: EditorView, event: Event): boolean {
          if (view.composing) return false;
          const input = event as InputEvent;
          if (input.inputType === "deleteWordBackward") {
            if (!handleWordDelete(view, "backward")) return false;
            event.preventDefault();
            return true;
          }
          if (input.inputType === "deleteWordForward") {
            if (!handleWordDelete(view, "forward")) return false;
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
      /** 点在盒子矩形内落盒内、点在左右留白里落盒外。 */
      handleClick(view: EditorView, pos: number, event: MouseEvent): boolean {
        if (event.button !== 0) return false;

        const { state } = view;
        const codeType = state.schema.marks.code;
        if (!codeType) return false;

        const $pos = state.doc.resolve(pos);
        const edge = inlineCodeEdgeAt($pos, codeType);
        if (!edge) return false;

        const code = inlineCodeElementAt(view, pos, edge);
        if (!code) return false;

        const rect = code.getBoundingClientRect();
        const inside = event.clientX > rect.left && event.clientX < rect.right;
        view.dispatch(
          state.tr
            .setSelection(TextSelection.create(state.doc, pos))
            .setStoredMarks(storedMarksForCodeEdge($pos, codeType, inside)),
        );
        return true;
      },
    },
    view() {
      return { update: syncCaretSide };
    },
  });
}

export const gooseInlineCodeCaretExtension = createExtension({
  key: "goose-inline-code-caret",
  prosemirrorPlugins: [inlineCodeCaretPlugin()],
});
