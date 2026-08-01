import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import {
  deleteSelectedBlocks,
  hasPositiveBlockContentOverlap,
} from "../../src/components/editor/extensions/crossBlockDeleteExtension";
import { deleteEmptyNestedListItem } from "../../src/components/editor/extensions/emptyBlockBackspaceExtension";

type ContentRange = { from: number; to: number };

function contentRanges(editor: { prosemirrorState: EditorState }) {
  const ranges = new Map<string, ContentRange>();
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer" || !node.firstChild?.isTextblock) {
      return true;
    }
    const from = pos + 2;
    ranges.set(String(node.attrs.id), {
      from,
      to: from + node.firstChild.content.size,
    });
    return true;
  });
  return ranges;
}

function createListEditor() {
  return BlockNoteEditor.create({
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
      {
        id: "first",
        type: "bulletListItem",
        content: "通过 MQTT 协议进行 Chat 对话",
      },
      { id: "second", type: "bulletListItem", content: "任务编排" },
    ],
  });
}

test("选区端点只接触上一块行尾时，不把上一块算作跨块整体删除", () => {
  for (const reversed of [false, true]) {
    const editor = createListEditor();
    const ranges = contentRanges(editor);
    const first = ranges.get("first")!;
    const second = ranges.get("second")!;
    const anchor = reversed ? second.from + 2 : first.to;
    const head = reversed ? first.to : second.from + 2;

    editor.transact((tr) =>
      tr.setSelection(TextSelection.create(tr.doc, anchor, head)),
    );

    expect(deleteSelectedBlocks(editor)).toBe(false);
    expect(editor.document.map((block) => block.id)).toEqual([
      "title",
      "first",
      "second",
    ]);
  }
});

test("选区实际覆盖两个块正文时，仍整体删除两个块", () => {
  const editor = createListEditor();
  const ranges = contentRanges(editor);
  const first = ranges.get("first")!;
  const second = ranges.get("second")!;

  editor.transact((tr) =>
    tr.setSelection(
      TextSelection.create(tr.doc, second.from + 2, first.to - 1),
    ),
  );

  expect(deleteSelectedBlocks(editor)).toBe(true);
  expect(editor.document.map((block) => block.id)).toEqual(["title"]);
});

test("嵌套块按实际正文重叠收集，并由祖先块去重删除", () => {
  const editor = BlockNoteEditor.create({
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
      {
        id: "parent",
        type: "bulletListItem",
        content: "父项",
        children: [{ id: "child", type: "paragraph", content: "子项" }],
      },
      { id: "after", type: "paragraph", content: "后续" },
    ],
  });
  const ranges = contentRanges(editor);
  const parent = ranges.get("parent")!;
  const child = ranges.get("child")!;

  editor.transact((tr) =>
    tr.setSelection(
      TextSelection.create(tr.doc, parent.from + 1, child.to - 1),
    ),
  );

  expect(deleteSelectedBlocks(editor)).toBe(true);
  expect(editor.document.map((block) => block.id)).toEqual(["title", "after"]);
});

test("空文本块只有被选区严格跨过时才算选中", () => {
  expect(
    hasPositiveBlockContentOverlap(
      { from: 10, to: 12 },
      { from: 10, to: 10, isTextblock: true },
    ),
  ).toBe(false);
  expect(
    hasPositiveBlockContentOverlap(
      { from: 9, to: 11 },
      { from: 10, to: 10, isTextblock: true },
    ),
  ).toBe(true);
});

test("删除空的嵌套列表项时，后续兄弟仍留在原父项下", () => {
  const editor = BlockNoteEditor.create({
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
      {
        id: "parent",
        type: "bulletListItem",
        content: "功能应实现",
        children: [
          { id: "file", type: "bulletListItem", content: "文件支持" },
          { id: "empty", type: "bulletListItem", content: "" },
          { id: "context", type: "bulletListItem", content: "上下文配置" },
          { id: "memory", type: "bulletListItem", content: "记忆" },
        ],
      },
    ],
  });

  const empty = editor.getBlock("empty")!;
  expect(deleteEmptyNestedListItem(editor, empty)).toBe(true);

  const parent = editor.getBlock("parent")!;
  expect(parent.children.map((child) => child.id)).toEqual([
    "file",
    "context",
    "memory",
  ]);
  expect(editor.document.map((block) => block.id)).toEqual(["title", "parent"]);
  expect(editor.getTextCursorPosition().block.id).toBe("file");
});

test("顶层空列表项继续交给原生退格逻辑", () => {
  const editor = BlockNoteEditor.create({
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
      { id: "empty", type: "bulletListItem", content: "" },
    ],
  });

  expect(deleteEmptyNestedListItem(editor, editor.getBlock("empty")!)).toBe(
    false,
  );
  expect(editor.document.map((block) => block.id)).toEqual(["title", "empty"]);
});
