import { expect, test } from "playwright/test";
import {
  collectUniformInlineColorStyles,
  inheritPresentationFromSource,
} from "../../src/lib/notebook-ai/inheritPresentation";

test("1:1 标题改写保留居中、块级背景和行内字色", () => {
  const source = [
    {
      type: "heading",
      props: { level: 2, textAlignment: "center", backgroundColor: "orange" },
      content: [
        { type: "text", text: "第二周", styles: { textColor: "orange" } },
      ],
    },
  ];
  const replacement = [
    {
      type: "heading",
      props: { level: 2 },
      content: "第二周 9.7 - 9.11",
    },
  ];

  const next = inheritPresentationFromSource(source, replacement) as Array<{
    props?: Record<string, unknown>;
    content?: Array<{ text?: string; styles?: Record<string, unknown> }>;
  }>;

  expect(next[0]?.props?.textAlignment).toBe("center");
  expect(next[0]?.props?.backgroundColor).toBe("orange");
  expect(next[0]?.content?.[0]?.text).toBe("第二周 9.7 - 9.11");
  expect(next[0]?.content?.[0]?.styles?.textColor).toBe("orange");
});

test("替换块已有样式时不覆盖", () => {
  const source = [
    {
      type: "heading",
      props: { textAlignment: "center", backgroundColor: "orange" },
      content: "旧",
    },
  ];
  const replacement = [
    {
      type: "heading",
      props: { textAlignment: "right", backgroundColor: "blue" },
      content: [{ type: "text", text: "新", styles: { textColor: "red" } }],
    },
  ];

  const next = inheritPresentationFromSource(source, replacement) as Array<{
    props?: Record<string, unknown>;
    content?: Array<{ styles?: Record<string, unknown> }>;
  }>;

  expect(next[0]?.props?.textAlignment).toBe("right");
  expect(next[0]?.props?.backgroundColor).toBe("blue");
  expect(next[0]?.content?.[0]?.styles?.textColor).toBe("red");
});

test("一对多时把源块样式铺到每个替换块", () => {
  const source = [
    {
      type: "paragraph",
      props: { textAlignment: "center", backgroundColor: "yellow" },
      content: "原段",
    },
  ];
  const replacement = [
    { type: "bulletListItem", content: "a" },
    { type: "bulletListItem", content: "b" },
  ];

  const next = inheritPresentationFromSource(source, replacement) as Array<{
    props?: Record<string, unknown>;
  }>;

  expect(next.map((block) => block.props?.textAlignment)).toEqual([
    "center",
    "center",
  ]);
  expect(next.map((block) => block.props?.backgroundColor)).toEqual([
    "yellow",
    "yellow",
  ]);
});

test("局部高亮不是整段统一颜色，不往新文本上抹", () => {
  expect(
    collectUniformInlineColorStyles([
      { type: "text", text: "彩", styles: { textColor: "red" } },
      { type: "text", text: "色", styles: {} },
    ]),
  ).toBeNull();
});
