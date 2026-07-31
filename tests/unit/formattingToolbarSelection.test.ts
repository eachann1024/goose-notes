import { BlockNoteEditor } from "@blocknote/core";
import { AllSelection, NodeSelection } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import { shouldRenderFormattingToolbar } from "../../src/components/editor/toolbars/formatting/helpers";

function createEditor(content: Array<Record<string, unknown>>) {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: content as any,
  });
}

function findNodePosition(editor: ReturnType<typeof createEditor>, type: string) {
  let result: number | null = null;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name === type) {
      result = pos;
      return false;
    }
    return result === null;
  });
  if (result === null) throw new Error(`Missing ${type} node`);
  return result;
}

test("整块选中代码块时不触发格式工具栏", () => {
  const editor = createEditor([
    { id: "code", type: "codeBlock", content: "const answer = 42;" },
  ]);
  const codeBlockPos = findNodePosition(editor, "codeBlock");

  editor.transact((tr) => {
    tr.setSelection(NodeSelection.create(tr.doc, codeBlockPos));
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(false);
});

test("仅有代码块的文档全选时不触发格式工具栏", () => {
  const editor = createEditor([
    { id: "code", type: "codeBlock", content: "const answer = 42;" },
  ]);

  editor.transact((tr) => {
    tr.setSelection(new AllSelection(tr.doc));
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(false);
});

test("代码块与普通正文混合选中时仍允许格式工具栏", () => {
  const editor = createEditor([
    { id: "code", type: "codeBlock", content: "const answer = 42;" },
    { id: "body", type: "paragraph", content: "普通正文" },
  ]);

  editor.transact((tr) => {
    tr.setSelection(new AllSelection(tr.doc));
  });

  expect(shouldRenderFormattingToolbar(editor)).toBe(true);
});
