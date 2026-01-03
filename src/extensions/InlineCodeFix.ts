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
              if (pos === 0) return false;

              const marks = doc.resolve(pos).marks();
              const isInsideCode = marks.some((m) => m.type.name === "code");
              const marksBefore = doc.resolve(pos - 1).marks();
              const isCodeBefore = marksBefore.some(
                (m) => m.type.name === "code",
              );

              if (isInsideCode && !isCodeBefore) {
                event.preventDefault();
                const tr = state.tr.setSelection(
                  TextSelection.create(doc, pos - 1),
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

              const marksBefore = doc.resolve(pos - 1).marks();
              const isCodeBefore = marksBefore.some(
                (m) => m.type.name === "code",
              );
              const marksAfter = doc.resolve(pos).marks();
              const isCodeAfter = marksAfter.some(
                (m) => m.type.name === "code",
              );

              if (isCodeBefore && !isCodeAfter) {
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
            const marks = doc.resolve(pos).marks();
            const marksBefore = doc.resolve(Math.max(0, pos - 1)).marks();

            const isAtStartOfMark =
              marks.some((m) => m.type.name === "code") &&
              (pos === 1 || !marksBefore.some((m) => m.type.name === "code"));

            if (isAtStartOfMark) {
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
