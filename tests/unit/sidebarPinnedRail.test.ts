import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("置顶图标轨道是 utools 浅色圆胶囊", () => {
  const header = readFileSync(
    "src/pages/workspace/components/sidebar/SidebarHeader.tsx",
    "utf8",
  );

  expect(header).toContain('aria-label="置顶页面"');
  expect(header).toContain("<NotebookSwitcher />");
  expect(header).toContain("rounded-full bg-[hsl(var(--goose-shell-bg))]");
  expect(header).toContain(
    "pointer-events-none absolute left-0 top-0 rounded-full",
  );
  expect(header).toContain(
    "relative z-[1] h-8 w-8 shrink-0 scroll-mx-1 rounded-full",
  );
  expect(header).toContain("bg-[var(--goose-interactive-selected)] shadow-sm");
});

test("置顶图标点击先即时高亮，不等 activePageId 落定", () => {
  const header = readFileSync(
    "src/pages/workspace/components/sidebar/SidebarHeader.tsx",
    "utf8",
  );

  expect(header).toContain("pendingPinnedSelection");
  expect(header).toContain("setPendingPinnedSelection({");
  expect(header).toContain(
    "pendingPinnedSelection?.pageId ?? storeHighlightedPageId",
  );
});
