import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { resolveAccentRuntimeTokens } from "../../src/lib/accentColor";
import { TEXT_COLORS } from "../../src/lib/textColors";
import {
  ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR,
  normalizeAccentColor,
} from "../../src/stores/settings/types";

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
  "--goose-interactive-selected-border",
  "--goose-sidebar-hover",
  "--goose-interactive-hover",
  "--goose-interactive-hover-fg",
  "--goose-interactive-hover-border",
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
  let index = 0;
  const bodies: string[] = [];
  while ((index = css.indexOf(`${selector} {`, index)) >= 0) {
    const bodyStart = css.indexOf("{", index) + 1;
    const bodyEnd = css.indexOf("}", bodyStart);
    bodies.push(css.slice(bodyStart, bodyEnd));
    index = bodyEnd + 1;
  }
  return bodies.join("\n");
}

function resolveTextToken(value: string, dark: boolean): string {
  const roles = TEXT_COLORS[dark ? "dark" : "light"];
  if (value === "var(--goose-text-primary)") return roles.primary;
  if (value === "var(--goose-text-info)") return roles.info;
  return value;
}

test("默认强调色和缺失设置回退为叶脉暖色，保留用户已有选择", () => {
  expect(DEFAULT_ACCENT_COLOR).toBe("mono");
  expect(normalizeAccentColor(undefined)).toBe("mono");
  expect(normalizeAccentColor("invalid")).toBe("mono");
  expect(normalizeAccentColor("iris")).toBe("iris");
});

