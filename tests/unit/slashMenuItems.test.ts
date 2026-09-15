import { expect, test } from "playwright/test";
import {
  COMPACT_SLASH_MENU_TITLES,
  filterCompactSlashMenuItems,
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

test("小窗斜杠菜单只留常用输入块，不含 AI 和重型块", () => {
  expect(COMPACT_SLASH_MENU_TITLES.has("一级标题")).toBe(true);
  expect(COMPACT_SLASH_MENU_TITLES.has("图片")).toBe(true);
  expect(COMPACT_SLASH_MENU_TITLES.has("生成")).toBe(false);
  expect(COMPACT_SLASH_MENU_TITLES.has("表格")).toBe(false);
  expect(COMPACT_SLASH_MENU_TITLES.has("数学公式")).toBe(false);
  expect(COMPACT_SLASH_MENU_TITLES.has("Mermaid 图表")).toBe(false);
  expect(COMPACT_SLASH_MENU_TITLES.has("视频")).toBe(false);
  expect(COMPACT_SLASH_MENU_TITLES.has("文件")).toBe(false);
  expect(COMPACT_SLASH_MENU_TITLES.has("三级标题")).toBe(false);

  const filtered = filterCompactSlashMenuItems([
    { title: "一级标题", onItemClick: () => {} },
    { type: "divider" } as never,
    { title: "表格", onItemClick: () => {} },
    { title: "生成", onItemClick: () => {} },
    { title: "图片", onItemClick: () => {} },
  ]);
  expect(filtered.map((it) => it.title)).toEqual(["一级标题", "图片"]);
});
