import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("浅色右键菜单使用独立的白色表面与细边框", () => {
  const indexCss = readFileSync("src/index.css", "utf8");
  expect(indexCss).toContain("--goose-menu-surface: var(--goose-editor-bg)");
  expect(indexCss).toContain("--goose-menu-border: 0 0% 86%");
  expect(indexCss).toContain("--goose-menu-radius: 16px");
  expect(indexCss).toContain("--goose-menu-item-radius: 8px");
  expect(indexCss).toContain("--goose-menu-item-height: 30px");
  expect(indexCss).toContain("--goose-menu-item-font-size: 14px");
  expect(indexCss).toMatch(
    /\.goose-menu-surface\s*\{[\s\S]*background-color:\s*hsl\(var\(--goose-menu-surface\)\);/,
  );
});

test("单选菜单项为绝对定位指示器预留左侧空间", () => {
  const source = readFileSync("src/components/ui/dropdown-menu.tsx", "utf8");
  expect(source).toMatch(
    /function DropdownMenuRadioItem[\s\S]*className=\{cn\("ps-8", className\)\}/,
  );
  expect(source).toContain("Dropdown.ItemIndicator");
});

test("右键菜单 hover 用中性浅灰底，文字跟随强调色", () => {
  const indexCss = readFileSync("src/index.css", "utf8");
  const hoverRule = indexCss.match(
    /\.goose-menu-surface \[role="menuitem"\]\[data-highlighted\],[\s\S]*?\{[\s\S]*?\}/,
  )?.[0];
  expect(hoverRule).toBeTruthy();
  expect(hoverRule).toMatch(
    /background-color:\s*hsl\(var\(--goose-menu-hover\)\)\s*!important;/,
  );
  expect(hoverRule).toContain("color: var(--goose-interactive-selected-fg)");
  expect(hoverRule).not.toMatch(
    /background-color:\s*var\(--goose-interactive-selected\)/,
  );
});

test("设置类下拉 hover 使用强调色，不被右键菜单灰底覆盖", () => {
  const dropdown = readFileSync("src/components/ui/dropdown-menu.tsx", "utf8");
  expect(dropdown).toContain(
    "hover:bg-[var(--goose-interactive-selected)]",
  );
  expect(dropdown).toContain(
    "data-[hovered]:bg-[var(--goose-interactive-selected)]",
  );
  const indexCss = readFileSync("src/index.css", "utf8");
  expect(indexCss).not.toMatch(
    /\[role="menu"\] \[role="menuitem"\]\[data-highlighted\]/,
  );
  expect(indexCss).toContain(
    "background-color: var(--goose-interactive-selected);",
  );
  expect(indexCss).toContain("[data-slot=\"menu-item\"]:hover");
});
