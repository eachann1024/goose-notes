import { expect, test } from "playwright/test";
import {
  collectSectionBlockIds,
  isFoldableHeadingBlock,
  collectAllHiddenSectionBlockIds,
  type SectionFoldBlock,
} from "../../src/components/editor/core/headingSectionFold";

const doc: SectionFoldBlock[] = [
  { id: "title", type: "heading", props: { level: 1 } },
  {
    id: "h2a",
    type: "heading",
    props: { level: 2, collapsed: true },
  },
  { id: "table", type: "table" },
  { id: "para", type: "paragraph" },
  { id: "h2b", type: "heading", props: { level: 2 } },
  { id: "tail", type: "paragraph" },
];

test("isFoldableHeadingBlock 排除文档首块", () => {
  expect(isFoldableHeadingBlock({ id: "title", type: "heading" }, "title")).toBe(
    false,
  );
  expect(isFoldableHeadingBlock({ id: "h2a", type: "heading" }, "title")).toBe(
    true,
  );
});

test("collectSectionBlockIds：折 H2 只藏 table 与 para，不含下一个 H2", () => {
  expect(collectSectionBlockIds(doc, "h2a")).toEqual(["table", "para"]);
});

test("collectSectionBlockIds：H1 收起会藏后续 H2 与内容", () => {
  const withH1Collapsed: SectionFoldBlock[] = [
    { id: "title", type: "heading", props: { level: 1, collapsed: true } },
    { id: "h2", type: "heading", props: { level: 2 } },
    { id: "table", type: "table" },
  ];
  expect(collectSectionBlockIds(withH1Collapsed, "title")).toEqual([
    "h2",
    "table",
  ]);
  expect(
    isFoldableHeadingBlock(withH1Collapsed[0], withH1Collapsed[0].id),
  ).toBe(false);
});

test("collectAllHiddenSectionBlockIds 汇总 collapsed heading 的 section", () => {
  const hidden = collectAllHiddenSectionBlockIds(doc, "title");
  expect([...hidden]).toEqual(["table", "para"]);
});

test("collapsed 为字符串 true 时也要收起后续块", () => {
  const hidden = collectAllHiddenSectionBlockIds(
    [
      { id: "title", type: "heading", props: { level: 1 } },
      { id: "h2", type: "heading", props: { level: 2, collapsed: "true" } },
      { id: "table", type: "table" },
      { id: "h2b", type: "heading", props: { level: 2 } },
    ],
    "title",
  );
  expect([...hidden]).toEqual(["table"]);
});

test("收起标题时连残留 children 一起藏", () => {
  const hidden = collectAllHiddenSectionBlockIds(
    [
      { id: "title", type: "heading", props: { level: 1 } },
      {
        id: "h2",
        type: "heading",
        props: { level: 2, collapsed: true },
        children: [{ id: "nested", type: "paragraph" }],
      },
      { id: "table", type: "table" },
      { id: "h2b", type: "heading", props: { level: 2 } },
    ],
    "title",
  );
  expect([...hidden].sort()).toEqual(["nested", "table"]);
});
