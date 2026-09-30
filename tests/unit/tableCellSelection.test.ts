import { BlockNoteEditor } from "@blocknote/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import {
  CellSelection,
  tableEditing,
  TableMap,
  selectedRect,
  mergeCells,
  deleteRow,
  addRowBefore,
} from "prosemirror-tables";
import type { DecorationSet } from "prosemirror-view";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  createTableAwareSelection,
  gooseTableCellSelectionExtension,
  isCrossCellPointer,
  isSpanningTableSelection,
  promoteCrossCellTextSelection,
  selectionCrossesTableBoundary,
  shouldTakeOverOutsideTableDrag,
} from "../../src/components/editor/extensions/tableCellSelectionExtension";

const TABLE_CONTENT = [
  {
    id: "tbl",
    type: "table",
    content: {
      type: "tableContent",
      rows: [
        {
          cells: [
            [{ type: "text", text: "维度" }],
            [{ type: "text", text: "pi-mono" }],
          ],
        },
        {
          cells: [
            [{ type: "text", text: "用途" }],
            [{ type: "text", text: "Agent" }],
          ],
        },
      ],
    },
  },
];

const HEADING_THEN_TABLE = [
  {
    id: "h",
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "资质" }],
  },
  TABLE_CONTENT[0],
  {
    id: "after",
    type: "paragraph",
    content: [{ type: "text", text: "after" }],
  },
];

function createEditor() {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: TABLE_CONTENT as any,
  });
}

function findTextRange(editor: ReturnType<typeof createEditor>, text: string) {
  let result: { from: number; to: number } | null = null;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.isText && node.text === text) {
      result = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return result === null;
  });
  if (result === null) throw new Error(`Missing text: ${text}`);
  return result;
}

function fakeCell(name: "TD" | "TH" = "TD") {
  return {
    nodeName: name,
    parentNode: null as { nodeName: string; parentNode: null } | null,
  };
}

test("跨单元格 TextSelection（用途→维度）promote 为 CellSelection", () => {
  const editor = createEditor();
  const from = findTextRange(editor, "用途");
  const to = findTextRange(editor, "维度");
  // from>to 也可以：TextSelection.create 会按文档顺序规范化 $from/$to。
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from.from, to.to));
  });

  expect(editor.prosemirrorState.selection).toBeInstanceOf(TextSelection);

  const promoteTr = promoteCrossCellTextSelection(editor.prosemirrorState);
  expect(promoteTr).not.toBeNull();
  editor.prosemirrorView.dispatch(promoteTr!);
  expect(editor.prosemirrorState.selection).toBeInstanceOf(CellSelection);
});

test("单单元格 pi-mono TextSelection 不 promote", () => {
  const editor = createEditor();
  const range = findTextRange(editor, "pi-mono");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.from, range.to));
  });

  expect(promoteCrossCellTextSelection(editor.prosemirrorState)).toBeNull();
  expect(editor.prosemirrorState.selection).toBeInstanceOf(TextSelection);
});

test("注册扩展后，跨单元格 TextSelection 事务会提升为 CellSelection", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: TABLE_CONTENT as any,
    extensions: [gooseTableCellSelectionExtension],
  });
  const plugins = gooseTableCellSelectionExtension().prosemirrorPlugins ?? [];
  const from = findTextRange(editor, "用途");
  const to = findTextRange(editor, "维度");
  const selectionTr = editor.prosemirrorState.tr.setSelection(
    TextSelection.create(editor.prosemirrorState.doc, from.from, to.to),
  );
  // headless TipTap 不会把扩展插件挂到 PM state，这里用带插件的 EditorState 验证 appendTransaction。
  const stateWithPlugin = EditorState.create({
    schema: editor.prosemirrorState.schema,
    doc: editor.prosemirrorState.doc,
    plugins,
  });
  const { state } = stateWithPlugin.applyTransaction(selectionTr);

  expect(state.selection).toBeInstanceOf(CellSelection);
});

test("从下往上跨单元格 TextSelection（Agent→维度）仍 promote 为 CellSelection", () => {
  const editor = createEditor();
  const from = findTextRange(editor, "Agent");
  const to = findTextRange(editor, "维度");
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from.to, to.from));
  });

  expect(editor.prosemirrorState.selection).toBeInstanceOf(TextSelection);
  const promoteTr = promoteCrossCellTextSelection(editor.prosemirrorState);
  expect(promoteTr).not.toBeNull();
  editor.prosemirrorView.dispatch(promoteTr!);
  expect(editor.prosemirrorState.selection).toBeInstanceOf(CellSelection);
});

