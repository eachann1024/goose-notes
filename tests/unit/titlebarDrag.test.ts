import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("桌面端顶栏标题闲置可拖、单击才编辑", () => {
  const titleBar = readFileSync(
    new URL(
      "../../src/pages/workspace/components/page/DesktopTitleBar.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const title = readFileSync(
    new URL(
      "../../src/pages/workspace/components/page/SingleTabTitle.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(titleBar).toContain("electron-titlebar");
  expect(titleBar).not.toContain("pl-[78px]");
  expect(titleBar).toContain("idleWindowDrag");
  expect(title).toContain("idleWindowDrag");
  expect(title).toContain("startWindowDragging");
  expect(title).toContain("data-electron-no-drag");
  expect(title).toContain("TITLE_SIZE_FILL");
  expect(title).toContain("data-page-title-field");
  expect(title).not.toContain("TITLE_SIZE_HUG");
  expect(title).not.toContain("titleFieldWidth");
  expect(title).not.toContain("min-w-48");
  expect(title).toContain("inline-flex");
  expect(title).toContain("items-center");
  expect(title).toContain("leading-8");
  expect(titleBar).toContain("min-w-0 flex-1 items-center");
  expect(titleBar).toContain("min-w-0 flex-1");
  expect(titleBar).not.toContain("min-w-[12px]");
  expect(titleBar).not.toContain("h-11");
  expect(titleBar).toContain("PageIconButton");
  expect(titleBar).toContain("canCustomizePageIcon");
  expect(titleBar).toContain("data-electron-no-drag");
  expect(titleBar).not.toContain("LucideIcons.Pin");
  expect(titleBar).not.toContain("置顶页面");
  expect(titleBar).not.toContain("LucideIcons.Star");
  expect(titleBar).not.toContain("收藏页面");
  expect(titleBar).not.toContain("LucideIcons.Download");
  expect(titleBar).not.toContain('aria-label="导出"');
  expect(titleBar).not.toContain("LucideIcons.History");
  expect(titleBar).not.toContain('aria-label="页面历史"');
});

test("桌面端顶栏标题左缘跟随侧栏，对齐主栏", () => {
  const css = readFileSync(
    new URL("../../src/pages/workspace/styles/index.css", import.meta.url),
    "utf8",
  );
  expect(css).toContain("--workspace-sidebar-width");
  expect(css).toContain("--electron-traffic-inset");
  expect(css).toContain("--electron-titlebar-height");
  expect(css).toContain("padding-left: max(");
  expect(css).toContain("[data-page-title-field]");
  expect(css).toContain("width: 100%");

  const sidebar = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/Sidebar.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(sidebar).toContain("--workspace-sidebar-width");
});
