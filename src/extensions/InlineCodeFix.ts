import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

export const InlineCodeFix = Extension.create({
  name: "inlineCodeFix",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("inlineCodeFix"),
        props: {
          handleKeyDown: (view, event) => {
            if (event.key === "ArrowLeft") {
              const { state } = view;
              const { selection, doc } = state;
              const { $from, empty } = selection;

              if (!empty) return false;

              const pos = $from.pos;

              const codeAfterCursor =
                $from.nodeAfter?.marks?.some((m) => m.type.name === "code") ??
                false;
              const codeBeforeCursor =
                $from.nodeBefore?.marks?.some((m) => m.type.name === "code") ??
                false;

              const isAtCodeStart = codeAfterCursor && !codeBeforeCursor;
              if (isAtCodeStart) {
                const charBefore =
                  pos > $from.start() ? doc.textBetween(pos - 1, pos) : "";

                // 如果前面没有空格（或内容），插入空格并前移光标
                if (charBefore !== " ") {
                  event.preventDefault();
                  const tr = state.tr.insertText(" ", pos);
                  tr.setSelection(TextSelection.create(tr.doc, pos));
                  tr.setStoredMarks([]);
                  view.dispatch(tr);
                  return true;
                }

                event.preventDefault();
                const newPos = Math.max($from.start(), pos - 1);
                const tr = state.tr.setSelection(
                  TextSelection.create(doc, newPos),
                );
                tr.setStoredMarks([]);
                view.dispatch(tr);
                return true;
              }
            }

            if (event.key === "ArrowRight") {
              const { state } = view;
              const { selection, doc } = state;
              const { $from, empty } = selection;

              if (!empty) return false;

              const pos = $from.pos;
              if (pos >= doc.content.size) return false;

              const codeBeforeCursor =
                $from.nodeBefore?.marks?.some((m) => m.type.name === "code") ??
                false;
              const codeAfterCursor =
                $from.nodeAfter?.marks?.some((m) => m.type.name === "code") ??
                false;

              const isAtCodeEnd = codeBeforeCursor && !codeAfterCursor;
              if (isAtCodeEnd) {
                const charAfter =
                  pos < $from.end() ? doc.textBetween(pos, pos + 1) : "";

                if (charAfter !== " ") {
                  event.preventDefault();
                  const tr = state.tr.insertText(" ", pos);
                  tr.setSelection(TextSelection.create(tr.doc, pos + 1));
                  tr.setStoredMarks([]);
                  view.dispatch(tr);
                  return true;
                }

                event.preventDefault();
                const tr = state.tr.setSelection(
                  TextSelection.create(doc, pos + 1),
                );
                tr.setStoredMarks([]);
                view.dispatch(tr);
                return true;
              }
            }
            return false;
          },

          handleClick: (view, pos) => {
            const { state } = view;
            const { doc } = state;
            const $pos = doc.resolve(pos);

            const codeAfterCursor =
              $pos.nodeAfter?.marks?.some((m) => m.type.name === "code") ??
              false;
            const codeBeforeCursor =
              $pos.nodeBefore?.marks?.some((m) => m.type.name === "code") ??
              false;

            // 点击在代码边缘时清除 storedMarks
            if (
              (codeAfterCursor && !codeBeforeCursor) ||
              (codeBeforeCursor && !codeAfterCursor)
            ) {
              setTimeout(() => {
                view.dispatch(view.state.tr.setStoredMarks([]));
              }, 0);
            }
            return false;
          },
        },
      }),
    ];
  },
});
