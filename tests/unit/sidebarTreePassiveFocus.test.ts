import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";

test("自动侧栏定位使用实际高亮页与容器滚动，不夺取编辑器 DOM 焦点", () => {
  const source = readFileSync(
    "src/pages/workspace/components/sidebar/main-tree/SidebarMainTree.tsx",
    "utf8",
  );

  expect(source).toContain("useSidebarPageReveal({");
  expect(source).toContain("selectedPageId !== undefined ? selectedPageId : activePageId");
  expect(source).toMatch(/useSidebarPageReveal\(\{[\s\S]*?highlightedPageId,/);
  expect(source).not.toContain("focusItem(");
  const reveal = readFileSync(
    "src/pages/workspace/components/sidebar/main-tree/useSidebarPageReveal.ts",
    "utf8",
  );
  expect(reveal).toContain("container.scrollTop += delta");
  expect(reveal).not.toMatch(/\.focus\(|\.scrollIntoView\(/);
});
