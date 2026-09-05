import { readFileSync } from "node:fs";
import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import { resolveActiveLineDecoration } from "../../src/components/editor/extensions/activeLineExtension";
import {
  CODE_ACTIVE_LINE_ATTR,
  lineIndexAtTextOffset,
  resolveCodeBlockActiveLine,
} from "../../src/components/editor/blocks/code/codeBlockActiveLine";

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

test("代码高亮共用正文行盒，并以明暗主题实色边框裁切", () => {
  const css = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base/code.css", import.meta.url),
    "utf8",
  );
  const wrapper = css.match(/\.goose-code-content-wrapper \{([^}]+)\}/)?.[1];
  const pre = css.match(/\.goose-code-pre \{([^}]+)\}/)?.[1];
  const shell = css.match(/\.goose-code-block-node \{([^}]+)\}/)?.[1];
  expect(wrapper).toContain("--goose-code-line-box: 1lh");
  expect(wrapper).toContain("font-size: var(--goose-code-font-size)");
  expect(pre).toContain("font-size: inherit");
  expect(pre).toContain("line-height: inherit");
  expect(shell).toContain("border: 1px solid var(--goose-block-subtle-border)");
  expect(shell).toContain("overflow: hidden");
  expect(css).toMatch(
    /\.bn-block-outer\[data-goose-code-active-line\]\s*> \.bn-block\s*> \.bn-block-content\s*> \.goose-code-block-node\s*> \.goose-code-content-wrapper::before/,
  );
});

test("lineIndexAtTextOffset 按换行计行", () => {
  expect(lineIndexAtTextOffset("a\nb\nc", 0)).toBe(0);
  expect(lineIndexAtTextOffset("a\nb\nc", 1)).toBe(0);
  expect(lineIndexAtTextOffset("a\nb\nc", 2)).toBe(1);
  expect(lineIndexAtTextOffset("a\nb\nc", 5)).toBe(2);
  expect(lineIndexAtTextOffset("", 0)).toBe(0);
});

test("正文光标所在段落才打 goose-active-line", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "p1", type: "paragraph", content: "第一行" },
      { id: "p2", type: "paragraph", content: "第二行" },
    ],
  });

  setCursorInBlock(editor, "p1");
  const first = resolveActiveLineDecoration(editor.prosemirrorState);
  expect(first?.find().length).toBe(1);
  expect(first?.find()[0]?.type.attrs.class).toBe("goose-active-line");

  setCursorInBlock(editor, "p2");
  const second = resolveActiveLineDecoration(editor.prosemirrorState);
  expect(second?.find().length).toBe(1);
  expect(second?.find()[0]?.from).not.toBe(first?.find()[0]?.from);
});

test("代码块按光标行号打 data-goose-code-active-line", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "p1", type: "paragraph", content: "正文" },
      {
        id: "code",
        type: "codeBlock",
        content: "const a = 1;\nconst b = 2;\nconst c = 3;",
      },
    ],
  });

  setCursorInBlock(editor, "p1");
  expect(resolveCodeBlockActiveLine(editor.prosemirrorState)).toBeNull();

  setCursorInBlock(editor, "code", 0);
  const line1 = resolveCodeBlockActiveLine(editor.prosemirrorState);
  expect(line1?.find()[0]?.type.attrs[CODE_ACTIVE_LINE_ATTR]).toBe("1");

  setCursorInBlock(editor, "code", "const a = 1;\n".length);
  const line2 = resolveCodeBlockActiveLine(editor.prosemirrorState);
  expect(line2?.find()[0]?.type.attrs[CODE_ACTIVE_LINE_ATTR]).toBe("2");
});

test("代码块连续空行和末尾空行保持光标行号", () => {
  const text = "const a = 1;\n\nconst b = 2;\n\n";
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [{ id: "code", type: "codeBlock", content: text }],
  });

  for (let offset = 0; offset <= text.length; offset += 1) {
    setCursorInBlock(editor, "code", offset);
    const decoration = resolveCodeBlockActiveLine(editor.prosemirrorState);
    const line = text.slice(0, offset).split("\n").length;
    expect(decoration?.find()[0]?.type.attrs[CODE_ACTIVE_LINE_ATTR]).toBe(String(line));
  }
});

test("自动换行的代码块不画当前行", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "code",
        type: "codeBlock",
        props: { wrap: true, language: "javascript" },
        content: "const a = 1;\nconst b = 2;",
      },
    ],
  });

  setCursorInBlock(editor, "code");
  expect(resolveCodeBlockActiveLine(editor.prosemirrorState)).toBeNull();
});
