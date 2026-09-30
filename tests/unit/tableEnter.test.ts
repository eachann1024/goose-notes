import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { selectedRect } from "prosemirror-tables";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  applyTableEnter,
  applyTableShiftEnter,
} from "../../src/components/editor/extensions/tableEnterExtension";
import {
  isTableExtendPointerClick,
  TABLE_EXTEND_CLICK_SLOP_PX,
} from "../../src/components/editor/menus/tableExtendClick";

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

function placeCaretIn(editor: ReturnType<typeof createEditor>, text: string) {
  const range = findTextRange(editor, text);
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.to));
  });
}

function tableRowCount(editor: ReturnType<typeof createEditor>) {
  const table = editor.document.find((block) => block.type === "table");
  return (table?.content as { rows?: unknown[] } | undefined)?.rows?.length ?? 0;
}

function selectionText(editor: ReturnType<typeof createEditor>) {
  return editor.prosemirrorState.selection.$from.parent.textContent;
}

function dispatchEnter(editor: ReturnType<typeof createEditor>) {
  return applyTableEnter(editor.prosemirrorState, (tr) =>
    editor.prosemirrorView.dispatch(tr),
  );
}

function dispatchShiftEnter(editor: ReturnType<typeof createEditor>) {
  return applyTableShiftEnter(editor.prosemirrorState, (tr) =>
    editor.prosemirrorView.dispatch(tr),
  );
}

test("表格外回车不接管", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "p", type: "paragraph", content: [{ type: "text", text: "正文" }] },
    ] as any,
  });
  expect(applyTableEnter(editor.prosemirrorState)).toBe(false);
  expect(applyTableShiftEnter(editor.prosemirrorState)).toBe(false);
});

test("回车跳到同列下一行，不加行", () => {
  const editor = createEditor();
  placeCaretIn(editor, "维度");

  expect(dispatchEnter(editor)).toBe(true);
  expect(tableRowCount(editor)).toBe(2);
  expect(selectionText(editor)).toBe("用途");
});

test("末行回车新增一行并落到同列空单元格", () => {
  const editor = createEditor();
  placeCaretIn(editor, "用途");

  expect(dispatchEnter(editor)).toBe(true);
  expect(tableRowCount(editor)).toBe(3);
  expect(selectionText(editor)).toBe("");

  expect(dispatchEnter(editor)).toBe(true);
  expect(tableRowCount(editor)).toBe(4);
  expect(selectionText(editor)).toBe("");
});

test("末行另一列回车也加行并保持列", () => {
  const editor = createEditor();
  placeCaretIn(editor, "Agent");

  expect(dispatchEnter(editor)).toBe(true);
  expect(tableRowCount(editor)).toBe(3);
  expect(selectionText(editor)).toBe("");
  expect(selectedRect(editor.prosemirrorState).left).toBe(1);
});

test("Shift+Enter 在单元格内换行，不加行", () => {
  const editor = createEditor();
  placeCaretIn(editor, "Agent");

  expect(dispatchShiftEnter(editor)).toBe(true);
  expect(tableRowCount(editor)).toBe(2);
  expect(selectionText(editor)).toContain("Agent");
  expect(selectionText(editor)).toMatch(/Agent\s*$/);

  let hardBreaks = 0;
  editor.prosemirrorState.selection.$from.parent.forEach((node) => {
    if (node.type.name === "hardBreak") hardBreaks += 1;
  });
  expect(hardBreaks + (selectionText(editor).includes("\n") ? 1 : 0)).toBeGreaterThan(
    0,
  );
});

test("表格底部 + 的微移仍算点击", () => {
  expect(isTableExtendPointerClick(0)).toBe(true);
  expect(isTableExtendPointerClick(TABLE_EXTEND_CLICK_SLOP_PX - 1)).toBe(true);
  expect(isTableExtendPointerClick(-(TABLE_EXTEND_CLICK_SLOP_PX - 1))).toBe(
    true,
  );
  expect(isTableExtendPointerClick(TABLE_EXTEND_CLICK_SLOP_PX)).toBe(false);
  expect(isTableExtendPointerClick(12)).toBe(false);
});
