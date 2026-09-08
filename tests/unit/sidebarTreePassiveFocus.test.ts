import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";

test("自动侧栏定位只更新树状态，不夺取编辑器 DOM 焦点", () => {
  const source = readFileSync(
    "src/pages/workspace/components/sidebar/main-tree/SidebarMainTree.tsx",
    "utf8",
  );

  expect(source).toContain("focusItem(expandPageId, false)");
  expect(source).toContain("focusItem(activePageId, false)");
});
