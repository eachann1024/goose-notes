import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("侧栏底栏不再画顶部分隔线和描边卡片", () => {
  const footer = readFileSync(
    "src/pages/workspace/components/sidebar/SidebarFooter.tsx",
    "utf8",
  );
  expect(footer).toContain("<NotebookSwitcher {...props}");
  expect(footer).not.toContain("border-t");
  expect(footer).not.toContain("rounded-xl");
  expect(footer).not.toContain("pb-2");
});

test("笔记本切换是左右停靠：名称在左，右侧切换钮", () => {
  const switcher = readFileSync(
    "src/pages/workspace/components/sidebar/NotebookSwitcher.tsx",
    "utf8",
  );
  expect(switcher).toContain("ChevronsUpDown");
  expect(switcher).toContain("rounded-lg");
  expect(switcher).toContain("h-7 w-7");
  expect(switcher).not.toContain("ChevronDown");
});