test("从表格拖到表前标题时保持跨块 TextSelection，不钳回表内", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: HEADING_THEN_TABLE as any,
  });
  const from = findTextRange(editor, "用途");
  const heading = findTextRange(editor, "资质");
  const $anchor = editor.prosemirrorState.doc.resolve(from.from);
  const $head = editor.prosemirrorState.doc.resolve(heading.from);

  expect(selectionCrossesTableBoundary($anchor, $head)).toBe(true);

  const aware = createTableAwareSelection($anchor, $head);
  expect(aware).toBeInstanceOf(TextSelection);
  expect(aware?.from).toBeLessThanOrEqual(heading.from);
  expect(aware?.to).toBeGreaterThanOrEqual(from.from);

  const $headEnd = editor.prosemirrorState.doc.resolve(heading.to);
  const moved = createTableAwareSelection($anchor, $headEnd);
  expect(moved?.to).toBe(aware?.to);

  const plain = EditorState.create({
    schema: editor.prosemirrorState.schema,
    doc: editor.prosemirrorState.doc,
  });
  const spanned = plain.apply(
    plain.tr.setSelection(
      TextSelection.create(plain.doc, from.from, heading.from),
    ),
  );
  expect(promoteCrossCellTextSelection(spanned)).toBeNull();
  expect(spanned.selection).toBeInstanceOf(TextSelection);
});

test("从表格拖到表后段落时保持跨块 TextSelection，不钳回表内", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: HEADING_THEN_TABLE as any,
  });
  const from = findTextRange(editor, "维度");
  const after = findTextRange(editor, "after");
  const $anchor = editor.prosemirrorState.doc.resolve(from.from);
  const $head = editor.prosemirrorState.doc.resolve(after.from);
  const aware = createTableAwareSelection($anchor, $head);

  expect(selectionCrossesTableBoundary($anchor, $head)).toBe(true);
  expect(aware).toBeInstanceOf(TextSelection);
  expect(aware?.to).toBeGreaterThanOrEqual(after.from);
});

test("有 tableEditing 时，跨出表格的 TextSelection 不会被收成单元格选区", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: HEADING_THEN_TABLE as any,
  });
  const plugins = [
    tableEditing(),
    ...(gooseTableCellSelectionExtension().prosemirrorPlugins ?? []),
  ];
  const from = findTextRange(editor, "用途");
  const heading = findTextRange(editor, "资质");
  const selectionTr = editor.prosemirrorState.tr.setSelection(
    TextSelection.create(editor.prosemirrorState.doc, from.from, heading.from),
  );
  const stateWithPlugin = EditorState.create({
    schema: editor.prosemirrorState.schema,
    doc: editor.prosemirrorState.doc,
    plugins,
  });
  const { state } = stateWithPlugin.applyTransaction(selectionTr);

  expect(state.selection).toBeInstanceOf(TextSelection);
  expect(state.selection).not.toBeInstanceOf(CellSelection);
  expect(state.selection.from).toBeLessThanOrEqual(heading.from);
  expect(state.selection.to).toBeGreaterThanOrEqual(from.from);
});

for (const direction of ["正向", "反向"] as const) {
  test(`${direction}从表外进入表格再越过表格时，始终保留原始锚点`, () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: HEADING_THEN_TABLE as any,
    });
    const plugins = [
      tableEditing(),
      ...(gooseTableCellSelectionExtension().prosemirrorPlugins ?? []),
    ];
    const heading = findTextRange(editor, "资质");
    const cell = findTextRange(editor, "维度");
    const after = findTextRange(editor, "after");
    const initialAnchor = direction === "正向" ? heading.from : after.to;
    const finalHead = direction === "正向" ? after.to : heading.from;
    const initialSelection = createTableAwareSelection(
      editor.prosemirrorState.doc.resolve(initialAnchor),
      editor.prosemirrorState.doc.resolve(cell.from),
    );
    expect(initialSelection).toBeInstanceOf(TextSelection);
    expect(initialSelection?.anchor).toBe(initialAnchor);
    expect(initialSelection?.head).toBe(
      direction === "正向" ? initialSelection?.to : initialSelection?.from,
    );

    let state = EditorState.create({
      schema: editor.prosemirrorState.schema,
      doc: editor.prosemirrorState.doc,
      selection: initialSelection!,
      plugins,
    });
    const finalSelection = TextSelection.create(
      state.doc,
      initialAnchor,
      finalHead,
    );

    expect(isSpanningTableSelection(finalSelection)).toBe(true);

    state = state.apply(state.tr.setSelection(finalSelection));

    expect(state.selection).toBeInstanceOf(TextSelection);
    expect(state.selection.eq(finalSelection)).toBe(true);
    expect(state.selection.anchor).toBe(initialAnchor);
    expect(state.selection.head).toBe(finalHead);
  });
}

