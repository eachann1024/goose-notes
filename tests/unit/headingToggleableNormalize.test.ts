import { expect, test } from "playwright/test";
import {
  normalizeBlockContent,
  normalizeHeadingSectionFold,
  normalizePageContent,
} from "../../src/components/editor/utils/blocknote-content";

test("normalizeHeadingSectionFold 拍平 heading children 为后续兄弟", () => {
  const normalized = normalizeHeadingSectionFold([
    {
      type: "heading",
      props: { level: 2, isToggleable: true },
      content: "章节",
      children: [{ type: "paragraph", content: "正文" }],
    },
  ]);
  expect(normalized).toHaveLength(2);
  expect(normalized[0]?.type).toBe("heading");
  expect(normalized[0]?.children).toBeUndefined();
  expect(normalized[0]?.props?.isToggleable).toBeUndefined();
  expect(normalized[0]?.props?.collapsed).toBe(false);
  expect(normalized[1]?.type).toBe("paragraph");
  expect(normalized[1]?.content).toBe("正文");
});

test("normalizeHeadingSectionFold toggleListItem 转 bulletListItem", () => {
  const normalized = normalizeHeadingSectionFold([
    {
      type: "toggleListItem",
      content: "折叠项",
      children: [{ type: "paragraph", content: "子内容" }],
    },
  ]);
  expect(normalized[0]?.type).toBe("bulletListItem");
  expect(normalized[0]?.children).toHaveLength(1);
});

test("normalizePageContent 首块 H1 拍平 children 且不可折", () => {
  const normalized = normalizePageContent([
    {
      type: "heading",
      props: { level: 1, isToggleable: true },
      content: "标题",
      children: [{ type: "paragraph", content: "误入标题" }],
    },
    {
      type: "heading",
      props: { level: 2 },
      content: "章节",
      children: [{ type: "paragraph", content: "保留" }],
    },
  ]);
  expect(normalized[0]?.props?.isToggleable).toBeUndefined();
  expect(normalized[0]?.props?.collapsed).toBe(false);
  expect(normalized[0]?.children).toBeUndefined();
  expect(normalized.some((b) => b.content === "误入标题")).toBe(true);
  const section = normalized.find(
    (b) => b.type === "heading" && b.content === "章节",
  );
  expect(section?.props?.isToggleable).toBeUndefined();
  expect(section?.props?.collapsed).toBe(false);
  expect(section?.children).toBeUndefined();
  expect(normalized.some((b) => b.content === "保留")).toBe(true);
});

test("local-folder 路径 preserveStructure 仍拍平非首块 heading children", () => {
  const normalized = normalizePageContent(
    [
      { type: "paragraph", content: "首段" },
      {
        type: "heading",
        props: { level: 2 },
        content: "章节",
        children: [{ type: "paragraph", content: "正文" }],
      },
    ],
    { ensureFirstTitle: false },
  );
  expect(normalized[0]?.type).toBe("paragraph");
  expect(normalized[1]?.type).toBe("heading");
  expect(normalized[2]?.type).toBe("paragraph");
  expect(normalized[1]?.children).toBeUndefined();
});

test("normalizeBlockContent 仍保留非 heading 块的 children", () => {
  const normalized = normalizeBlockContent([
    {
      type: "bulletListItem",
      content: "项",
      children: [{ type: "paragraph", content: "嵌套" }],
    },
  ]);
  expect(normalized[0]?.children).toHaveLength(1);
});
