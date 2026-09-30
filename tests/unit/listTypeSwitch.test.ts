import { BlockNoteEditor } from "@blocknote/core";
import { AllSelection, TextSelection } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  applySelectedListType,
  getListTypeToolbarState,
} from "../../src/components/editor/toolbars/formatting/listType";

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
}

function blockById(editor: ReturnType<typeof createEditor>, id: string) {
  const walk = (blocks: any[]): any | undefined => {
    for (const block of blocks) {
      if (block.id === id) return block;
      const nested = walk(block.children ?? []);
      if (nested) return nested;
    }
    return undefined;
  };
  const found = walk(editor.document as any[]);
  if (!found) throw new Error(`Missing block: ${id}`);
  return found;
}

test("段落选区可转成三种列表，再点当前类型回到段落", () => {
  const editor = createEditor([
    { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
    { id: "p1", type: "paragraph", content: "周六上午出发" },
  ]);
  selectText(editor, "周六上午出发");

  expect(getListTypeToolbarState(editor)).toEqual({
    show: true,
    active: null,
    mixed: false,
  });

  expect(applySelectedListType(editor, "bulletListItem")).toBe(true);
  expect(blockById(editor, "p1").type).toBe("bulletListItem");
  expect(getListTypeToolbarState(editor).active).toBe("bulletListItem");

  expect(applySelectedListType(editor, "numberedListItem")).toBe(true);
  expect(blockById(editor, "p1").type).toBe("numberedListItem");

  expect(applySelectedListType(editor, "checkListItem")).toBe(true);
  expect(blockById(editor, "p1").type).toBe("checkListItem");
  expect(blockById(editor, "p1").props.checked).toBe(false);

  // 方案 A：再点当前类型取消回 paragraph。
  expect(applySelectedListType(editor, "checkListItem")).toBe(true);
  expect(blockById(editor, "p1").type).toBe("paragraph");
  expect(getListTypeToolbarState(editor).active).toBeNull();
});

test("混合列表统一成目标类型，并保留已勾选", () => {
  const editor = createEditor([
    { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
    { id: "c1", type: "checkListItem", props: { checked: true }, content: "买面包" },
    { id: "b1", type: "bulletListItem", content: "东门集合" },
  ]);

  const from = findTextRange(editor, "买面包").from;
  const to = findTextRange(editor, "东门集合").to;
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from, to));
  });

  expect(getListTypeToolbarState(editor).active).toBeNull();
  expect(getListTypeToolbarState(editor).mixed).toBe(true);

  applySelectedListType(editor, "checkListItem");
  expect(blockById(editor, "c1").type).toBe("checkListItem");
  expect(blockById(editor, "c1").props.checked).toBe(true);
  expect(blockById(editor, "b1").type).toBe("checkListItem");
  expect(blockById(editor, "b1").props.checked).toBe(false);
});

test("换类型不留下 checked / start", () => {
  const editor = createEditor([
    { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
    { id: "n1", type: "numberedListItem", props: { start: 3 }, content: "第一步" },
    { id: "c2", type: "checkListItem", props: { checked: true }, content: "收尾" },
  ]);

  const from = findTextRange(editor, "第一步").from;
  const to = findTextRange(editor, "收尾").to;
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, from, to));
  });

  applySelectedListType(editor, "bulletListItem");

  expect(blockById(editor, "n1").type).toBe("bulletListItem");
  expect(blockById(editor, "n1").props.start).toBeUndefined();
  expect(blockById(editor, "c2").type).toBe("bulletListItem");
  expect(blockById(editor, "c2").props.checked).toBeUndefined();
});

test("页面标题不转换，正文列表可转，嵌套子项保留", () => {
  const editor = createEditor([
    { id: "title", type: "heading", props: { level: 1 }, content: "周末行程" },
    {
      id: "parent",
      type: "bulletListItem",
      content: "沿湖步道",
      children: [{ id: "child", type: "bulletListItem", content: "带水壶" }],
    },
  ]);

  editor.transact((tr) => {
    tr.setSelection(new AllSelection(tr.doc));
  });

  applySelectedListType(editor, "numberedListItem");

  expect(blockById(editor, "title").type).toBe("heading");
  expect(blockById(editor, "parent").type).toBe("numberedListItem");
  // 子项随父块保留：类型与挂载位置不受选区转换影响。
  expect(blockById(editor, "child").type).toBe("bulletListItem");
  expect(blockById(editor, "parent").children?.[0]?.id).toBe("child");
});

test("代码块不出现列表切换", () => {
  const editor = createEditor([
    { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
    { id: "code", type: "codeBlock", props: { language: "ts" }, content: "const x = 1" },
  ]);
  selectText(editor, "const x = 1");
  expect(getListTypeToolbarState(editor).show).toBe(false);
  expect(applySelectedListType(editor, "bulletListItem")).toBe(false);
});
