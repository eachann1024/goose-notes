import { test } from "node:test";
import assert from "node:assert/strict";
import { BlockNoteEditor, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { gooseHeadingBlockSpec } from "../../src/components/editor/blocks/heading/headingBlockSpec.ts";
import { toggleHeadingCollapsed } from "../../src/components/editor/core/headingSectionFold.ts";

const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, heading: gooseHeadingBlockSpec },
});

function setup() {
  return BlockNoteEditor.create({
    schema,
    initialContent: [
      { id: "title", type: "heading", content: "文档标题" },
      { id: "parent", type: "heading", props: { level: 2 }, content: "优化" },
      { id: "child", type: "heading", props: { level: 3, collapsed: true }, content: "做游戏" },
      { id: "body", type: "paragraph", content: "正文", children: [
        { id: "nested", type: "paragraph", content: "嵌套正文" },
      ] },
      { id: "next", type: "heading", props: { level: 2 }, content: "其他" },
    ],
  });
}

for (const target of ["child", "body", "nested"]) {
  test(`收起父标题时将 ${target} 中的光标移到父标题，保留子级折叠`, () => {
    const editor = setup();
    editor.setTextCursorPosition(target, "end");
    toggleHeadingCollapsed(editor, "parent");
    assert.equal(editor.getBlock("parent")?.props.collapsed, true);
    assert.equal(editor.getBlock("child")?.props.collapsed, true);
    assert.equal(editor.getTextCursorPosition().block.id, "parent");
    assert.equal(editor.prosemirrorState.selection.$from.parentOffset, 2);
    toggleHeadingCollapsed(editor, "parent");
    assert.equal(editor.getBlock("parent")?.props.collapsed, false);
    assert.equal(editor.getBlock("child")?.props.collapsed, true);
  });
}

test("跨块选区与折叠章节相交时安全收回到父标题", () => {
  const editor = setup();
  editor.setTextCursorPosition("child", "start");
  const start = editor.prosemirrorState.selection.from;
  editor.setTextCursorPosition("next", "end");
  const end = editor.prosemirrorState.selection.to;
  editor.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, end, start)));
  toggleHeadingCollapsed(editor, "parent");
  assert.equal(editor.getTextCursorPosition().block.id, "parent");
  assert.equal(editor.prosemirrorState.selection.empty, true);
});

test("折叠不影响章节外的光标或标题自身的选区", () => {
  for (const target of ["title", "parent", "next"]) {
    const editor = setup();
    editor.setTextCursorPosition(target, "start");
    const before = editor.prosemirrorState.selection.toJSON();
    toggleHeadingCollapsed(editor, "parent");
    assert.deepEqual(editor.prosemirrorState.selection.toJSON(), before);
  }
});

test("展开不抢走其他章节的光标", () => {
  const editor = setup();
  editor.updateBlock("parent", { props: { collapsed: true } });
  editor.setTextCursorPosition("next", "end");
  const before = editor.prosemirrorState.selection.toJSON();
  toggleHeadingCollapsed(editor, "parent");
  assert.deepEqual(editor.prosemirrorState.selection.toJSON(), before);
});

test("物理嵌套标题的选区也移到被收起的父标题", () => {
  const editor = setup();
  editor.updateBlock("parent", { children: [
    { id: "legacy-child", type: "heading", props: { level: 3, collapsed: true }, content: "旧子标题" },
  ] });
  editor.setTextCursorPosition("legacy-child", "end");
  toggleHeadingCollapsed(editor, "parent");
  assert.equal(editor.getTextCursorPosition().block.id, "parent");
  assert.equal(editor.getBlock("legacy-child")?.props.collapsed, true);
});
