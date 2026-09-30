import { readFileSync } from "node:fs";
import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  clearEditorSelectedBlocksCache,
  getEditorSelectedBlocksForExport,
  readLiveEditorSelectedBlocks,
  rememberEditorSelectedBlocks,
} from "../../src/components/editor/utils/selection";

function createEditor(content: Array<Record<string, unknown>>) {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: content as any,
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

function selectText(editor: ReturnType<typeof createEditor>, text: string) {
  const range = findTextRange(editor, text);
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.from, range.to));
  });
  return range;
}

function collapseToEnd(editor: ReturnType<typeof createEditor>, to: number) {
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, to, to));
  });
}

test("非空文字选区能读到覆盖块", () => {
  const editor = createEditor([
    { id: "body", type: "paragraph", content: "选中这段导出图片" },
  ]);
  selectText(editor, "选中这段导出图片");

  const blocks = readLiveEditorSelectedBlocks(editor);
  expect(blocks.length).toBeGreaterThan(0);
  expect(JSON.stringify(blocks)).toContain("选中这段导出图片");
});

test("光标塌缩后现场选区为空，导出仍回落到打开菜单前的快照", () => {
  const editor = createEditor([
    { id: "body", type: "paragraph", content: "选中这段导出图片" },
  ]);
  const range = selectText(editor, "选中这段导出图片");
  rememberEditorSelectedBlocks(editor);
  collapseToEnd(editor, range.to);

  expect(readLiveEditorSelectedBlocks(editor)).toEqual([]);
  const exported = getEditorSelectedBlocksForExport(editor);
  expect(exported.length).toBeGreaterThan(0);
  expect(JSON.stringify(exported)).toContain("选中这段导出图片");
});

test("没有快照的空选区不能当成选中内容", () => {
  const editor = createEditor([
    { id: "body", type: "paragraph", content: "只有光标" },
  ]);
  clearEditorSelectedBlocksCache(editor);

  expect(readLiveEditorSelectedBlocks(editor)).toEqual([]);
  expect(getEditorSelectedBlocksForExport(editor)).toEqual([]);
});

test("页面菜单确认主题时使用打开菜单时的选区快照", () => {
  const pageMenu = readFileSync(
    "src/pages/workspace/components/page/PageMenu.tsx",
    "utf8",
  );

  expect(pageMenu).toContain("getEditorSelectedBlocksForExport");
  expect(pageMenu).toContain("onPointerDownCapture={captureSelectedBlocks}");
  expect(pageMenu).toContain("const blocks = selectedBlocksRef.current;");
  expect(pageMenu).not.toContain("setSelectedBlocks(getEditorSelectedBlocks())");
  expect(pageMenu).not.toContain(
    "const blocks = getEditorSelectedBlocks();",
  );
});
