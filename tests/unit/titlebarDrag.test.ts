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
  expect(title).toContain("min-w-full");
  expect(titleBar).toContain("min-w-0 flex-1");
  expect(titleBar).not.toContain("min-w-[12px]");
});

test("桌面端顶栏标题左缘跟随侧栏，对齐主栏", () => {
  const css = readFileSync(
    new URL("../../src/pages/workspace/styles/index.css", import.meta.url),
    "utf8",
  );
  expect(css).toContain("--workspace-sidebar-width");
  expect(css).toContain("--electron-traffic-inset");
  expect(css).toContain("padding-left: max(");

  const sidebar = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/Sidebar.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(sidebar).toContain("--workspace-sidebar-width");
});