test("表外起拖命中或跨过表格后接管，并持续到拖动结束", () => {
  expect(shouldTakeOverOutsideTableDrag(false, null)).toBe(false);
  expect(shouldTakeOverOutsideTableDrag(false, 12)).toBe(true);
  expect(shouldTakeOverOutsideTableDrag(false, null, true)).toBe(true);
  expect(shouldTakeOverOutsideTableDrag(true, 12)).toBe(true);
  expect(shouldTakeOverOutsideTableDrag(true, null)).toBe(true);
});

test("isCrossCellPointer 只在两个不同单元格时为 true", () => {
  const start = fakeCell("TD");
  const other = fakeCell("TH");
  const nested = { nodeName: "SPAN", parentNode: start };
  const nestedOther = { nodeName: "SPAN", parentNode: other };

  expect(isCrossCellPointer(start, other)).toBe(true);
  expect(isCrossCellPointer(nested, nestedOther)).toBe(true);
  expect(isCrossCellPointer(start, nested)).toBe(false);
  expect(isCrossCellPointer(start, start)).toBe(false);
  expect(isCrossCellPointer(null, other)).toBe(false);
  expect(isCrossCellPointer(start, null)).toBe(false);
});

function selectionChromeFixture(merged = false) {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "chrome-table",
        type: "table",
        content: {
          type: "tableContent",
          columnWidths: [80, 210, 130],
          rows: merged
            ? [
                { cells: ["a", "b", "c"] },
                {
                  cells: [
                    "d",
                    {
                      type: "tableCell",
                      props: { rowspan: 2, backgroundColor: "green" },
                      content: "multi\nline\ncell",
                    },
                    "e",
                  ],
                },
                { cells: ["f", "g"] },
              ]
            : [
                { cells: ["a", "b", "c"] },
                { cells: ["d", "multi\nline\ncell", "e"] },
                { cells: ["f", "g", "h"] },
              ],
        },
      },
    ] as any,
  });
  const plugin = gooseTableCellSelectionExtension().prosemirrorPlugins![0];
  const state = EditorState.create({
    schema: editor.prosemirrorState.schema,
    doc: editor.prosemirrorState.doc,
    plugins: [plugin],
  });
  const table = state.doc.firstChild!.firstChild!.firstChild!;
  const map = TableMap.get(table);
  let tableStart = 0;
  state.doc.descendants((node, pos) => {
    if (node.type.spec.tableRole === "table") tableStart = pos + 1;
  });
  const select = (anchor: number, head = anchor) =>
    state.apply(
      state.tr.setSelection(
        CellSelection.create(
          state.doc,
          tableStart + map.map[anchor],
          tableStart + map.map[head],
        ),
      ),
    );
  const chrome = (current: EditorState) => {
    const set = plugin.props.decorations!.call(
      plugin,
      current,
    ) as DecorationSet;
    return set.find().map((decoration) => ({
      pos: decoration.from,
      edges: (decoration as any).type.attrs.class
        .split(" ")
        .filter(Boolean)
        .map((name: string) => name.replace("goose-table-selection-", "")),
    }));
  };
  return { state, select, chrome, map, tableStart };
}

test("选区装饰只画连续矩形外边：单格、整表、反向、多行多列，不按列宽或行高猜测位置", () => {
  const { state, select, chrome, map, tableStart } = selectionChromeFixture();
  expect(chrome(state)).toEqual([]);
  expect(chrome(select(4))).toEqual([
    {
      pos: tableStart + map.map[4],
      edges: ["top", "right", "bottom", "left"],
    },
  ]);
  for (const [anchor, head, expected] of [
    [
      0,
      8,
      [
        ["top", "left"],
        ["top"],
        ["top", "right"],
        ["left"],
        [],
        ["right"],
        ["bottom", "left"],
        ["bottom"],
        ["right", "bottom"],
      ],
    ],
    [
      4,
      8,
      [
        ["top", "left"],
        ["top", "right"],
        ["bottom", "left"],
        ["right", "bottom"],
      ],
    ],
  ] as const) {
    const selected = select(anchor, head);
    expect(chrome(selected).map(({ edges }) => edges)).toEqual(expected);
    expect(chrome(select(head, anchor))).toEqual(chrome(selected));
    expect(selected.doc).toBe(state.doc);
  }
});

