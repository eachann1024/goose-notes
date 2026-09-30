import { BlockNoteEditor } from "@blocknote/core";
import { TableHandlesExtension } from "@blocknote/core/extensions";
import { expect, test } from "@playwright/test";
import { TableMap } from "prosemirror-tables";
import { history, undo } from "@tiptap/pm/history";
import {
  duplicateTableDimension,
  editTableDimension,
  insertTableDimension,
  tableHandleColumnIndex,
  tableDimensionColor,
} from "../../src/components/editor/menus/tableMenuActions";
import { editorSchema } from "../../src/components/editor/core/schema";

function makeEditor(merged = false) {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "table",
        type: "table",
        content: {
          type: "tableContent",
          headerRows: 1,
          headerCols: 1,
          columnWidths: [100, 230],
          rows: merged
            ? [
                {
                  cells: [
                    {
                      type: "tableCell",
                      props: { colspan: 2, backgroundColor: "blue" },
                      content: "merged",
                    },
                  ],
                },
                { cells: ["left", "right"] },
              ]
            : [{ cells: ["a", "b"] }, { cells: ["c", "d"] }],
        },
      },
    ] as any,
  });
}

test("duplicate copies rich cells independently and preserves unequal widths and headers", () => {
  const editor = makeEditor();
  const content = editor.getBlock("table")!.content as any;
  const next = duplicateTableDimension(content, "column", 1);
  expect(next.columnWidths).toEqual([100, 230, 230]);
  expect(next.headerRows).toBe(1);
  expect(next.headerCols).toBe(1);
  expect(next.rows[0].cells[2]).toEqual(content.rows[0].cells[1]);
  expect(next.rows[0].cells[2]).not.toBe(content.rows[0].cells[1]);
  editor.updateBlock("table", { type: "table", content: next });
  expect((editor.getBlock("table")!.content as any).rows[0].cells).toHaveLength(
    3,
  );
  expect(() => duplicateTableDimension(content, "row", -1)).toThrow();
  expect(() =>
    duplicateTableDimension(
      makeEditor(true).getBlock("table")!.content as any,
      "row",
      0,
    ),
  ).toThrow(/合并/);
});

