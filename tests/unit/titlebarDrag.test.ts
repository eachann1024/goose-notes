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
  const tabRail = readFileSync(
    new URL(
      "../../src/pages/workspace/components/page/TabRail.tsx",
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
  expect(titleBar).toContain('variant="electron-titlebar"');
  expect(tabRail).toContain("idleWindowDrag");
  expect(tabRail).toContain('surface="tab-pill"');
  expect(tabRail).toContain("bindIdleWindowDrag");
  expect(tabRail).toContain("windowDragEnabled");
  expect(tabRail).toContain("data-electron-no-drag");
  expect(title).toContain("idleWindowDrag");
  expect(title).toContain("startWindowDragging");
  expect(title).toContain("endWindowDragging");
  expect(title).toContain("setPointerCapture");
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
  expect(titleBar).not.toContain("PageIconButton");
  expect(titleBar).not.toContain("canCustomizePageIcon");
  expect(titleBar.indexOf("ai-icon-button")).toBeGreaterThan(-1);
  expect(titleBar.indexOf("ai-icon-button")).toBeGreaterThan(
    titleBar.indexOf("<TabRail"),
  );
  expect(titleBar).toContain("data-electron-no-drag");
  expect(titleBar).toContain("LucideIcons.Pin");
  expect(titleBar).not.toContain("置顶页面");
  expect(titleBar).not.toContain("LucideIcons.Star");
  expect(titleBar).not.toContain("收藏页面");
  expect(titleBar).not.toContain("LucideIcons.Download");
  expect(titleBar).not.toContain('aria-label="导出"');
  expect(titleBar).not.toContain("LucideIcons.History");
  expect(titleBar).not.toContain('aria-label="页面历史"');
});

test("多标签 pill 标 no-drag，轨空白保持父级 drag", () => {
  const tabRail = readFileSync(
    new URL(
      "../../src/pages/workspace/components/page/TabRail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(tabRail).toContain('variant === "electron-titlebar"');
  expect(tabRail).toContain("data-electron-no-drag");
  expect(tabRail).toContain("tabRailItemClassName");
  expect(tabRail).not.toContain("max-w-[120px]");
  expect(tabRail).not.toContain("pl-[78px]");
});

test("桌面端顶栏标题左缘跟随侧栏，对齐主栏", () => {
  const css = readFileSync(
    new URL("../../src/pages/workspace/styles/index.css", import.meta.url),
    "utf8",
  );
  expect(css).toContain("--workspace-sidebar-width");
  expect(css).toContain("--workspace-sidebar-motion");
  expect(css).toContain("width var(--workspace-sidebar-motion)");
  expect(css).toContain("--electron-traffic-inset");
  expect(css).toContain("--electron-titlebar-height");
  expect(css).toContain("padding-left: max(");
  expect(css).toContain("[data-page-title-field]");
  expect(css).toContain("width: 100%");
  expect(css).toContain("flex-basis 220ms");
  expect(css).toContain("prefers-reduced-motion");
  expect(css).toContain("window-dragging");
  expect(css).toContain("cursor: grabbing");
  expect(css).not.toContain('[data-tab-active="true"]::after');

  const sidebar = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/Sidebar.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(sidebar).toContain("--workspace-sidebar-width");
  expect(sidebar).toContain("data-sidebar-resizing");
  expect(sidebar).not.toContain("transition-[opacity,transform]");
});

test("单标签拖窗走 start/end IPC，preload 与类型同步", () => {
  const ipc = readFileSync(
    new URL("../../electron/main/ipc.ts", import.meta.url),
    "utf8",
  );
  const preload = readFileSync(
    new URL("../../electron/preload/index.ts", import.meta.url),
    "utf8",
  );
  const types = readFileSync(
    new URL("../../src/vite-env.d.ts", import.meta.url),
    "utf8",
  );
  const windowDrag = readFileSync(
    new URL("../../src/lib/electron/windowDrag.ts", import.meta.url),
    "utf8",
  );
  const windowMove = readFileSync(
    new URL("../../electron/main/windowMove.ts", import.meta.url),
    "utf8",
  );
  expect(ipc).toContain("desktop:startWindowDrag");
  expect(ipc).toContain("desktop:endWindowDrag");
  expect(ipc).toContain("startWindowMove");
  expect(ipc).toContain("endWindowMove");
  expect(preload).toContain("desktop:startWindowDrag");
  expect(preload).toContain("desktop:endWindowDrag");
  expect(preload).toContain("startWindowDrag");
  expect(preload).toContain("endWindowDrag");
  expect(types).toContain("startWindowDrag");
  expect(types).toContain("endWindowDrag");
  expect(windowDrag).toContain("startWindowDrag");
  expect(windowDrag).toContain("endWindowDrag");
  expect(windowDrag).toContain("WINDOW_DRAGGING_CLASS");
  expect(windowDrag).not.toContain("无 startDragging IPC");
  expect(windowMove).toContain("getCursorScreenPoint");
  expect(windowMove).toContain("closed");
  expect(windowMove).toContain("endWindowMove");
});
