import { BlockNoteEditor } from "@blocknote/core";
import { expect, test } from "@playwright/test";
import type { Transaction } from "prosemirror-state";
import { CellSelection, deleteColumn } from "prosemirror-tables";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  createTableDeletionSnapshot,
  findBlockDocumentRange,
  isCellSelectionInsideBlock,
} from "../../src/components/editor/menus/tableDeletion";

const base = {
  blockId: "table-1",
  rowCount: 4,
  columnCount: 3,
} as const;

test("单行删除使用当前行句柄", () => {
  expect(
    createTableDeletionSnapshot({
      ...base,
      orientation: "row",
      handleIndex: 2,
    }).plan,
  ).toEqual({ kind: "delete-rows", fromIndex: 2, toIndex: 3 });
});

test("单列删除使用当前列句柄", () => {
  expect(
    createTableDeletionSnapshot({
      ...base,
      orientation: "column",
      handleIndex: 1,
    }).plan,
  ).toEqual({ kind: "delete-columns", fromIndex: 1, toIndex: 2 });
});

test("多行 CellSelection 覆盖单个行句柄", () => {
  expect(
    createTableDeletionSnapshot({
      ...base,
      orientation: "row",
      handleIndex: 0,
      selection: {
        blockId: "table-1",
        top: 1,
        bottom: 3,
        left: 0,
        right: 3,
      },
    }).plan,
  ).toEqual({ kind: "delete-rows", fromIndex: 1, toIndex: 3 });
});

test("多列 CellSelection 覆盖单个列句柄", () => {
  expect(
    createTableDeletionSnapshot({
      ...base,
      orientation: "column",
      handleIndex: 0,
      selection: {
        blockId: "table-1",
        top: 0,
        bottom: 4,
        left: 1,
        right: 3,
      },
    }).plan,
  ).toEqual({ kind: "delete-columns", fromIndex: 1, toIndex: 3 });
});

test("全行和全列选择都明确删除整张表", () => {
  expect(
    createTableDeletionSnapshot({
      ...base,
      orientation: "row",
      handleIndex: 2,
      selection: {
        blockId: "table-1",
        top: 0,
        bottom: 4,
        left: 0,
        right: 3,
      },
    }).plan,
  ).toEqual({ kind: "delete-table" });
  expect(
    createTableDeletionSnapshot({
      ...base,
      orientation: "column",
      handleIndex: 1,
      selection: {
        blockId: "table-1",
        top: 0,
        bottom: 4,
        left: 0,
        right: 3,
      },
    }).plan,
  ).toEqual({ kind: "delete-table" });
});

test("最后一行或最后一列使用整表删除兜底", () => {
  expect(
    createTableDeletionSnapshot({
      ...base,
      rowCount: 1,
      orientation: "row",
      handleIndex: 0,
    }).plan,
  ).toEqual({ kind: "delete-table" });
  expect(
    createTableDeletionSnapshot({
      ...base,
      columnCount: 1,
      orientation: "column",
      handleIndex: 0,
    }).plan,
  ).toEqual({ kind: "delete-table" });
});

test("菜单关闭后实时 selection 改变不会改写已快照的删除范围", () => {
  const liveSelection = {
    blockId: "table-1",
    anchorCell: 21,
    headCell: 42,
    top: 1,
    bottom: 3,
    left: 0,
    right: 3,
  };
  const snapshot = createTableDeletionSnapshot({
    ...base,
    orientation: "row",
    handleIndex: 0,
    selection: liveSelection,
  });

  liveSelection.top = 0;
  liveSelection.bottom = 1;
  liveSelection.anchorCell = 1;
  liveSelection.headCell = 2;

  expect(snapshot.plan).toEqual({
    kind: "delete-rows",
    fromIndex: 1,
    toIndex: 3,
  });
  expect(snapshot.cellSelection).toEqual({ anchorCell: 21, headCell: 42 });
});

test("忽略来自另一张表的旧 CellSelection", () => {
  expect(
    createTableDeletionSnapshot({
      ...base,
      orientation: "row",
      handleIndex: 2,
      selection: {
        blockId: "another-table",
        top: 0,
        bottom: 4,
        left: 0,
        right: 3,
      },
    }).plan,
  ).toEqual({ kind: "delete-rows", fromIndex: 2, toIndex: 3 });
});

test("直接通过 PM blockContainer 范围识别同表和异表 CellSelection", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "table-a",
        type: "table",
        content: {
          type: "tableContent",
          rows: [{ cells: [["a1"], ["a2"]] }],
        },
      },
      {
        id: "table-b",
        type: "table",
        content: {
          type: "tableContent",
          rows: [{ cells: [["b1"], ["b2"]] }],
        },
      },
    ] as any,
  });
  const doc = editor.prosemirrorState.doc;
  const cellPositions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.spec.tableRole === "cell") cellPositions.push(pos);
  });

  expect(findBlockDocumentRange(doc, "table-a")).not.toBeNull();
  expect(findBlockDocumentRange(doc, "missing")).toBeNull();
  expect(
    isCellSelectionInsideBlock(
      doc,
      "table-a",
      cellPositions[0],
      cellPositions[1],
    ),
  ).toBe(true);
  expect(
    isCellSelectionInsideBlock(
      doc,
      "table-b",
      cellPositions[0],
      cellPositions[1],
    ),
  ).toBe(false);
  expect(
    isCellSelectionInsideBlock(
      doc,
      "table-a",
      cellPositions[0],
      cellPositions[2],
    ),
  ).toBe(false);
});

test("派生 CellSelection 产生的删除事务可应用到当前 editor state", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "table-a",
        type: "table",
        content: {
          type: "tableContent",
          rows: [{ cells: [["a1"], ["a2"]] }, { cells: [["b1"], ["b2"]] }],
        },
      },
    ] as any,
  });
  const beforeState = editor.prosemirrorState;
  const cellPositions: number[] = [];
  beforeState.doc.descendants((node, pos) => {
    if (node.type.spec.tableRole === "cell") cellPositions.push(pos);
  });
  const commandState = beforeState.apply(
    beforeState.tr.setSelection(
      CellSelection.create(beforeState.doc, cellPositions[0], cellPositions[2]),
    ),
  );
  let deletionTransaction: Transaction | null = null;

  expect(
    deleteColumn(commandState, (transaction) => {
      deletionTransaction = transaction;
    }),
  ).toBe(true);
  expect(deletionTransaction).not.toBeNull();
  expect(() => beforeState.apply(deletionTransaction!)).not.toThrow();
});
