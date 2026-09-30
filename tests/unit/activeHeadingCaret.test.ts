import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  HEADING_CARET_ATTR,
  resolveHeadingCaretDecoration,
} from "../../src/components/editor/extensions/activeHeadingCaretExtension";

function contentRanges(editor: BlockNoteEditor<any, any, any>) {
  const ranges = new Map<string, { from: number; to: number }>();
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

function setCursorInBlock(
  editor: BlockNoteEditor<any, any, any>,
  blockId: string,
  offset = 0,
) {
  const range = contentRanges(editor).get(blockId);
  if (!range) throw new Error(`missing block ${blockId}`);
  editor.transact((tr) =>
    tr.setSelection(TextSelection.create(tr.doc, range.from + offset)),
  );
}

test("selection 在 heading 才打 data-goose-heading-caret", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "文档标题" },
      { id: "h2", type: "heading", props: { level: 2 }, content: "章节" },
      { id: "p1", type: "paragraph", content: "正文" },
    ],
  });

  setCursorInBlock(editor, "title");
  const titleDeco = resolveHeadingCaretDecoration(editor.prosemirrorState);
  expect(titleDeco?.find().length).toBe(1);
  expect(titleDeco?.find()[0]?.type.attrs[HEADING_CARET_ATTR]).toBe("true");

  setCursorInBlock(editor, "h2", 1);
  const headingDeco = resolveHeadingCaretDecoration(editor.prosemirrorState);
  expect(headingDeco?.find().length).toBe(1);
  expect(headingDeco?.find()[0]?.type.attrs[HEADING_CARET_ATTR]).toBe("true");

  setCursorInBlock(editor, "p1");
  expect(resolveHeadingCaretDecoration(editor.prosemirrorState)).toBeNull();
});
