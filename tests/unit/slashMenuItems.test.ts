import { expect, test } from "playwright/test";
import {
  filterSlashMenuItems,
  isSlashMenuDivider,
} from "../../src/components/editor/core/blocknoteSlashItems";

test("filterSlashMenuItems 无 query 保留分隔线，有 query 只留匹配项", () => {
  const items = [
    {
      title: "一级标题",
      aliases: ["h1"],
      onItemClick: () => {},
    },
    { type: "divider" } as never,
    {
      title: "代码块",
      aliases: ["code"],
      onItemClick: () => {},
    },
  ];
  const all = filterSlashMenuItems(items, "");
  expect(all).toHaveLength(3);
  expect(isSlashMenuDivider(all[1])).toBe(true);
  expect(filterSlashMenuItems(items, "h1").map((it) => it.title)).toEqual([
    "一级标题",
  ]);
  expect(filterSlashMenuItems(items, "code").map((it) => it.title)).toEqual([
    "代码块",
  ]);
});
