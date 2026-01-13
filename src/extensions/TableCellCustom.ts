import { TableCell } from "@tiptap/extension-table-cell";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const TableCellCustom = TableCell.extend({
  name: "tableCell",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("tableCellCustom"),
        props: {
          handlePaste(_view, event) {
            const text = event.clipboardData?.getData("text/plain");
            if (text) {
              const $from = _view.state.selection.$from;
              const ancestor = $from.node(-1);
              if (
                ancestor.type.name === "tableRow" ||
                ancestor.type.name === "tableHeaderRow"
              ) {
                const sanitized = text.replace(/\n\s*\n/g, "\n");
                if (sanitized !== text) {
                  const { state, dispatch } = _view;
                  const fragment = state.schema.text(sanitized);
                  const tr = state.tr.replaceSelectionWith(fragment, false);
                  dispatch(tr);
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
