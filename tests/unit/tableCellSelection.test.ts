import { BlockNoteEditor } from "@blocknote/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "prosemirror-tables";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  gooseTableCellSelectionExtension,
  isCrossCellPointer,
  promoteCrossCellTextSelection,
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
