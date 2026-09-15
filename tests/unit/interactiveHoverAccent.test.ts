import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const indexCss = readFileSync("src/index.css", "utf8");
const focusResetCss = readFileSync("src/styles/focus-reset.css", "utf8");

test("共享轻染 hover 使用当前强调色的背景、前景与细描边", () => {
  expect(indexCss).toContain(".goose-interactive:where(");
  expect(indexCss).toContain(
    "background-color: var(--goose-interactive-hover);",
  );
  expect(indexCss).toContain("color: var(--goose-interactive-hover-fg);");
  expect(indexCss).toContain(
    "outline: 1px solid var(--goose-interactive-hover-border);",
  );
});

test("selected 优先于 hover，菜单项保留更强 selected 表面", () => {
  expect(indexCss).toContain('.goose-interactive[data-selected="true"]');
  expect(indexCss).toContain(
    "background-color: var(--goose-interactive-selected);",
  );
  expect(indexCss).toContain(
    '.goose-menu-surface .goose-interactive[data-selected="true"]',
  );
  expect(indexCss).toContain("var(--goose-interactive-selected-border)");
});

test("UI 基座统一接入共享交互类，主操作和危险操作不再用实色按钮", () => {
  const button = readFileSync("src/components/ui/button.tsx", "utf8");
  const iconButton = readFileSync("src/components/ui/icon-button.tsx", "utf8");
  const dropdown = readFileSync("src/components/ui/dropdown-menu.tsx", "utf8");
  const contextMenu = readFileSync(
    "src/components/ui/context-menu.tsx",
    "utf8",
  );

  expect(button).toContain("goose-interactive-primary");
  expect(button).toContain("goose-interactive-danger");
  expect(button).not.toContain("bg-primary text-primary-foreground");
  expect(iconButton).toContain("goose-interactive");
  expect(dropdown).toContain("goose-interactive");
  expect(contextMenu).toContain("goose-interactive");
});

test("focus-visible 保持可见，鼠标焦点 reset 不吞掉 hover 描边", () => {
  expect(indexCss).toContain(
    "):focus-visible {\n    outline: 2px solid var(--goose-accent-focus",
  );
  expect(focusResetCss).not.toContain("*:focus-visible");
  expect(focusResetCss).toContain('html[data-goose-pointer-focus="true"] :is(input, textarea, select, [contenteditable="true"]):focus');
  expect(focusResetCss).not.toMatch(/\*:focus\s*\{/);
});
