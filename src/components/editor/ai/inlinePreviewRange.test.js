import { expect, test } from "bun:test";
import { BlockNoteEditor } from "@blocknote/core";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { capturePrivateInlineTarget } from "@/lib/notebook-ai/inlineMarkdownApplySelection";
import { groupInlinePreviewRanges } from "./inlinePreviewRange";

function fixture() {
  return BlockNoteEditor.create({ initialContent: [
    { id: "a", type: "paragraph", content: "paragraph" },
    { id: "parent", type: "bulletListItem", content: "list", children: [
      { id: "child", type: "bulletListItem", content: "private child" },
    ] },
    { id: "empty", type: "paragraph", content: "" },
    { id: "code", type: "codeBlock", content: "const value = 1;" },
  ] });
}
function positions(editor) {
  const found = {};
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name === "blockContainer") found[node.attrs.id] = { pos, node };
  });
  return found;
}
function groups(editor, target) {
  return groupInlinePreviewRanges(editor.prosemirrorState.doc, target.parts.map((part) => ({
    blockFrom: part.from - part.offsetFrom - 1, id: part.blockId,
  }))).map((group) => group.map((part) => part.id));
}

test("one continuous range spans paragraphs, nested lists, empty lines and code", () => {
  const editor = fixture(); const p = positions(editor);
  editor.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, p.a.pos + 2, p.code.pos + 2 + p.code.node.firstChild.content.size)));
  expect(groups(editor, capturePrivateInlineTarget(editor, "a"))).toEqual([["a", "parent", "child", "empty", "code"]]);
});
test("unselected descendants break ranges instead of being included in the frame", () => {
  const editor = fixture(); const p = positions(editor);
  editor.transact((tr) => tr.setSelection(NodeSelection.create(tr.doc, p.parent.pos)));
  const parent = capturePrivateInlineTarget(editor, "parent").parts[0];
  const last = { blockFrom: p.code.pos + 1, id: "code" };
  expect(groupInlinePreviewRanges(editor.prosemirrorState.doc, [
    { blockFrom: parent.from - parent.offsetFrom - 1, id: parent.blockId }, last,
  ]).map((group) => group.map((part) => part.id))).toEqual([["parent"], ["code"]]);
});
