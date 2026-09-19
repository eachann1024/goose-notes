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


test("Electron chrome：不挂全宽底栏", () => {
  const layout = readFileSync(
    "src/pages/workspace/WorkspaceLayout.tsx",
    "utf8",
  );
  expect(layout).toContain("<DesktopTitleBar");
  expect(layout).not.toContain("DesktopStatusBar");
});

test("Win：工作区无边框 + 顶栏右侧窗控", () => {
  const windows = readFileSync("electron/main/windows.ts", "utf8");
  const titleBar = readFileSync(
    "src/pages/workspace/components/page/DesktopTitleBar.tsx",
    "utf8",
  );
  const controls = readFileSync(
    "src/pages/workspace/components/page/WinWindowControls.tsx",
    "utf8",
  );
  expect(windows).toMatch(/frame:\s*isMac/);
  expect(titleBar).toContain("WinWindowControls");
  expect(controls).toContain("minimizeWindow");
  expect(controls).toContain("toggleMaximizeWindow");
  expect(controls).toContain("closeWindow");
  expect(readFileSync("electron/main/ipc.ts", "utf8")).toContain(
    "desktop:minimizeWindow",
  );
});


test("Electron chrome：工作区窗启用系统材质", () => {
  const windows = readFileSync("electron/main/windows.ts", "utf8");
  const material = readFileSync("electron/main/systemMaterial.ts", "utf8");
  expect(windows).toContain("applySystemMaterial");
  expect(windows).toContain("workspaceWindowMaterialOptions");
  expect(material).toContain('setBackgroundMaterial("mica")');
  expect(material).toContain('setVibrancy("under-window")');
  expect(
    readFileSync("src/pages/workspace/styles/index.css", "utf8"),
  ).toContain("系统材质：壳层");
});
