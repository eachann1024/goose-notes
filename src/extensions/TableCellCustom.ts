import { TableCell } from "@tiptap/extension-table-cell";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const TableCellCustom = TableCell.extend({
  name: "tableCell",

  addProseMirrorPlugins() {
    const applyPasteTransaction = (view: any, tr: any) => {
      tr.setMeta("uiEvent", "paste");
      tr.setMeta("addToHistory", true);
      view.dispatch(tr);
    };

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
                const sanitized = text.replace(/\n{2,}/g, "\n");
                if (sanitized !== text) {
                  const { state } = _view;
                  const fragment = state.schema.text(sanitized);
                  const tr = state.tr.replaceSelectionWith(fragment, false);
                  applyPasteTransaction(_view, tr);
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
