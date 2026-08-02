import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { ACCENT_COLORS } from "../../src/stores/settings/types";

const css = readFileSync(
  new URL("../../src/styles/goose-accent-colors.css", import.meta.url),
  "utf8",
);

const REQUIRED_TOKENS = [
  "--primary",
  "--ring",
  "--goose-primary-hover-bg",
  "--goose-primary-active-bg",
  "--goose-interactive-selected",
  "--goose-interactive-selected-fg",
  "--goose-icon-chip-on-selected",
  "--goose-inline-code-bg",
  "--goose-inline-code-fg",
  "--goose-inline-code-border-hover",
  "--goose-callout-accent",
  "--goose-ai-approval-check-bg",
  "--goose-accent-link",
  "--goose-accent-focus",
  "--goose-accent-drag-line",
  "--goose-accent-drag-glow",
] as const;

function getRule(selector: string): string {
  const selectorIndex = css.indexOf(`${selector} {`);
  if (selectorIndex < 0) return "";
  const bodyStart = css.indexOf("{", selectorIndex) + 1;
  const bodyEnd = css.indexOf("}", bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

test("八组强调色都提供浅色完整令牌和深色覆盖", () => {
  expect(ACCENT_COLORS).toHaveLength(8);

  for (const accentColor of ACCENT_COLORS) {
    const lightRule = getRule(`:root[data-goose-accent="${accentColor}"]`);
    const darkRule = getRule(`.dark[data-goose-accent="${accentColor}"]`);
    expect(lightRule, `${accentColor} light preset`).not.toBe("");
    expect(darkRule, `${accentColor} dark preset`).not.toBe("");
    for (const token of REQUIRED_TOKENS) {
      expect(lightRule, `${accentColor} missing ${token}`).toContain(
        `${token}:`,
      );
      expect(darkRule, `${accentColor} dark missing ${token}`).toContain(
        `${token}:`,
      );
    }
  }
});

test("强调色 preset 不使用旧 uTools 内核不可靠的颜色语法", () => {
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
  expect(declarations).not.toContain("oklch(");
  expect(declarations).not.toContain("color-mix(");
  expect(declarations).not.toMatch(/hsl\(var\([^)]*\)\s*\//);
});

test("编辑器与 AI 行内代码都消费强调色 token", () => {
  const editorCss = readFileSync(
    new URL("../../src/pages/workspace/styles/editor-base.css", import.meta.url),
    "utf8",
  );
  const indexCss = readFileSync(
    new URL("../../src/index.css", import.meta.url),
    "utf8",
  );
  const aiCss = readFileSync(
    new URL("../../src/pages/workspace/styles/notebook-ai.css", import.meta.url),
    "utf8",
  );

  expect(editorCss).toContain(
    "background-color: var(--goose-inline-code-bg);",
  );
  expect(editorCss).toContain("color: var(--goose-inline-code-fg);");
  expect(editorCss).toContain("[data-goose-inline-code-content]");
  expect(indexCss).toContain(
    "background-color: var(--goose-inline-code-bg);",
  );
  expect(indexCss).toContain("color: var(--goose-inline-code-fg);");
  expect(indexCss).not.toMatch(
    /\.ai-markdown[\s\S]*code:not\(pre > code\)[\s\S]*hsl\(220/,
  );
  expect(aiCss).toContain("background: var(--goose-inline-code-bg);");
  expect(aiCss).toContain("color: var(--goose-inline-code-fg);");
  expect(aiCss).toContain("color: var(--goose-accent-link);");
});
