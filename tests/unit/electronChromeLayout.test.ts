import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("C 布局：窗口控制在顶栏，仓库入口在底部", () => {
  const footer = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/SidebarFooter.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const titleBar = readFileSync(
    new URL(
      "../../src/pages/workspace/components/page/DesktopTitleBar.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const ipc = readFileSync(
    new URL("../../electron/main/ipc.ts", import.meta.url),
    "utf8",
  );
  expect(footer).toContain("<NotebookSwitcher");
  expect(footer).toContain("sidebar-footer-control");
  expect(footer).not.toContain("useWindowAlwaysOnTop");
  expect(titleBar).toContain("LucideIcons.Pin");
  expect(titleBar).toContain("useWindowAlwaysOnTop");
  expect(titleBar).toContain('sidebarCollapsed ? "展开侧栏" : "收起侧栏"');
  expect(titleBar.match(/\{windowControls\}/g)).toHaveLength(2);
  expect(
    readFileSync(
      "src/pages/workspace/components/sidebar/SidebarHeader.tsx",
      "utf8",
    ),
  ).not.toContain("NotebookSwitcher");
  expect(ipc).toContain("desktop:getAlwaysOnTop");
  expect(ipc).toContain("desktop:setAlwaysOnTop");
});

test("仓库切换菜单宽度跟随触发条", () => {
  const switcher = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/NotebookSwitcher.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(switcher).toContain("w-[calc(var(--goose-popover-trigger-width)+14px)]");
  expect(readFileSync("src/components/ui/popover.tsx", "utf8")).toMatch(
    /style\.setProperty\(\s*"--goose-popover-trigger-width",\s*`\$\{rects\.reference\.width\}px`/,
  );
  expect(switcher).not.toContain("min-w-[13.75rem]");
  expect(switcher).not.toContain("minWidth: 220");
  expect(switcher).toContain('side="top"');
  expect(switcher).toContain('className="goose-notebook-shell"');
  expect(switcher).not.toContain("data-[side=top]:before:-bottom-2");
  expect(switcher).toContain("onOpenSettings()");
  expect(switcher).toContain("onClick={toggleDarkMode}");
  const titleBar = readFileSync(
    "src/pages/workspace/components/page/DesktopTitleBar.tsx",
    "utf8",
  );
  expect(titleBar.indexOf("<PageMenu />")).toBeLessThan(
    titleBar.indexOf("<ThemeIcon"),
  );
  expect(titleBar.indexOf("<ThemeIcon")).toBeLessThan(
    titleBar.indexOf("<LucideIcons.Settings"),
  );
  expect(titleBar).toContain('"goose-note:open-settings"');
  expect(switcher).toContain("!hideTrash &&");
  expect(switcher).not.toContain("min-w-[var(--goose-popover-trigger-width)]");
});


test("Electron chrome：全宽底栏与顶栏对位挂载", () => {
  const layout = readFileSync(
    "src/pages/workspace/WorkspaceLayout.tsx",
    "utf8",
  );
  const statusBar = readFileSync(
    "src/pages/workspace/components/page/DesktopStatusBar.tsx",
    "utf8",
  );
  expect(layout).toContain("DesktopStatusBar");
  expect(layout).toContain("<DesktopTitleBar");
  expect(statusBar).toContain("electron-statusbar");
  expect(statusBar).toContain('aria-label="窗口状态栏"');
  expect(
    readFileSync("src/pages/workspace/styles/index.css", "utf8"),
  ).toContain(".electron-statusbar");
});
