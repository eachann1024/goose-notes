import { expect, test } from "playwright/test";
import {
  captureFoldSnapshot,
  collectSectionBlockIds,
  getSectionInsertAnchorId,
  isFoldableHeadingBlock,
  collectAllHiddenSectionBlockIds,
  updateFoldSnapshots,
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

test("getSectionInsertAnchorId：有后续内容返回 section 最后一块", () => {
  expect(getSectionInsertAnchorId(doc, "h2a")).toBe("para");
});

test("getSectionInsertAnchorId：无后续内容返回 heading 自身", () => {
  const lone: SectionFoldBlock[] = [
    { id: "title", type: "heading", props: { level: 1 } },
    { id: "h2", type: "heading", props: { level: 2, collapsed: true } },
  ];
  expect(getSectionInsertAnchorId(lone, "h2")).toBe("h2");
});

test("getSectionInsertAnchorId：遇同级 heading 停，不越过 section 边界", () => {
  expect(getSectionInsertAnchorId(doc, "h2b")).toBe("tail");
  expect(getSectionInsertAnchorId(doc, "h2a")).not.toBe("tail");
});

test("captureFoldSnapshot 与 collectSectionBlockIds 结果一致", () => {
  expect(captureFoldSnapshot(doc, "h2a")).toEqual(
    collectSectionBlockIds(doc, "h2a"),
  );
});

test("updateFoldSnapshots：折叠期间新插入的块不进入 snapshot", () => {
  const initial = updateFoldSnapshots(new Map(), null, doc, "title");
  expect(initial.get("h2a")).toEqual(["table", "para"]);

  // 折叠期间在 section 尾部追加新块
  const grown: SectionFoldBlock[] = [
    ...doc.slice(0, 4),
    { id: "fresh", type: "paragraph" },
    ...doc.slice(4),
  ];
  const kept = updateFoldSnapshots(initial, doc, grown, "title");
  expect(kept.get("h2a")).toEqual(["table", "para"]);
});

test("updateFoldSnapshots：展开再折叠会重新 capture 并包含新块", () => {
  const initial = updateFoldSnapshots(new Map(), null, doc, "title");

  const grown: SectionFoldBlock[] = [
    ...doc.slice(0, 4),
    { id: "fresh", type: "paragraph" },
    ...doc.slice(4),
  ];
  // 展开
  const expanded: SectionFoldBlock[] = grown.map((block) =>
    block.id === "h2a"
      ? { ...block, props: { ...block.props, collapsed: false } }
      : block,
  );
  const afterExpand = updateFoldSnapshots(initial, grown, expanded, "title");
  expect(afterExpand.has("h2a")).toBe(false);

  // 再次折叠
  const afterReCollapse = updateFoldSnapshots(afterExpand, expanded, grown, "title");
  expect(afterReCollapse.get("h2a")).toEqual(["table", "para", "fresh"]);
});

test("updateFoldSnapshots：剔除已删除的 id，heading 被删则丢 snapshot", () => {
  const initial = updateFoldSnapshots(new Map(), null, doc, "title");

  const shrunk = doc.filter((block) => block.id !== "table");
  const pruned = updateFoldSnapshots(initial, doc, shrunk, "title");
  expect(pruned.get("h2a")).toEqual(["para"]);

  const withoutHeading = doc.filter((block) => block.id !== "h2a");
  const dropped = updateFoldSnapshots(initial, doc, withoutHeading, "title");
  expect(dropped.has("h2a")).toBe(false);
});
