import { expect, test } from "playwright/test";
import { markdownToJsonContent } from "../../src/lib/export/markdown/parse/block";
import { jsonContentToMarkdown } from "../../src/lib/export/markdown/serialize";
import { importFromMarkdown } from "../../src/lib/export";
import { normalizePageContent } from "../../src/components/editor/utils/blocknote-content";
import { isThematicBreakLine } from "../../src/lib/export/markdown/parse/blockHelpers";
import { explodeAiGeneratedBlocks } from "../../src/lib/ai-write/explodeAiGeneratedBlocks";

test("isThematicBreakLine 识别 CommonMark 水平线", () => {
  expect(isThematicBreakLine("---")).toBe(true);
  expect(isThematicBreakLine("***")).toBe(true);
  expect(isThematicBreakLine("___")).toBe(true);
  expect(isThematicBreakLine("- - -")).toBe(true);
  expect(isThematicBreakLine("  ---")).toBe(true);
  expect(isThematicBreakLine("----")).toBe(true);
  expect(isThematicBreakLine("--")).toBe(false);
  expect(isThematicBreakLine("- --")).toBe(true);
  expect(isThematicBreakLine("    ---")).toBe(false);
  expect(isThematicBreakLine("- item")).toBe(false);
  expect(isThematicBreakLine("***---")).toBe(false);
});

test("外部 markdown 的 --- 解析为 divider，而不是字面量段落", () => {
  const parsed = markdownToJsonContent("上一段\n\n---\n\n下一段");
  expect(parsed.map((block: { type?: string }) => block.type)).toEqual([
    "paragraph",
    "divider",
    "paragraph",
  ]);
  expect(parsed[1]).toEqual({ type: "divider" });
});

test("*** / ___ 以及夹空格的水平线也落成 divider", () => {
  const parsed = markdownToJsonContent("甲\n\n***\n\n乙\n\n- - -\n\n丙\n\n___\n\n丁");
  expect(parsed.map((block: { type?: string }) => block.type)).toEqual([
    "paragraph",
    "divider",
    "paragraph",
    "divider",
    "paragraph",
    "divider",
    "paragraph",
  ]);
});

test("文件头 --- 仍是 yaml-frontmatter，正文 --- 才是分割线", () => {
  const parsed = markdownToJsonContent(
    ["---", "title: 笔记", "---", "", "前言", "", "---", "", "后记"].join("\n"),
  );
  expect(parsed[0]).toMatchObject({
    type: "codeBlock",
    props: { language: "yaml-frontmatter" },
  });
  expect(parsed.map((block: { type?: string }) => block.type)).toEqual([
    "codeBlock",
    "paragraph",
    "divider",
    "paragraph",
  ]);
});

test("setext 标题下划线不会被当成分割线", () => {
  const parsed = markdownToJsonContent("章节标题\n---\n\n正文");
  expect(parsed[0]).toMatchObject({
    type: "heading",
    props: { level: 2 },
  });
  expect(parsed.map((block: { type?: string }) => block.type)).toEqual([
    "heading",
    "paragraph",
  ]);
});

test("导入后 normalize 保留 divider，序列化仍写回 ---", () => {
  const imported = importFromMarkdown("上一段\n\n---\n\n下一段", "笔记", {
    preserveStructure: true,
  });
  expect(imported.success).toBe(true);
  expect(imported.content.map((block) => block.type)).toEqual([
    "paragraph",
    "divider",
    "paragraph",
  ]);

  const markdown = jsonContentToMarkdown(imported.content as any);
  expect(markdown).toBe("上一段\n\n---\n\n下一段");

  const roundTrip = markdownToJsonContent(markdown);
  expect(roundTrip.map((block: { type?: string }) => block.type)).toEqual([
    "paragraph",
    "divider",
    "paragraph",
  ]);
});

test("旧 horizontalRule 节点 normalize 成 divider", () => {
  const normalized = normalizePageContent(
    {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "上" }] },
        { type: "horizontalRule" },
        { type: "paragraph", content: [{ type: "text", text: "下" }] },
      ],
    } as any,
    { ensureFirstTitle: false },
  );
  expect(normalized.map((block) => block.type)).toEqual([
    "paragraph",
    "divider",
    "paragraph",
  ]);
});

test("AI 拆块不会把 divider 打成空段落", () => {
  const exploded = explodeAiGeneratedBlocks([
    { type: "paragraph", content: "上一段" },
    { type: "divider" },
    { type: "paragraph", content: "下一段" },
  ]);
  expect(exploded.map((block) => block.type)).toEqual([
    "paragraph",
    "divider",
    "paragraph",
  ]);
});
