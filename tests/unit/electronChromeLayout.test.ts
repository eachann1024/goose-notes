import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("Electron 窗口置顶在侧栏左下角，不在顶栏", () => {
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
  expect(footer).toContain("useWindowAlwaysOnTop");
  expect(footer).toContain("窗口置顶");
  expect(footer).toContain("LucideIcons.Pin");
  expect(footer.indexOf("LucideIcons.Pin")).toBeLessThan(
    footer.indexOf("LucideIcons.PanelLeft"),
  );
  expect(titleBar).not.toContain("LucideIcons.Pin");
  expect(titleBar).not.toContain("useWindowAlwaysOnTop");
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
  expect(switcher).toContain("w-[var(--goose-popover-trigger-width)]");
  expect(readFileSync("src/components/ui/popover.tsx", "utf8")).toMatch(
    /style\.setProperty\(\s*"--goose-popover-trigger-width",\s*`\$\{rects\.reference\.width\}px`/,
  );
  expect(switcher).toContain("min-w-[13.75rem]");
  expect(switcher).toContain("minWidth: 220");
  expect(switcher).not.toContain("min-w-[var(--goose-popover-trigger-width)]");
});
