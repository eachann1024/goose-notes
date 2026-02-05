import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, Selection } from "@tiptap/pm/state";

export const TitleHeading = Extension.create({
  name: "titleHeading",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("titleHeadingPlugin"),

        appendTransaction: (transactions, _oldState, newState) => {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;

          const { doc, schema } = newState;
          const firstNode = doc.firstChild;

          if (
            !firstNode ||
            firstNode.type.name !== "heading" ||
            firstNode.attrs.level !== 1
          ) {
            const tr = newState.tr;

            if (!firstNode) {
              tr.insert(
                0,
                schema.nodes.heading.create({ level: 1 }),
              );
              return tr;
            }

            if (
              firstNode.type.name === "paragraph" &&
              firstNode.content.size === 0
            ) {
              tr.setNodeMarkup(0, schema.nodes.heading, { level: 1 });
              return tr;
            }

            if (
              firstNode.type.name === "heading" &&
              firstNode.attrs.level !== 1
            ) {
              tr.setNodeMarkup(0, schema.nodes.heading, { level: 1 });
              return tr;
            }

            if (firstNode.type.name !== "heading") {
              tr.insert(
                0,
                schema.nodes.heading.create({ level: 1 }),
              );
              return tr;
            }
          }

          return null;
        },

        props: {
          handleKeyDown: (view, event) => {
            const { state } = view;
            const { selection, doc, schema } = state;
            const { $from } = selection;

            const isInTitle = $from.before(1) === 0;

            if (!isInTitle) {
              if (event.key === "ArrowUp") {
                const titleNode = doc.firstChild;
                const titleSize = titleNode ? titleNode.nodeSize : 0;

                if (
                  $from.before(1) === titleSize &&
                  view.endOfTextblock("up")
                ) {
                  const tr = state.tr;
                  const titleEnd = titleSize - 1;
                  tr.setSelection(Selection.near(tr.doc.resolve(titleEnd)));
                  view.dispatch(tr);
                  return true;
                }
              }
              return false;
            }

            if (
              event.key === "Backspace" &&
              $from.pos === 1 &&
              selection.empty
            ) {
              event.preventDefault();
              return true;
            }

            if (event.key === "Enter" && event.shiftKey) {
              event.preventDefault();
              return true;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const { tr } = state;
              // 使用 split 方法分割节点，并指定新节点的类型为 paragraph
              // 这样处理更符合 ProseMirror 的事务逻辑，避免无效的嵌套节点
              tr.split($from.pos, 1, [{ type: schema.nodes.paragraph }]);
              view.dispatch(tr);
              return true;
            }

            if (event.key === "ArrowDown") {
              if (view.endOfTextblock("down")) {
                const titleNode = doc.firstChild;
                const titleSize = titleNode ? titleNode.nodeSize : 0;
                if (doc.childCount > 1) {
                  const tr = state.tr;
                  tr.setSelection(
                    Selection.near(tr.doc.resolve(titleSize + 1)),
                  );
                  view.dispatch(tr);
                  return true;
                }
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});