test("clear and color are real transactions, preserve spans/props, serialize and undo", () => {
  const editor = makeEditor(true);
  let state = editor.prosemirrorState.reconfigure({
    plugins: [...editor.prosemirrorState.plugins, history()],
  });
  const before = state.doc.toJSON();
  expect(
    editTableDimension("table", "column", 1, {
      type: "color",
      property: "textColor",
      color: "green",
    })(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  const cells: any[] = [];
  state.doc.descendants((node) => {
    if (node.type.spec.tableRole?.includes("cell")) cells.push(node);
  });
  expect(cells[0].attrs.textColor).toBe("green");
  expect(cells[0].attrs.backgroundColor).toBe("blue");
  expect(cells[0].attrs.colspan).toBe(2);
  expect(cells[1].attrs.textColor).toBe("default");
  expect(
    editTableDimension("table", "row", 0, { type: "clear" })(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  const table = state.doc.firstChild!.firstChild!.firstChild!;
  expect(table.firstChild!.firstChild!.textContent).toBe("");
  expect(table.firstChild!.firstChild!.attrs.colspan).toBe(2);
  expect(table.firstChild!.firstChild!.attrs.backgroundColor).toBe("blue");
  expect(table.child(1).textContent).toBe("leftright");
  const restored = makeEditor();
  expect(() =>
    restored.prosemirrorState.schema.nodeFromJSON(state.doc.toJSON()),
  ).not.toThrow();
  expect(
    undo(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  expect(state.doc.toJSON()).toEqual(before);
});

test("native insertion preserves crossing merged cells and transaction compatibility", () => {
  const editor = makeEditor(true);
  let state = editor.prosemirrorState.reconfigure({
    plugins: [...editor.prosemirrorState.plugins, history()],
  });
  expect(
    insertTableDimension(
      "table",
      "column",
      1,
      true,
    )(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  const table = state.doc.firstChild!.firstChild!.firstChild!;
  expect(TableMap.get(table).width).toBe(3);
  expect(TableMap.get(table).problems).toBeNull();
  expect(table.firstChild!.firstChild!.attrs.colspan).toBe(3);
  expect(table.textContent).toContain("merged");
  expect(table.child(1).textContent).toBe("leftright");
  expect(
    editTableDimension("missing", "row", 0, { type: "clear" })(state),
  ).toBe(false);
  expect(
    editTableDimension("table", "row", 100, { type: "clear" })(state),
  ).toBe(false);
});

test("DOM handle index maps past spans and extension shrinking never crops populated cells", () => {
  const editor = makeEditor(true);
  editor.updateBlock("table", {
    type: "table",
    content: {
      type: "tableContent",
      rows: [
        {
          cells: [
            { type: "tableCell", props: { colspan: 2 }, content: "merged" },
            "third",
          ],
        },
        { cells: ["", "", ""] },
      ],
    } as any,
  });
  expect(tableHandleColumnIndex(editor.prosemirrorState, "table", 0, 1)).toBe(
    2,
  );
  const handles = editor.getExtension(TableHandlesExtension)!;
  const block = editor.getBlock("table") as any;
  const cropped = handles.cropEmptyRowsOrColumns(block, "rows");
  expect(cropped).toHaveLength(1);
  expect(cropped[0].cells).toEqual(block.content.rows[0].cells);
  const expanded = handles.addRowsOrColumns(
    { ...block, content: { ...block.content, rows: cropped } },
    "rows",
    3,
  );
  expect(expanded).toHaveLength(4);
  expect(expanded[0].cells).toEqual(block.content.rows[0].cells);
  expect(handles.cropEmptyRowsOrColumns(block, "columns")[0].cells).toEqual(
    block.content.rows[0].cells,
  );
});

test("palette selection reads uniform, mixed, default and spanning dimension colors from the document", () => {
  const editor = makeEditor(true);
  const color = (
    axis: "row" | "column",
    index: number,
    property: "textColor" | "backgroundColor",
  ) =>
    tableDimensionColor(
      editor.prosemirrorState,
      "table",
      axis,
      index,
      property,
    );
  expect(color("row", 0, "backgroundColor")).toBe("blue");
  expect(color("column", 1, "backgroundColor")).toBeUndefined();
  expect(color("column", 1, "textColor")).toBe("default");
  editor.exec(
    editTableDimension("table", "column", 1, {
      type: "color",
      property: "textColor",
      color: "green",
    }),
  );
  expect(color("column", 1, "textColor")).toBe("green");
  expect(color("row", 0, "textColor")).toBe("green");
  expect(color("row", 1, "textColor")).toBeUndefined();
  editor.exec(
    editTableDimension("table", "column", 1, {
      type: "color",
      property: "textColor",
      color: "default",
    }),
  );
  expect(color("column", 1, "textColor")).toBe("default");
  expect(color("row", 100, "textColor")).toBeUndefined();
  expect(
    tableDimensionColor(
      editor.prosemirrorState,
      "missing",
      "row",
      0,
      "textColor",
    ),
  ).toBeUndefined();
});

test("editor.exec persists cell colors and clears to the BlockNote document shape", () => {
  const editor = makeEditor(true);
  editor.exec(
    editTableDimension("table", "row", 0, {
      type: "color",
      property: "backgroundColor",
      color: "green",
    }),
  );
  editor.exec(editTableDimension("table", "row", 0, { type: "clear" }));
  const content = editor.getBlock("table")!.content as any;
  expect(content.rows[0].cells[0].props.backgroundColor).toBe("green");
  expect(content.rows[0].cells[0].props.colspan).toBe(2);
  expect(content.rows[0].cells[0].content).toEqual([]);
  const saved = JSON.parse(JSON.stringify(editor.document));
  const restored = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: saved,
  });
  expect(restored.document).toEqual(editor.document);
});
