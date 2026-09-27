import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("页面置顶入口已移除，笔记本切换在底栏并向上展开", () => {
  const sidebar = readFileSync("src/pages/workspace/components/sidebar/Sidebar.tsx", "utf8");
  const footer = readFileSync("src/pages/workspace/components/sidebar/SidebarFooter.tsx", "utf8");
  const switcher = readFileSync("src/pages/workspace/components/sidebar/NotebookSwitcher.tsx", "utf8");
  expect(sidebar).not.toMatch(/FavoritesSection|SidebarHeader/);
  expect(footer).toContain("<NotebookSwitcher");
  expect(switcher).toContain('side="top"');
  expect(switcher).not.toMatch(/aria-label="置顶页面"|置顶页面/);
});
