import { BlockNoteEditor } from "@blocknote/core";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  buildSoftWrapInlineFromMarkdown,
  buildSoftWrapPasteInline,
  flattenParsedBlocksToSoftWrapInline,
  htmlHasInlineFormatting,
  insertSoftWrappedInline,
} from "../../src/components/editor/utils/softWrapPaste";

const SAMPLE = `2. **AI Agent**

定时任务管理界面，支持界面可视化的编辑、查看、修改定时任务

**张生**`;

function inlinePlain(block: { content?: unknown }): string {
  const content = block.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const rec = item as { type?: string; text?: unknown };
        if (rec.type === "hardBreak") return "\n";
        return String(rec.text ?? "");
      }
      return "";
    })
    .join("");
}

function inlineNodes(block: { content?: unknown }) {
  const content = block.content;
  if (!Array.isArray(content)) return [];
  return content as Array<Record<string, unknown>>;
}

function hasBold(block: { content?: unknown }, text: string): boolean {
  return inlineNodes(block).some((node) => {
    const nodeText = String(node.text ?? "");
    return (
      (nodeText === text || nodeText.includes(text)) &&
      (node.styles as { bold?: boolean } | undefined)?.bold
    );
  });
}

test("HTML 含 strong/a 才走富文本解析", () => {
  expect(htmlHasInlineFormatting("<p>2. <strong>AI Agent</strong></p>")).toBe(
    true,
  );
  expect(htmlHasInlineFormatting("<p>2. **AI Agent**</p>")).toBe(false);
});

test("标注/引用多行 markdown 保留粗体和换行，不把 2. 吃成列表", () => {
  const items = buildSoftWrapInlineFromMarkdown(SAMPLE);
  expect(items).toEqual([
    "2. ",
    { type: "text", text: "AI Agent", styles: { bold: true } },
    { type: "hardBreak" },
    { type: "hardBreak" },
    "定时任务管理界面，支持界面可视化的编辑、查看、修改定时任务",
    { type: "hardBreak" },
    { type: "hardBreak" },
    { type: "text", text: "张生", styles: { bold: true } },
  ]);
});

test("解析出的 HTML 块压成 soft-wrap inline，保留 marks 与块间换行", () => {
  const items = flattenParsedBlocksToSoftWrapInline([
    {
      type: "paragraph",
      content: [
        "2. ",
        { type: "text", text: "AI Agent", styles: { bold: true } },
      ],
    },
    {
      type: "paragraph",
      content: "定时任务管理界面，支持界面可视化的编辑、查看、修改定时任务",
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "张生", styles: { bold: true } }],
    },
  ]);
  expect(items).toEqual([
    "2. ",
    { type: "text", text: "AI Agent", styles: { bold: true } },
    { type: "hardBreak" },
    "定时任务管理界面，支持界面可视化的编辑、查看、修改定时任务",
    { type: "hardBreak" },
    { type: "text", text: "张生", styles: { bold: true } },
  ]);
});

test("有 HTML 格式时优先用解析块，否则走 markdown", () => {
  const fromHtml = buildSoftWrapPasteInline({
    plainText: SAMPLE,
    parsedHtmlBlocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "AI Agent", styles: { bold: true } }],
      },
    ],
  });
  expect(fromHtml).toEqual([
    { type: "text", text: "AI Agent", styles: { bold: true } },
  ]);

  const fromMarkdown = buildSoftWrapPasteInline({ plainText: SAMPLE });
  expect(fromMarkdown).toEqual(buildSoftWrapInlineFromMarkdown(SAMPLE));
});

test("粘进标注块后仍是 callout，并保留粗体与多行", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
      { id: "hint", type: "callout", content: "" },
    ] as never,
  });
  editor.setTextCursorPosition("hint", "start");
  insertSoftWrappedInline(editor, buildSoftWrapInlineFromMarkdown(SAMPLE));

  const callout = editor.document.find((block) => block.id === "hint")!;
  expect(callout.type).toBe("callout");
  expect(editor.document.filter((block) => block.type === "callout")).toHaveLength(
    1,
  );
  expect(hasBold(callout, "AI Agent")).toBe(true);
  expect(hasBold(callout, "张生")).toBe(true);
  expect(inlinePlain(callout)).toContain("定时任务管理界面");
  expect(inlinePlain(callout)).toContain("\n");
});

test("粘进引用块同样保留粗体与换行", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "title", type: "heading", props: { level: 1 }, content: "标题" },
      { id: "q", type: "quote", content: "" },
    ] as never,
  });
  editor.setTextCursorPosition("q", "start");
  insertSoftWrappedInline(editor, buildSoftWrapInlineFromMarkdown(SAMPLE));

  const quote = editor.document.find((block) => block.id === "q")!;
  expect(quote.type).toBe("quote");
  expect(hasBold(quote, "张生")).toBe(true);
  expect(inlinePlain(quote)).toContain("\n");
});
