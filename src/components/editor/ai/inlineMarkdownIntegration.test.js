import { expect, test } from "bun:test";
import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "prosemirror-state";
import {
  capturePrivateInlineTarget,
  preparePrivateInlineDraft,
  applyPrivateInlineDraft,
} from "@/lib/notebook-ai/inlineMarkdownApplySelection";
function editor() {
  return BlockNoteEditor.create({
    initialContent: [
      {
        id: "a",
        type: "paragraph",
        content: "private SELECT secret",
        children: [
          { id: "child", type: "paragraph", content: "nested secret" },
        ],
      },
      { id: "b", type: "paragraph", content: "outside block" },
    ],
  });
}
test("real BlockNote core: exact payload, staged list preview and protected boundaries", () => {
  const e = editor();
  e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, 11, 17)));
  const before = e.prosemirrorState.doc;
  const target = capturePrivateInlineTarget(e, "a");
  expect(target.oldMarkdown.trim()).toBe("SELECT");
  expect(target.oldMarkdown).not.toContain("secret");
  const draft = preparePrivateInlineDraft(e, target, "- one\n- two");
  expect(e.prosemirrorState.doc.eq(before)).toBe(true);
  applyPrivateInlineDraft(e, target, draft);
  expect(e.document.map((b) => b.type)).toEqual([
    "paragraph",
    "bulletListItem",
    "bulletListItem",
    "paragraph",
    "paragraph",
  ]);
  expect(e.document[0].content).toEqual([
    { type: "text", text: "private ", styles: {} },
  ]);
  expect(e.document[3].content).toEqual([
    { type: "text", text: " secret", styles: {} },
  ]);
  expect(e.document[3].children[0].id).toBe("child");
  expect(e.document[4].id).toBe("b");
});
test("real core: cursor payload excludes descendants and other blocks", () => {
  const e = editor();
  const target = capturePrivateInlineTarget(e, "a");
  expect(target.oldMarkdown.trim()).toBe("private SELECT secret");
  expect(target.oldMarkdown).not.toContain("nested");
  expect(target.oldMarkdown).not.toContain("outside");
});
test("real core: changed/deleted target fails without modifying other content", () => {
  const e = editor();
  const target = capturePrivateInlineTarget(e, "a");
  const draft = preparePrivateInlineDraft(e, target, "rewrite");
  e.removeBlocks(["a"]);
  const changed = e.prosemirrorState.doc;
  expect(() => applyPrivateInlineDraft(e, target, draft)).toThrow("原文已变化");
  expect(e.prosemirrorState.doc.eq(changed)).toBe(true);
});

test("real core extension registers a store and freezes selection before menu focus", async () => {
  const { GooseAIExtension } = await import("./GooseAIExtension");
  const e = BlockNoteEditor.create({
    initialContent: [
      { id: "a", type: "paragraph", content: "private SELECT secret" },
    ],
    extensions: [
      GooseAIExtension({
        getScope: () => ({
          pageId: "page",
          editable: true,
          protectFirstTitle: false,
        }),
        getSettings: () => ({
          enabled: true,
          selectedModelId: null,
          customModelOptions: [],
        }),
      }),
    ],
  });
  e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, 11, 17)));
  const ai = e.getExtension(GooseAIExtension);
  ai.openAIMenuAtBlock("a");
  expect(ai.store.state.aiMenuState.status).toBe("user-input");
  await ai.submit("polish");
  expect(ai.store.state.aiMenuState.status).toBe("error");
  expect(String(ai.store.state.aiMenuState.error)).toContain("选择模型");
  expect(e.document[0].content[0].text).toBe("private SELECT secret");
  ai.closeAIMenu();
  expect(ai.store.state.aiMenuState).toBe("closed");
});

test("real core: table text is explicitly rejected before a menu request", () => {
  const e = BlockNoteEditor.create({ initialContent: [{
    id: "table", type: "table", content: {
      type: "tableContent", rows: [{ cells: ["table text"] }],
    },
  }] });
  let range;
  e.prosemirrorState.doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent === "table text") {
      range = { from: pos + 1, to: pos + 1 + node.content.size };
    }
  });
  expect(range).toBeDefined();
  e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, range.from, range.to)));
  expect(() => capturePrivateInlineTarget(e, "table")).toThrow("表格或非文字块");
});
