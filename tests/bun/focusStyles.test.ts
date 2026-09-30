import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import postcss, { type Rule } from "postcss";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const reset = postcss.parse(read("../../src/styles/focus-reset.css"));
const global = postcss.parse(read("../../src/index.css"));

// linkedom 不计算 CSS 或键盘焦点，用属性仅验证生产选择器的匹配范围。
// 实际颜色、级联与键盘交互仍由浏览器/原生验收负责。
function matchingFocusRules(markup: string) {
  const { document } = parseHTML(`<html><body>${markup}</body></html>`);
  const target = document.querySelector("#target")!;
  const rules: Rule[] = [];
  reset.walkRules((rule) => {
    if (rule.selector.includes("::")) return;
    const selector = rule.selector
      .replaceAll(":focus-visible", '[data-test-focus-visible="true"]')
      .replaceAll(":focus", '[data-test-focus="true"]');
    if (target.matches(selector)) rules.push(rule);
  });
  return rules;
}

function declarations(rules: Rule[]) {
  return rules.flatMap((rule) =>
    rule.nodes.flatMap((node) => node.type === "decl" ? [node] : []),
  );
}

const hasSurfaceFeedback = (rules: Rule[]) =>
  declarations(rules).some((decl) => decl.prop === "background-color");

function expectRingReset(rules: Rule[]) {
  const values = declarations(rules);
  for (const prop of ["--tw-ring-shadow", "--tw-ring-offset-shadow", "--tw-inset-ring-shadow"]) {
    expect(values.some((decl) => decl.prop === prop && decl.value === "0 0 #0000" && decl.important)).toBe(true);
  }
  expect(values.some((decl) => decl.prop === "outline" && decl.value === "none" && decl.important)).toBe(true);
  expect(values.some((decl) => decl.prop === "box-shadow" || decl.prop === "--tw-shadow")).toBe(false);
}