test("跨界 rowspan 以真实 selected set 为准，部分外露边降级无边而非内部粗框，取消恢复文档颜色", () => {
  const { state, select, chrome, map, tableStart } =
    selectionChromeFixture(true);
  const selected = select(1, 5);
  const before = state.doc.toJSON();
  const cells: number[] = [];
  (selected.selection as CellSelection).forEachCell((_node, pos) =>
    cells.push(pos),
  );
  expect(chrome(selected).map(({ pos }) => pos)).toEqual(cells);
  expect(chrome(selected)).toEqual([
    { pos: tableStart + map.map[1], edges: ["top", "left"] },
    { pos: tableStart + map.map[2], edges: ["top", "right"] },
    { pos: tableStart + map.map[4], edges: ["bottom", "left"] },
    { pos: tableStart + map.map[5], edges: ["right", "bottom"] },
  ]);
  expect(chrome(select(4))).toEqual([
    {
      pos: tableStart + map.map[4],
      edges: ["top", "right", "bottom", "left"],
    },
  ]);
  expect(
    chrome(select(0, 8)).filter(({ pos }) => pos === tableStart + map.map[4])[0]
      .edges,
  ).toEqual(["bottom"]);
  const cancelled = selected.apply(
    selected.tr.setSelection(TextSelection.near(selected.doc.resolve(1))),
  );
  expect(chrome(cancelled)).toEqual([]);
  expect(cancelled.doc.toJSON()).toEqual(before);
  expect(
    cancelled.doc.nodeAt(tableStart + map.map[4])!.attrs.backgroundColor,
  ).toBe("green");
});

test("colspan 左跨界未入选格不加装饰，文档增删事务后装饰按最新 CellSelection 重算", () => {
  const { state, select, chrome, map, tableStart } = selectionChromeFixture();
  let selected = select(0, 8);
  const original = chrome(selected);
  expect(
    addRowBefore(selected, (tr) => {
      selected = selected.apply(tr);
    }),
  ).toBe(true);
  expect(chrome(selected).map(({ edges }) => edges)).toEqual(
    original.map(({ edges }) => edges),
  );
  selected = select(0, 8);
  // Edit inside a cell changes every subsequent cell position, without changing selected membership.
  selected = selected.apply(
    selected.tr.insertText("longer harmless text", tableStart + map.map[0] + 2),
  );
  expect(chrome(selected).map(({ edges }) => edges)).toEqual(
    original.map(({ edges }) => edges),
  );
  expect(chrome(selected)[1].pos).toBeGreaterThan(original[1].pos);
  const updated = selectedRect(selected);
  selected = selected.apply(
    selected.tr.setSelection(
      CellSelection.create(
        selected.doc,
        updated.tableStart + updated.map.map[3],
        updated.tableStart + updated.map.map[5],
      ),
    ),
  );
  expect(
    deleteRow(selected, (tr) => {
      selected = selected.apply(tr);
    }),
  ).toBe(true);
  expect(chrome(selected)).toEqual([]);
  const table = selected.doc.firstChild!.firstChild!.firstChild!;
  selected = selected.apply(
    selected.tr.delete(tableStart - 1, tableStart - 1 + table.nodeSize),
  );
  expect(chrome(selected)).toEqual([]);

  let merged = state.apply(
    state.tr.setSelection(
      CellSelection.create(
        state.doc,
        tableStart + map.map[3],
        tableStart + map.map[4],
      ),
    ),
  );
  expect(
    mergeCells(merged, (tr) => {
      merged = merged.apply(tr);
    }),
  ).toBe(true);
  const rect = selectedRect(merged);
  merged = merged.apply(
    merged.tr.setSelection(
      CellSelection.create(
        merged.doc,
        rect.tableStart + rect.map.map[1],
        rect.tableStart + rect.map.map[8],
      ),
    ),
  );
  const positions: number[] = [];
  (merged.selection as CellSelection).forEachCell((_node, pos) =>
    positions.push(pos),
  );
  expect(chrome(merged).map(({ pos }) => pos)).toEqual(positions);
  expect(positions).not.toContain(rect.tableStart + rect.map.map[3]);
  expect(chrome(merged).map(({ edges }) => edges)).toEqual([
    ["top", "bottom", "left"],
    ["top", "right"],
    ["right", "left"],
    ["top", "bottom", "left"],
    ["right", "bottom"],
  ]);
});
