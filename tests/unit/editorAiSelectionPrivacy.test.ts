import { BlockNoteEditor, blockToNode } from "@blocknote/core";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import {
  captureInlineSelection,
  composeInlineReplacement,
} from "../../src/components/editor/ai/selectionPrivacy";

function contentRanges(editor: { prosemirrorState: EditorState }) {
  const ranges = new Map<string, { from: number; to: number }>();
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer" || !node.firstChild?.isTextblock)
      return true;
    const from = pos + 2;
    ranges.set(String(node.attrs.id), {
      from,
      to: from + node.firstChild.content.size,
    });
    return true;
  });
  return ranges;
}

function createSelectionEditor() {
  const editor = BlockNoteEditor.create({
    initialContent: [
      { id: "before", type: "paragraph", content: "PRIVATE BEFORE" },
      { id: "first", type: "paragraph", content: "PRIVATELEFTSELECT-ONE tail" },
      {
        id: "second",
        type: "paragraph",
        content: "head SELECT-TWOPRIVATERIGHT",
      },
      { id: "after", type: "paragraph", content: "PRIVATE AFTER" },
    ],
  });
  const ranges = contentRanges(editor);
  const from = ranges.get("first")!.from + "PRIVATELEFT".length;
  const to = ranges.get("second")!.to - "PRIVATERIGHT".length;
  editor.transact((tr) =>
    tr.setSelection(TextSelection.create(tr.doc, from, to)),
  );
  return { editor, from, to };
}

test("公共 snapshot 只裁出跨段精确字符，不扩到词边界", () => {
  const { editor, from, to } = createSelectionEditor();
  const snapshot = captureInlineSelection(
    editor.prosemirrorState.doc,
    from,
    to,
  );
  const serialized = JSON.stringify(
    snapshot.selectedNodes.map((node) => node.toJSON()),
  );
  expect(serialized).toContain("SELECT-ONE tail");
  expect(serialized).toContain("head SELECT-TWO");
  for (const outside of [
    "PRIVATE BEFORE",
    "PRIVATE AFTER",
    "PRIVATELEFT",
    "PRIVATERIGHT",
  ]) {
    expect(serialized).not.toContain(outside);
  }
  expect(snapshot.from).toBe(from);
  expect(snapshot.to).toBe(to);
});

test("光标块 snapshot 不包含其他块或当前块的子块", () => {
  const editor = BlockNoteEditor.create({
    initialContent: [
      {
        id: "current",
        type: "paragraph",
        content: "current",
        children: [
          { id: "child", type: "paragraph", content: "PRIVATE CHILD" },
        ],
      },
      { id: "after", type: "paragraph", content: "PRIVATE AFTER" },
    ],
  });
  const range = contentRanges(editor).get("current")!;
  const snapshot = captureInlineSelection(
    editor.prosemirrorState.doc,
    range.from,
    range.to,
  );
  expect(snapshot.selectedNodes.map((node) => node.textContent)).toEqual([
    "current",
  ]);
  expect(snapshot.selectedNodes[0].childCount).toBe(1);
});

test("准备草稿不写入，接受时只替换字符范围且保留前后块", () => {
  const { editor, from, to } = createSelectionEditor();
  const before = editor.prosemirrorState.doc;
  const snapshot = captureInlineSelection(before, from, to);
  const draft = composeInlineReplacement(snapshot, [
    blockToNode(
      { type: "paragraph", content: "replacement" },
      editor.prosemirrorState.schema,
    ),
  ]);
  expect(editor.prosemirrorState.doc.eq(before)).toBe(true);
  editor.transact((tr) =>
    tr.replaceWith(snapshot.replaceFrom, snapshot.replaceTo, draft),
  );
  expect(editor.document.map((block) => block.id)).toEqual([
    "before",
    "first",
    "after",
  ]);
  expect(editor.prosemirrorState.doc.textContent).toBe(
    "PRIVATE BEFOREPRIVATELEFTreplacementPRIVATERIGHTPRIVATE AFTER",
  );
  expect(
    editor.prosemirrorState.doc.firstChild!.firstChild!.eq(
      before.firstChild!.firstChild!,
    ),
  ).toBe(true);
  expect(
    editor.prosemirrorState.doc.firstChild!.lastChild!.eq(
      before.firstChild!.lastChild!,
    ),
  ).toBe(true);
});

test("结构草稿支持多列表块，同时保留选区外两端文字", () => {
  const { editor, from, to } = createSelectionEditor();
  const snapshot = captureInlineSelection(
    editor.prosemirrorState.doc,
    from,
    to,
  );
  const generated = ["one", "two"].map((content) =>
    blockToNode(
      { type: "bulletListItem", content },
      editor.prosemirrorState.schema,
    ),
  );
  const draft = composeInlineReplacement(snapshot, generated);
  editor.transact((tr) =>
    tr.replaceWith(snapshot.replaceFrom, snapshot.replaceTo, draft),
  );
  expect(editor.document.map((block) => block.type)).toEqual([
    "paragraph",
    "paragraph",
    "bulletListItem",
    "bulletListItem",
    "paragraph",
    "paragraph",
  ]);
  expect(editor.document[1].content).toEqual([
    { type: "text", text: "PRIVATELEFT", styles: {} },
  ]);
  expect(editor.document[4].content).toEqual([
    { type: "text", text: "PRIVATERIGHT", styles: {} },
  ]);
});

test("非正文端点明确报错而不是扩大到整块", () => {
  const { editor } = createSelectionEditor();
  expect(() =>
    captureInlineSelection(editor.prosemirrorState.doc, 1, 2),
  ).toThrow(/表格或跨层级/);
});