test("九组强调色都提供浅色完整令牌和深色覆盖", () => {
  expect(ACCENT_COLORS).toHaveLength(9);

  for (const accentColor of ACCENT_COLORS) {
    const lightRule = getRule(`:root[data-goose-accent="${accentColor}"]`);
    const darkRule = getRule(`:root.dark[data-goose-accent="${accentColor}"]`);
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

test("强调色 preset 不使用旧 Electron 内核不可靠的颜色语法", () => {
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");
  expect(declarations).not.toContain("oklch(");
  expect(declarations).not.toContain("color-mix(");
  expect(declarations).not.toMatch(/hsl\(var\([^)]*\)\s*\//);
});

test("编辑器与 AI 行内代码都消费强调色 token", () => {
  const editorCss = readFileSync(
    new URL(
      "../../src/pages/workspace/styles/editor-base/inline.css",
      import.meta.url,
    ),
    "utf8",
  );
  const indexCss = readFileSync(
    new URL("../../src/index.css", import.meta.url),
    "utf8",
  );
  const aiCss = readFileSync(
    new URL(
      "../../src/pages/workspace/styles/notebook-ai.css",
      import.meta.url,
    ),
    "utf8",
  );

  expect(editorCss).toContain("background-color: var(--goose-inline-code-bg);");
  expect(editorCss).toContain("color: var(--goose-inline-code-fg);");
  expect(editorCss).toContain("[data-goose-inline-code-content]");
  expect(indexCss).toContain("background-color: var(--goose-inline-code-bg);");
  expect(indexCss).toContain("color: var(--goose-inline-code-fg);");
  expect(indexCss).not.toMatch(
    /\.ai-markdown[\s\S]*code:not\(pre > code\)[\s\S]*hsl\(220/,
  );
  expect(aiCss).toContain("background: var(--goose-inline-code-bg);");
  expect(aiCss).toContain("color: var(--goose-inline-code-fg);");
  expect(aiCss).toContain("color: var(--goose-accent-link);");
});

function getToken(rule: string, token: string): string {
  const matches = [...rule.matchAll(new RegExp(`${token}:\\s*([^;]+);`, "g"))];
  return matches.at(-1)?.[1]?.trim() ?? "";
}

test("深色行内代码保留主题底色并使用全局信息文字色", () => {
  for (const accent of ACCENT_COLORS) {
    const rule = getRule(`:root.dark[data-goose-accent="${accent}"]`);
    const background = getToken(rule, "--goose-inline-code-bg");
    expect(background, `${accent} background`).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(getToken(rule, "--goose-inline-code-fg")).toBe(
      "var(--goose-text-info)",
    );
    expect(getToken(rule, "--goose-inline-code-border-hover")).not.toBe("");
  }
});

test("深色 fallback 行内代码保留选中表面并使用全局文字色", () => {
  const indexCss = readFileSync(
    new URL("../../src/index.css", import.meta.url),
    "utf8",
  );
  const darkSectionMatch = indexCss.match(/\.dark\s*\{([\s\S]*?)\n {2}\}/);
  expect(darkSectionMatch).not.toBeNull();
  const darkSection = darkSectionMatch?.[1] ?? "";
  expect(darkSection).toContain(
    "--goose-inline-code-bg: var(--goose-icon-chip-on-selected);",
  );
  expect(darkSection).toContain(
    "--goose-inline-code-fg: var(--goose-text-info);",
  );
  expect(darkSection).not.toContain("--goose-inline-code-bg: #3d3e64;");
  expect(darkSection).not.toContain("--goose-inline-code-fg: #c7d2fe;");
  expect(darkSection).toContain("--goose-interactive-hover: #243247;");
  expect(darkSection).toContain(
    "--goose-interactive-hover-fg: var(--goose-text-primary);",
  );
  expect(darkSection).toContain("--goose-interactive-hover-border: #60a5fa;");
  expect(darkSection).toContain(
    "--goose-icon-chip-on-selected: var(--goose-interactive-selected);",
  );
});

test("深色 accent 选择器绑定在 :root.dark 上提高匹配确定性", () => {
  expect(css).toContain(':root.dark[data-goose-accent="amber"]');
  expect(css).not.toMatch(/(?<!:root)\.dark\[data-goose-accent=/);
});

test("九组 hover 与侧栏浅染底、前景和描边完全同步", () => {
  for (const accentColor of ACCENT_COLORS) {
    for (const selector of [
      `:root[data-goose-accent="${accentColor}"]`,
      `:root.dark[data-goose-accent="${accentColor}"]`,
    ]) {
      const rule = getRule(selector);
      expect(
        getToken(rule, "--goose-interactive-hover"),
        `${selector} hover`,
      ).toBe(getToken(rule, "--goose-sidebar-hover"));
      expect(
        getToken(rule, "--goose-interactive-hover-fg"),
        `${selector} fg`,
      ).toBe(getToken(rule, "--goose-interactive-selected-fg"));
      expect(
        getToken(rule, "--goose-interactive-hover-border"),
        `${selector} border`,
      ).toBe(getToken(rule, "--goose-interactive-selected-border"));
      expect(
        getToken(rule, "--goose-icon-chip-on-selected"),
        `${selector} chip`,
      ).toBe("var(--goose-interactive-selected)");
    }
  }

  for (const accentColor of ACCENT_COLORS) {
    for (const isDark of [false, true]) {
      const tokens = resolveAccentRuntimeTokens(accentColor, isDark);
      expect(tokens["--goose-interactive-hover"]).toBe(
        tokens["--goose-sidebar-hover"],
      );
      expect(tokens["--goose-interactive-hover-fg"]).toBe(
        tokens["--goose-interactive-selected-fg"],
      );
      expect(tokens["--goose-interactive-hover-border"]).toBe(
        tokens["--goose-interactive-selected-border"],
      );
      expect(tokens["--goose-icon-chip-on-selected"]).toBe(
        tokens["--goose-interactive-selected"],
      );
    }
  }
});

test("跨块选区只给文字节点上色，块壳 ::selection 保持透明", () => {
  const shellCss = readFileSync(
    new URL(
      "../../src/pages/workspace/styles/editor-base/shell.css",
      import.meta.url,
    ),
    "utf8",
  );
  const shellTransparent = shellCss.match(
    /\.goose-blocknote-editor \.bn-block-outer::selection,[\s\S]*?\{[^}]*\}/,
  );
  expect(shellTransparent).not.toBeNull();
  expect(shellTransparent![0]).toContain("background-color: transparent");
  expect(shellCss).toContain(".bn-inline-content::selection");
  expect(shellCss).toContain(".bn-inline-content *::selection");
  expect(shellCss).toContain(".goose-code-pre::selection");
  expect(shellCss).not.toMatch(/\.goose-blocknote-editor ::selection/);
  expect(shellCss).not.toMatch(/\.bn-inline-content ::selection/);

  expect(css).toContain(".bn-inline-content::selection");
  expect(css).toContain(".bn-inline-content *::selection");
  expect(css).toContain(
    '.bn-block-content[data-content-type="codeBlock"] pre::selection',
  );
  expect(css).not.toMatch(
    /:root\[data-goose-accent="[a-z]+"\] \.goose-blocknote-editor ::selection/,
  );
  expect(css).not.toMatch(
    /:root\[data-goose-accent="[a-z]+"\] \.bn-editor ::selection/,
  );
  expect(css).not.toContain(".bn-inline-content ::selection");
});

test("静态与运行时令牌一致，主题表面与全局文字保持对比", () => {
  const luminance = (hex: string) =>
    hex
      .slice(1)
      .match(/../g)!
      .map((c) => parseInt(c, 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a: string, b: string) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05);
  const keys = [
    "--goose-interactive-selected",
    "--goose-interactive-selected-fg",
    "--goose-interactive-selected-border",
    "--goose-sidebar-hover",
    "--goose-interactive-hover",
    "--goose-interactive-hover-fg",
    "--goose-interactive-hover-border",
  ];
  for (const accent of ACCENT_COLORS) {
    for (const dark of [false, true]) {
      const tokens = resolveAccentRuntimeTokens(accent, dark);
      const rule = getRule(
        `:root${dark ? ".dark" : ""}[data-goose-accent="${accent}"]`,
      );
      for (const key of keys) {
        expect(getToken(rule, key), `${accent}/${dark}/${key}`).toBe(
          tokens[key],
        );
        expect(resolveTextToken(tokens[key], dark)).toMatch(/^#[a-f0-9]{6}$/);
        if (accent === "mono" && dark && !key.endsWith("-fg"))
          expect(new Set(tokens[key].slice(1).match(/../g)).size).toBe(1);
      }
      expect(
        contrast(tokens[keys[0]], resolveTextToken(tokens[keys[1]], dark)),
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens[keys[0]], tokens[keys[2]])).toBeGreaterThanOrEqual(
        3,
      );
      expect(tokens[keys[3]]).not.toBe(tokens[keys[0]]);
      expect(tokens[keys[4]]).toBe(tokens[keys[3]]);
      expect(tokens[keys[5]]).toBe(tokens[keys[1]]);
      expect(tokens[keys[6]]).toBe(tokens[keys[2]]);
    }
  }
  expect(resolveAccentRuntimeTokens("ocean", false)).toMatchObject({
    "--goose-interactive-selected": "#e5edfc",
    "--goose-interactive-selected-fg": "var(--goose-text-primary)",
    "--goose-interactive-selected-border": "#547dd0",
    "--goose-sidebar-hover": "#eef3fc",
  });
  const dnd = readFileSync(
    "src/pages/workspace/styles/sidebar-dnd.css",
    "utf8",
  );
  for (const key of [
    "accent",
    "accent-soft",
    "accent-medium",
    "accent-ring",
    "overlay-border",
  ]) {
    expect(dnd).toMatch(
      new RegExp(`--sidebar-dnd-${key}: var\\(--goose-interactive-`),
    );
    expect(dnd.match(new RegExp(`--sidebar-dnd-${key}:`, "g"))).toHaveLength(1);
  }
  expect(dnd).toContain(".main-tree-row--selected::after");
  expect(dnd).toContain(".sidebar-tree-row--selected::after");
  expect(dnd).toContain(
    "border: 1px solid var(--goose-interactive-selected-border)",
  );
  expect(dnd).toContain("border-style: dashed");
});
