import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("设置页关闭钮默认灰底，hover 换成强调色", () => {
  const source = readFileSync(
    "src/pages/workspace/components/sidebar/settings/SettingsScaffold.tsx",
    "utf8",
  );
  const closeButton = source.slice(
    source.indexOf('aria-label="关闭"') - 480,
    source.indexOf('aria-label="关闭"') + 40,
  );
  expect(closeButton).toContain("bg-[hsl(var(--goose-selected-bg))]");
  expect(closeButton).toContain(
    "hover:bg-[var(--goose-icon-chip-on-selected)]",
  );
});

test("设置顶栏与主界面共用 electron-titlebar 高度，不再单独加高", () => {
  const scaffold = readFileSync(
    "src/pages/workspace/components/sidebar/settings/SettingsScaffold.tsx",
    "utf8",
  );
  const css = readFileSync("src/pages/workspace/styles/index.css", "utf8");
  expect(scaffold).toContain("electron-titlebar flex w-full items-center");
  expect(css).toContain(
    "height: var(--electron-titlebar-height, 2.75rem)",
  );
  expect(css).not.toContain("[data-settings-header]");
  expect(css).not.toContain("+ 0.5rem");
});

test("设置内容区贴齐顶栏，与编辑器 electron chrome 一样去掉上内边距", () => {
  const scaffold = readFileSync(
    "src/pages/workspace/components/sidebar/settings/SettingsScaffold.tsx",
    "utf8",
  );
  const css = readFileSync("src/pages/workspace/styles/index.css", "utf8");
  expect(scaffold).toContain('data-settings=""');
  expect(scaffold).not.toMatch(/workspace-stage[^"]*\bp-3\b/);
  expect(css).toContain(".workspace-shell[data-settings] .workspace-stage");
  expect(css).toContain("padding-top: 0");
});
