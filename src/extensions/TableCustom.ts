import { mergeAttributes } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

const createDefaultTable = (
  schema: any,
  rowsCount: number,
  colsCount: number,
  withHeaderRow: boolean,
) => {
  const paragraph = schema.nodes.paragraph.createAndFill();
  const makeCell = (typeName: "tableCell" | "tableHeader") =>
    schema.nodes[typeName].createChecked(null, paragraph ? [paragraph] : undefined);

  const rows = Array.from({ length: rowsCount }, (_, rowIndex) => {
    const cellType = withHeaderRow && rowIndex === 0 ? "tableHeader" : "tableCell";
    const cells = Array.from({ length: colsCount }, () => makeCell(cellType));
    return schema.nodes.tableRow.createChecked(null, cells);
  });

  return schema.nodes.table.createChecked(
    {
      tableAlignment: "left",
      tableWidthMode: "full",
    },
    rows,
  );
};

const getTableWrapperStyle = (_alignment: string, widthMode: string) => {
  if (widthMode === "full") {
    return "width:100%;margin:1.5em 0;padding-right:20px;padding-bottom:20px;overflow-x:auto;overflow-y:visible;text-align:left;";
  }

  return "width:100%;margin:1.5em 0;padding-right:20px;padding-bottom:20px;overflow-x:auto;overflow-y:visible;text-align:left;";
};

const getTableStyle = (_alignment: string, widthMode: string) => {
  const baseStyle = "margin-top:0;margin-bottom:0;border-collapse:collapse;position:relative;background:transparent;";

  if (widthMode === "full") {
    return `${baseStyle}display:table;width:100%;min-width:100%;max-width:100%;margin-left:0;margin-right:0;`;
  }

  return `${baseStyle}display:inline-table;width:max-content;min-width:max(320px, max-content);max-width:none;margin-left:0;margin-right:auto;`;
};

const syncTableDom = (root: ParentNode, view: { state: any; posAtDOM: (node: Node, offset: number) => number }) => {
  const tables = root.querySelectorAll(".tableWrapper table");

  tables.forEach((tableElement) => {
    const table = tableElement as HTMLTableElement;
    const anchorNode = table.tBodies[0] ?? table;

    try {
      const pos = view.posAtDOM(anchorNode, 0);
      const $pos = view.state.doc.resolve(pos);

      for (let depth = $pos.depth; depth >= 0; depth -= 1) {
        const node = $pos.node(depth);
        if (node.type.name !== "table") continue;

        const tableAlignment = "left";
        const tableWidthMode = node.attrs.tableWidthMode || "content";
        const wrapper = table.parentElement;

        if (wrapper?.classList.contains("tableWrapper")) {
          wrapper.setAttribute("data-table-align", tableAlignment);
          wrapper.setAttribute("data-table-width-mode", tableWidthMode);
          wrapper.setAttribute("style", getTableWrapperStyle(tableAlignment, tableWidthMode));
        }

        table.setAttribute("data-table-align", tableAlignment);
        table.setAttribute("data-table-width-mode", tableWidthMode);
        table.setAttribute("style", getTableStyle(tableAlignment, tableWidthMode));
        break;
      }
    } catch {
      // ignore dom positions that are temporarily unavailable during updates
    }
  });
};

export const TableCustom = Table.extend({
  addCommands() {
    return {
      ...(this.parent?.() ?? {}),
      insertTable:
        (options?: { rows?: number; cols?: number; withHeaderRow?: boolean }) =>
        ({ editor, state, dispatch, tr }: any) => {
          const { rows = 3, cols = 3, withHeaderRow = true } = options ?? {};
          const node = createDefaultTable(editor.schema, rows, cols, withHeaderRow);

          if (dispatch) {
            const offset = tr.selection.from + 1;
            tr
              .replaceSelectionWith(node)
              .scrollIntoView()
              .setSelection(TextSelection.near(tr.doc.resolve(offset)));
            dispatch(tr);
          }

          return true;
        },
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      tableAlignment: {
        default: "left",
        parseHTML: (element) => element.getAttribute("data-table-align") || "left",
        renderHTML: (attributes) => ({
          "data-table-align": attributes.tableAlignment || "left",
        }),
      },
      tableWidthMode: {
        default: "content",
        parseHTML: (element) => element.getAttribute("data-table-width-mode") || "content",
        renderHTML: (attributes) => ({
          "data-table-width-mode": attributes.tableWidthMode || "content",
        }),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const tableAlignment = "left";
    const tableWidthMode = node.attrs.tableWidthMode || "content";

    return [
      "div",
      {
        class: "tableWrapper",
        "data-table-align": tableAlignment,
        "data-table-width-mode": tableWidthMode,
        style: getTableWrapperStyle(tableAlignment, tableWidthMode),
      },
      [
        "table",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          "data-table-align": tableAlignment,
          "data-table-width-mode": tableWidthMode,
          style: getTableStyle(tableAlignment, tableWidthMode),
        }),
        ["tbody", 0],
      ],
    ];
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];

    return [
      ...parentPlugins,
      new Plugin({
        key: new PluginKey("tableCustomDomSync"),
        view: (view) => {
          syncTableDom(view.dom, view);

          return {
            update: (updatedView) => {
              syncTableDom(updatedView.dom, updatedView);
            },
          };
        },
      }),
    ];
  },
});
