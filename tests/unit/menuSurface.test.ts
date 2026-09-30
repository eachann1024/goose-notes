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
    /\.goose-floating-surface,\s*\n\.goose-menu-surface\s*\{[\s\S]*background-color:\s*hsl\(var\(--goose-menu-surface\)\);/,
  );
});

test("深色下拉压过 HeroUI 白色 bg-overlay", () => {
  const indexCss = readFileSync("src/index.css", "utf8");
  expect(indexCss).toContain(".dropdown__popover.goose-floating-surface");
  expect(indexCss).toMatch(
    /\.dropdown__popover\.goose-floating-surface,[\s\S]*background-color:\s*hsl\(var\(--goose-menu-surface\)\);/,
  );
});

test("下拉和 Popover 与右键菜单共用细边框外壳，不吃掉下拉强调色 hover", () => {
  const indexCss = readFileSync("src/index.css", "utf8");
  const dropdown = readFileSync("src/components/ui/dropdown-menu.tsx", "utf8");
  const popover = readFileSync("src/components/ui/popover.tsx", "utf8");
  expect(indexCss).toContain(".goose-floating-surface");
  expect(dropdown).toContain("goose-floating-surface");
  expect(dropdown).not.toContain("border-0");
  expect(popover).toContain("goose-floating-surface");
  expect(popover).not.toContain("border-border/80");
  expect(dropdown).toContain("goose-interactive");
});

test("单选菜单项把指示器放在右侧，不再为绝对定位预留左侧", () => {
  const source = readFileSync("src/components/ui/dropdown-menu.tsx", "utf8");
  expect(source).toMatch(
    /function DropdownMenuRadioItem[\s\S]*className=\{cn\("ps-2", className\)\}/,
  );
  expect(source).toContain("Dropdown.ItemIndicator");
  expect(source).toContain("position: \"static\"");
});

test("右键菜单 hover 用中性浅灰底，文字跟随强调色", () => {
  const indexCss = readFileSync("src/index.css", "utf8");
  const hoverRule = indexCss.match(
    /\.goose-menu-surface \[role="menuitem"\]\[data-highlighted\],[\s\S]*?\{[\s\S]*?\}/,
  )?.[0];
  expect(hoverRule).toBeTruthy();
  expect(hoverRule).toMatch(
    /background-color:\s*var\(--goose-interactive-hover\)\s*!important;/,
  );
  expect(hoverRule).toContain("color: var(--goose-interactive-hover-fg)");
  expect(hoverRule).not.toMatch(
    /background-color:\s*var\(--goose-interactive-selected\)/,
  );
});

test("设置类下拉 hover 使用强调色，不被右键菜单灰底覆盖", () => {
  const dropdown = readFileSync("src/components/ui/dropdown-menu.tsx", "utf8");
  expect(dropdown).toContain('variant === "menu" ? menuItemClass : itemClass');
  const itemClass = dropdown.match(/const itemClass =\s*"([^"]+)"/)?.[1] ?? "";
  expect(itemClass).not.toContain("goose-menu-item");
  const indexCss = readFileSync("src/index.css", "utf8");
  expect(indexCss).not.toMatch(
    /\[role="menu"\] \[role="menuitem"\]\[data-highlighted\]/,
  );
  expect(indexCss).toContain(
    "background-color: var(--goose-interactive-selected);",
  );
  expect(indexCss).toContain("[data-slot=\"menu-item\"]:hover");
});

test("下拉菜单覆盖 HeroUI zoom-in-90，改用从触发边 scale(0.96) 的入场", () => {
  const indexCss = readFileSync("src/index.css", "utf8");
  expect(indexCss).toContain(
    "[data-goose-floating-content].dropdown__popover[data-entering=\"true\"]",
  );
  expect(indexCss).toContain("goose-floating-in-bottom");
  expect(indexCss).toContain("scale(0.96)");
  expect(indexCss).toContain("cubic-bezier(0.23, 1, 0.32, 1)");
  expect(indexCss).toContain("@media (prefers-reduced-motion: reduce)");
  expect(indexCss).toContain("goose-floating-fade-in");
});

test("右键菜单与弹出层共用同一套入退场，键盘打开即时", () => {
  const contextMenu = readFileSync("src/components/ui/context-menu.tsx", "utf8");
  const motion = readFileSync(
    "src/components/ui/floating-menu-motion.ts",
    "utf8",
  );
  expect(contextMenu).toContain("useTransitionStatus");
  expect(contextMenu).toContain("floatingMenuMotionStyle");
  expect(contextMenu).toContain("transform: false");
  expect(contextMenu).toContain("{ shift: state.nested }");
  expect(motion).toContain("FLOATING_MENU_OPEN_MS = 200");
  expect(motion).toContain("FLOATING_MENU_CLOSE_MS = 150");
  expect(motion).toContain("FLOATING_MENU_SCALE = 0.96");
});

test("操作列表 variant=menu 走右键菜单灰底，而不是下拉强调色", () => {
  const dropdown = readFileSync("src/components/ui/dropdown-menu.tsx", "utf8");
  expect(dropdown).toContain('variant === "menu"');
  expect(dropdown).toContain("goose-menu-surface");
  expect(dropdown).toContain("goose-menu-item");
  expect(dropdown).toContain("DropdownMenuSeparator");
  const indexCss = readFileSync("src/index.css", "utf8");
  expect(indexCss).toContain(
    ".goose-menu-surface [data-slot=\"menu-item\"]:hover",
  );
  expect(indexCss).toContain(".goose-dropdown-host");
});
