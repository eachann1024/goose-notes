import { expect, test } from "playwright/test";
import {
  normalizeBlockContent,
  normalizeHeadingToggleableFlags,
  normalizePageContent,
} from "../../src/components/editor/utils/blocknote-content";

test("normalize 保留普通 heading 的 children", () => {
  const normalized = normalizeBlockContent([
    {
      type: "heading",
      props: { level: 2 },
      content: "章节",
      children: [{ type: "paragraph", content: "正文" }],
    },
  ]);
  expect(normalized).toHaveLength(1);
  expect(normalized[0]?.type).toBe("heading");
  expect(normalized[0]?.children).toHaveLength(1);
  expect(normalized[0]?.children?.[0]?.type).toBe("paragraph");
});

test("normalizeHeadingToggleableFlags 非首块 heading 设 isToggleable true", () => {
  const normalized = normalizeHeadingToggleableFlags([
    {
      type: "heading",
      props: { level: 1 },
      content: "标题",
    },
    {
      type: "heading",
      props: { level: 2 },
      content: "章节",
      children: [{ type: "paragraph", content: "正文" }],
    },
  ]);
  expect(normalized[0]?.props?.isToggleable).toBe(false);
  expect(normalized[1]?.props?.isToggleable).toBe(true);
  expect(normalized[1]?.children).toHaveLength(1);
});

test("normalizePageContent 首块 H1 拍平 children 且 isToggleable 为 false", () => {
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
  expect(normalized[0]?.props?.isToggleable).toBe(false);
  expect(normalized[0]?.children).toBeUndefined();
  expect(normalized.some((b) => b.content === "误入标题")).toBe(true);
  expect(
    normalized.find((b) => b.type === "heading" && b.content === "章节")
      ?.props?.isToggleable,
  ).toBe(true);
  expect(
    normalized.find((b) => b.type === "heading" && b.content === "章节")
      ?.children,
  ).toHaveLength(1);
});

test("local-folder 路径 preserveStructure 仍规范非首块 isToggleable", () => {
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
  expect(normalized[1]?.props?.isToggleable).toBe(true);
  expect(normalized[1]?.children).toHaveLength(1);
});
