import { TableCell } from "@tiptap/extension-table-cell";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const TableCellCustom = TableCell.extend({
  name: "tableCell",

  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "left",
        parseHTML: (element) => element.getAttribute("data-align") || "left",
        renderHTML: (attributes) => ({
          "data-align": attributes.align || "left",
        }),
      },
    };
  },

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
            // 移除表格单元格内的特殊粘贴处理，使用原生行为
            return false;
          },
        },
      }),
    ];
  },
});