describe("shared focus decoration policy", () => {
  test("shared controls do not add ring, outline or inset-shadow focus utilities", () => {
    const controls = [
      "../../src/components/ui/button.tsx",
      "../../src/components/ui/input.tsx",
      "../../src/components/ui/textarea.tsx",
      "../../src/components/ui/switch.tsx",
      "../../src/components/ui/tabs.tsx",
      "../../src/components/ui/icon-button.tsx",
      "../../src/components/ui/selectable-card.tsx",
      "../../src/components/ui/badge.tsx",
      "../../src/components/editor/ui/button.tsx",
      "../../src/components/editor/ui/input.tsx",
      "../../src/components/editor/ui/toggle.tsx",
      "../../src/pages/workspace/components/sidebar/SidebarFooter.tsx",
    ];
    for (const path of controls) {
      expect(read(path)).not.toMatch(/focus(?:-visible|-within)?:(?:ring|outline|shadow-\[inset)(?:-[\w[\]./%-]+)?/);
    }
  });

  test("keyboard text inputs and HeroUI state-only controls retain non-ring feedback", () => {
    for (const markup of [
      '<input id="target" type="text" data-test-focus="true" data-test-focus-visible="true">',
      '<input id="target" type="password" data-test-focus="true" data-test-focus-visible="true">',
      '<textarea id="target" data-test-focus="true" data-test-focus-visible="true"></textarea>',
      '<button id="target" data-test-focus="true" data-test-focus-visible="true"></button>',
      '<div id="target" role="button" data-slot="select-trigger" data-focus-visible="true"></div>',
      '<div id="target" data-slot="slider-thumb" data-focus-visible="true"></div>',
    ]) {
      const rules = matchingFocusRules(markup);
      expectRingReset(rules);
      expect(hasSurfaceFeedback(rules)).toBe(true);
      expect(declarations(rules).some((decl) => decl.prop === "color" && decl.value === "var(--goose-interactive-hover-fg)")).toBe(true);
    }
    expect(hasSurfaceFeedback(matchingFocusRules('<button id="target" data-test-focus="true"></button>'))).toBe(false);
  });

  test("HeroUI label focus reaches only the control ring, not checked indicators or thumb", () => {
    for (const kind of ["checkbox", "radio", "switch"]) {
      for (const focus of ['data-focus-visible="true"', 'data-test-focus-visible="true"']) {
        for (const selected of ["true", "false"]) {
          const label = `class="${kind}" data-slot="${kind}" ${focus} data-selected="${selected}"`;
          expect(hasSurfaceFeedback(matchingFocusRules(`<label id="target" ${label}></label>`))).toBe(true);
          const control = matchingFocusRules(`<label ${label}><span id="target" class="${kind}__control" data-slot="${kind}-control"></span></label>`);
          expectRingReset(control);
          expect(hasSurfaceFeedback(control)).toBe(false);
          expect(declarations(control).every((decl) => decl.prop === "outline" || decl.prop.startsWith("--tw-"))).toBe(true);
          for (const child of ["indicator", "thumb"]) {
            expect(matchingFocusRules(`<label ${label}><span class="${kind}__control"><span id="target" class="${kind}__${child}"></span></span></label>`)).toHaveLength(0);
          }
        }
      }
    }
  });

  test("shared focus feedback excludes disabled controls, range surfaces and floating surfaces", () => {
    for (const disabled of ['disabled', 'data-disabled="true"', 'aria-disabled="true"']) {
      expect(hasSurfaceFeedback(matchingFocusRules(`<button id="target" ${disabled} data-test-focus-visible="true" data-focus-visible="true"></button>`))).toBe(false);
    }
    for (const markup of [
      '<label id="target" class="checkbox" data-disabled="true" data-focus-visible="true"></label>',
      '<input id="target" type="range" role="slider" data-test-focus="true" data-test-focus-visible="true">',
      '<input id="target" type="hidden" data-focus-visible="true">',
      '<div id="target" class="goose-floating-surface" role="dialog" tabindex="-1" data-focus-visible="true"></div>',
      '<div id="target" class="goose-menu-surface" role="menu" tabindex="-1" data-focus-visible="true"></div>',
      '<div id="target" contenteditable="true" data-test-focus-visible="true"></div>',
    ]) {
      expect(hasSurfaceFeedback(matchingFocusRules(markup))).toBe(false);
    }
    expect(read("../../src/index.css").startsWith('@import "./styles/focus-reset.css";')).toBe(true);
    expect(reset.nodes.find((node) => node.type === "atrule" && node.name === "layer")?.toString().startsWith("@layer properties")).toBe(true);
    expect(read("../../src/styles/focus-reset.css")).not.toContain("box-shadow:");
    global.walkRules((rule) => {
      if (rule.selector.startsWith(":where(")) {
        expect(declarations([rule]).some((decl) => decl.prop === "box-shadow" && decl.value === "none" && decl.important)).toBe(false);
      }
    });
  });

  test("menu state rules keep color feedback without inset decoration and preserve surface shadows", () => {
    global.walkRules((rule) => {
      if (rule.selector.includes("menu-item") || rule.selector.includes("menuitem") || rule.selector.includes(".goose-menu-surface .goose-interactive")) {
        expect(declarations([rule]).some((decl) => decl.prop === "box-shadow" && decl.value.includes("inset"))).toBe(false);
      }
    });
    const source = read("../../src/index.css");
    expect(source).toContain("box-shadow: var(--goose-menu-shadow);");
    expect(source).toContain("border: 1px solid hsl(var(--goose-menu-border));");
    expect(source).toContain("box-shadow: var(--goose-menu-shadow) !important;");
  });

  test("range thumb and checked controls retain their non-ring state markers", () => {
    const range = postcss.parse(read("../../src/styles/range.css"));
    for (const pseudo of ["::-webkit-slider-thumb", "::-moz-range-thumb"]) {
      const rules: Rule[] = [];
      range.walkRules((rule) => { if (rule.selector === `input[type="range"]:focus-visible${pseudo}`) rules.push(rule); });
      expect(declarations(rules).map((decl) => `${decl.prop}: ${decl.value}`)).toEqual(["background: var(--range-ink)"]);
    }
    const nativeSwitch = read("../../src/components/ui/switch.tsx");
    expect(nativeSwitch).toContain("checked:before:translate-x-5");
    expect(nativeSwitch).toContain("checked:before:bg-[var(--goose-interactive-selected-border)]");
    expect(nativeSwitch).toContain("before:shadow-lg");
    expect(read("../../src/pages/workspace/components/sidebar/SettingsAppearance.tsx")).toContain('selected ? "opacity-100" : "opacity-0"');
  });

  test("already-colored primary and accent controls have an additional non-ring keyboard cue", () => {
    const primaryRules: Rule[] = [];
    global.walkRules((rule) => {
      if (rule.selector.startsWith(".goose-interactive-primary:focus-visible")) primaryRules.push(rule);
    });
    expect(declarations(primaryRules).some((decl) => decl.prop === "background-color" && decl.value === "var(--goose-interactive-selected)" && decl.important)).toBe(true);
    const accent = postcss.parse(read("../../src/styles/goose-accent-colors.css"));
    const accentRules: Rule[] = [];
    accent.walkRules((rule) => { if (rule.selector === ".goose-accent-option:focus-visible") accentRules.push(rule); });
    expect(declarations(accentRules).some((decl) => decl.prop === "text-decoration" && decl.value === "underline")).toBe(true);
  });

  test("AI prompt, media controls and workspace focus/open states do not restore decoration", () => {
    for (const path of [
      "../../src/pages/workspace/styles/editor-ai-menu.css",
      "../../src/pages/workspace/styles/editor-base/media.css",
      "../../src/pages/workspace/styles/index.css",
    ]) {
      const css = postcss.parse(read(path));
      css.walkRules((rule) => {
        expect(rule.nodes.length).toBeGreaterThan(0);
        const stateSelectors = rule.selectors.filter((selector) => !selector.includes(":hover"));
        if (!stateSelectors.some((selector) => /focus|\[data-selected="true"\]|\[data-state="open"\]/.test(selector))) return;
        for (const decl of declarations([rule])) {
          if (decl.prop === "outline") expect(decl.value).toMatch(/^(none|0)/);
          if (decl.prop === "box-shadow") expect(decl.value).not.toMatch(/inset|0 0 0 [124]px/);
        }
      });
    }
    const media = read("../../src/pages/workspace/styles/editor-base/media.css");
    expect(media).toContain(".goose-video-player:focus-visible .goose-video-player__bar");
    expect(media).toContain("0 8px 22px rgba(15, 23, 42, 0.08)");
  });
});
