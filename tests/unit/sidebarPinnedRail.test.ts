import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("置顶图标轨道是贴合卡片，不再拉满浅色胶囊", () => {
  const header = readFileSync(
    "src/pages/workspace/components/sidebar/SidebarHeader.tsx",
    "utf8",
  );

  expect(header).toContain('aria-label="置顶页面"');
  expect(header).toContain("inline-flex max-w-full");
  expect(header).toContain(
    "rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--goose-editor-bg))]",
  );
  expect(header).toContain(
    "shadow-[inset_0_0_0_1px_var(--goose-interactive-selected-fg)]",
  );
  expect(header).toContain("h-8 w-8 shrink-0 scroll-mx-1 rounded-lg");
  expect(header).toContain("bg-[hsl(var(--goose-editor-bg))]");

  expect(header).not.toContain(
    "absolute inset-0 rounded-full bg-[var(--goose-interactive-hover)]",
  );
  expect(header).not.toContain(
    "pointer-events-none absolute left-0 top-0 rounded-full",
  );
  expect(header).not.toContain(
    "relative z-[1] h-8 w-8 shrink-0 scroll-mx-1 rounded-full",
  );
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
