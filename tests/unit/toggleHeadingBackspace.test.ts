import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import { gooseEmptyBlockBackspaceExtension } from "../../src/components/editor/extensions/emptyBlockBackspaceExtension";
import { tryJoinToggleHeadingChildBackward } from "../../src/components/editor/extensions/toggleHeadingJoinBackwardExtension";

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

function blockText(editor: BlockNoteEditor<any, any, any>, id: string) {
  const content = editor.getBlock(id)?.content as { text?: string }[] | undefined;
  return (content ?? []).map((c) => c.text ?? "").join("");
}

function setCursorAtBlockStart(
  editor: BlockNoteEditor<any, any, any>,
  blockId: string,
) {
  const range = contentRanges(editor).get(blockId);
  if (!range) throw new Error(`missing block ${blockId}`);
  editor.transact((tr) =>
    tr.setSelection(TextSelection.create(tr.doc, range.from)),
  );
}

function pressEmptyBlockBackspace(editor: BlockNoteEditor<any, any, any>) {
  const ext = gooseEmptyBlockBackspaceExtension() as {
    keyboardShortcuts?: {
      Backspace?: (ctx: { editor: unknown }) => boolean;
    };
  };
  return ext.keyboardShortcuts?.Backspace?.({ editor }) ?? false;
}

test("折叠标题 children 行首 Backspace 一次合并为一段", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "文档标题" },
      {
        id: "toggle",
        type: "heading",
        props: { level: 2, isToggleable: true },
        content: "章节",
        children: [
          { id: "p1", type: "paragraph", content: "你好啊" },
          { id: "p2", type: "paragraph", content: "12312" },
        ],
      },
    ],
  });

  setCursorAtBlockStart(editor, "p2");
  expect(tryJoinToggleHeadingChildBackward(editor)).toBe(true);

  const heading = editor.getBlock("toggle")!;
  expect(heading.children.map((c) => c.id)).toEqual(["p1"]);
  expect(blockText(editor, "p1")).toBe("你好啊12312");
  expect(editor.getBlock("p2")).toBeUndefined();
});

test("顶层兄弟段落行首 Backspace 不走折叠合并", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "文档标题" },
      { id: "p1", type: "paragraph", content: "你好啊" },
      { id: "p2", type: "paragraph", content: "12312" },
    ],
  });

  setCursorAtBlockStart(editor, "p2");
  expect(tryJoinToggleHeadingChildBackward(editor)).toBe(false);
  expect(editor.document.map((b) => b.id)).toEqual(["title", "p1", "p2"]);
  expect(blockText(editor, "p1")).toBe("你好啊");
  expect(blockText(editor, "p2")).toBe("12312");
});

test("折叠 children 里空段行首 Backspace 仍只删空行", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "文档标题" },
      {
        id: "toggle",
        type: "heading",
        props: { level: 2, isToggleable: true },
        content: "章节",
        children: [
          { id: "p1", type: "paragraph", content: "你好啊" },
          { id: "empty", type: "paragraph", content: "" },
          { id: "p2", type: "paragraph", content: "12312" },
        ],
      },
    ],
  });

  setCursorAtBlockStart(editor, "empty");
  expect(tryJoinToggleHeadingChildBackward(editor)).toBe(false);
  expect(pressEmptyBlockBackspace(editor)).toBe(true);

  const heading = editor.getBlock("toggle")!;
  expect(heading.children.map((c) => c.id)).toEqual(["p1", "p2"]);
  expect(blockText(editor, "p1")).toBe("你好啊");
  expect(blockText(editor, "p2")).toBe("12312");
  expect(editor.getBlock("empty")).toBeUndefined();
});
