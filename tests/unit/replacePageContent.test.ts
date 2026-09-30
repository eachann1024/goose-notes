import { BlockNoteEditor } from "@blocknote/core";
import { expect, test } from "playwright/test";
import { replacePageContent } from "../../src/components/editor/core/replacePageContent";

test("长文档切页只产生一次替换，保留嵌套与混合块", () => {
  const editor = BlockNoteEditor.create({ initialContent: Array.from({ length: 500 }, (_, i) => ({
    id: `old-${i}`, type: "paragraph" as const, content: `原文 ${i}`,
  })) });
  const blocks = [
    { id: "next", type: "bulletListItem", content: "下一篇", children: [
      { id: "child", type: "checkListItem", props: { checked: true }, content: "已完成" },
    ] },
    { id: "code", type: "codeBlock", content: "const a = 1;" },
  ];
  const tr = replacePageContent(editor.prosemirrorState.tr, blocks);
  expect(tr.steps).toHaveLength(1);
  expect(tr.getMeta("addToHistory")).toBe(false);
  const state = editor.prosemirrorState.apply(tr);
  state.doc.check();
  expect(state.doc.textContent).toBe("下一篇已完成const a = 1;");
  expect(state.doc.firstChild?.firstChild?.attrs.id).toBe("next");
});
