import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("浅色菜单底板跟壳层同色，压过 popover 工具类", () => {
  const indexCss = readFileSync("src/index.css", "utf8");
  expect(indexCss).toContain("--goose-menu-surface: var(--goose-shell-bg)");
  expect(indexCss).toMatch(
    /\[role="menu"\]\s*\{\s*background-color:\s*hsl\(var\(--goose-menu-surface\)\)\s*!important;/,
  );
});

test("菜单 hover 用 accent，不绑侧栏选中灰", () => {
  const indexCss = readFileSync("src/index.css", "utf8");
  const hoverRule = indexCss.match(
    /\[role="menu"\] \[role="menuitem"\]\[data-highlighted\],[\s\S]*?\{[\s\S]*?\}/,
  )?.[0];
  expect(hoverRule).toBeTruthy();
  expect(hoverRule).toMatch(
    /background-color:\s*hsl\(var\(--accent\)\)\s*!important;/,
  );
  expect(hoverRule).not.toContain("--goose-interactive-selected");
});
