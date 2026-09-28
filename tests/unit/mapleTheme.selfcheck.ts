// Run: bun tests/unit/mapleTheme.selfcheck.ts (static contract check, not visual acceptance).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const appearance = read("../../src/pages/workspace/components/sidebar/SettingsAppearance.tsx");
const css = read("../../src/styles/goose-accent-colors.css");
const workspace = read("../../src/pages/workspace/styles/index.css");
const baseCss = read("../../src/index.css");
const types = read("../../src/stores/settings/types.ts");
const runtime = read("../../src/lib/accentColor.ts");

const rule = (source: string, selector: string) => {
  const marker = `${selector} {`;
  const bodies: string[] = [];
  let offset = 0;
  while (true) {
    const start = source.indexOf(marker, offset);
    if (start < 0) break;
    const bodyStart = start + marker.length;
    const end = source.indexOf("}", bodyStart);
    assert.ok(end >= 0, `Unclosed rule: ${selector}`);
    bodies.push(source.slice(bodyStart, end));
    offset = end + 1;
  }
  assert.ok(bodies.length > 0, `Missing rule: ${selector}`);
  return bodies.join("\n");
};
const value = (source: string, name: string) => {
  const found = source.match(new RegExp(`--${name}:\\s*([^;]+)`));
  assert.ok(found, `Missing --${name}`);
  return found[1].trim();
};

const option = appearance.match(/\{\s*value: "amber",([\s\S]*?)\n  \},/);
assert.ok(option, "Missing amber appearance option");
assert.match(option[0], /value: "amber"/);
assert.match(option[1], /label: "晨橙"/);
assert.match(types, /"amber"/);
assert.match(appearance, /className="relative h-5 w-5[^\"]*rounded-full/);
assert.equal((appearance.match(/absolute inset-y-0 (?:left|right)-0 w-1\/2/g) ?? []).length, 2, "Keep the original two-half preview size");
const preview = (name: string) => {
  const found = option[1].match(new RegExp(`${name}: "([^"]+)"`));
  assert.ok(found, `Missing ${name}`);
  return found[1];
};
const amberSurface = rule(css, ':root:not(.dark)[data-goose-accent="amber"]');
const amberAccent = rule(css, ':root[data-goose-accent="amber"]');
const amberDarkSurface = rule(css, ':root.dark[data-goose-accent="amber"]');
const darkAccent = rule(css, ':root.dark[data-goose-accent="amber"]');
// The saved key stays amber; runtime overrides must agree with both CSS palettes.
const runtimeAmber = runtime.slice(runtime.indexOf("  amber: {"), runtime.indexOf("  coral: {"));
for (const [mode, declarations] of [["light", amberAccent], ["dark", darkAccent]]) {
  const block = runtimeAmber.match(new RegExp(`${mode}: \{([\\s\\S]*?)\n    \}`));
  assert.ok(block, `Missing ${mode} runtime palette`);
  for (const [, name, color] of block[1].matchAll(/"--([^"]+)": "([^"]+)"/g)) {
    assert.equal(value(declarations, name), color, `${mode} CSS/runtime mismatch: ${name}`);
  }
}
assert.equal(value(amberAccent, "goose-interactive-selected"), "#fffaf3");
assert.equal(value(amberAccent, "goose-inline-code-bg"), "#fff0de");
assert.equal(value(amberAccent, "goose-accent-focus"), "#ad4e15");
const monoSurface = rule(css, ':root:not(.dark)[data-goose-accent="mono"]');
const monoAccent = rule(css, ':root[data-goose-accent="mono"]');
assert.equal(value(amberSurface, "goose-editor-surface"), "linear-gradient(180deg, #fbf7f0, #fbfaf5)");
assert.equal(value(amberSurface, "goose-editor-bg"), "38.182 57.895% 96.275%", "Solid editor chrome must match the paper gradient start");
assert.equal(value(amberSurface, "goose-sidebar-surface"), "linear-gradient(180deg, #f7e8d5, #faf4e8)");
assert.equal(value(amberSurface, "goose-ai-surface"), "linear-gradient(180deg, #faf4e9, #fbfaf5)");
assert.equal(value(amberSurface, "goose-secondary-surface"), "var(--goose-ai-surface)");
assert.equal(value(amberSurface, "goose-input-surface"), "#ffffff");
for (const property of ["goose-sidebar-surface", "goose-secondary-surface"]) {
  assert.equal(css.match(new RegExp(`--${property}:`, "g"))?.length, 2, `${property} must have only light/dark amber definitions`);
  assert.match(amberSurface, new RegExp(`--${property}:`));
  assert.match(amberDarkSurface, new RegExp(`--${property}:`));
  assert.doesNotMatch(monoSurface, new RegExp(`--${property}:`));
  assert.doesNotMatch(monoAccent, new RegExp(`--${property}:`));
  assert.doesNotMatch(runtime, new RegExp(`--${property}`), `${property} must not linger as an inline runtime token`);
}
assert.match(workspace, /--workspace-sidebar-surface:\s*var\(--goose-sidebar-surface,/);
assert.match(workspace, /\.settings-shell :is\(\[data-slot="input"\], textarea, select\)\s*\{\s*background: var\(--goose-input-surface\)/);
assert.match(workspace, /:root\[data-goose-accent="amber"\][\s\S]*?\.workspace-page-empty[\s\S]*?\.goose-menu-surface[\s\S]*?background:\s*var\(--goose-secondary-surface\)/);

const toRgb = (input: string): [number, number, number] => {
  const hex = input.match(/^#([\da-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => Number.parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number];
  const hsl = input.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  assert.ok(hsl, `Unsupported color: ${input}`);
  const h = Number(hsl[1]) / 360, s = Number(hsl[2]) / 100, l = Number(hsl[3]) / 100;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
};
const luminance = (color: [number, number, number]) =>
  color.map((n) => n / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};
const stops = (gradient: string) => {
  const colors = [...gradient.matchAll(/#[\da-f]{6}/gi)].map(([hex]) => toRgb(hex));
  assert.ok(colors.length >= 2, `Expected gradient stops: ${gradient}`);
  return colors;
};
const backgrounds = [
  ...stops(value(amberSurface, "goose-sidebar-surface")),
  ...stops(value(amberSurface, "goose-ai-surface")),
  ...stops(value(amberSurface, "goose-editor-surface")),
  toRgb(value(amberSurface, "goose-input-surface")),
];
for (const foreground of [value(amberSurface, "foreground"), value(amberSurface, "muted-foreground")].map(toRgb)) {
  for (const background of backgrounds) assert.ok(contrast(foreground, background) >= 4.5, "Amber small-text contrast must be at least 4.5:1");
}
const focus = toRgb(value(amberAccent, "goose-accent-focus"));
for (const background of backgrounds) assert.ok(contrast(focus, background) >= 3, "Amber focus contrast must be at least 3:1");
const lightRing = value(amberSurface, "ring") === "var(--primary)"
  ? toRgb(value(amberSurface, "primary"))
  : toRgb(value(amberSurface, "ring"));
for (const background of backgrounds) assert.ok(contrast(lightRing, background) >= 3, "Light --ring contrast must be at least 3:1");

for (const declarations of [amberAccent, darkAccent]) {
  for (const state of ["selected", "hover"]) {
    assert.ok(contrast(toRgb(value(declarations, `goose-interactive-${state}-fg`)), toRgb(value(declarations, `goose-interactive-${state}`))) >= 4.5, `${state} text contrast`);
  }
}

const darkBackgrounds = [
  ...stops(value(amberDarkSurface, "goose-sidebar-surface")),
  toRgb(value(rule(baseCss, ".dark"), "goose-editor-bg")),
  toRgb(value(darkAccent, "goose-interactive-selected")),
];
const darkFocus = toRgb(value(darkAccent, "goose-accent-focus"));
const darkRing = toRgb(value(darkAccent, "ring"));
for (const background of darkBackgrounds) {
  assert.ok(contrast(darkFocus, background) >= 3, "Dark --goose-accent-focus contrast must be at least 3:1");
  assert.ok(contrast(darkRing, background) >= 3, "Dark --ring contrast must be at least 3:1");
}

const lightSurface = toRgb(preview("lightSurface"));
const lightForeground = toRgb(preview("lightForeground"));
assert.ok(contrast(lightForeground, lightSurface) >= 4.5, "Light selected text contrast must be at least 4.5:1");
assert.ok(contrast(lightForeground, lightSurface) >= 3, "Light keyboard focus contrast must be at least 3:1");
const darkForeground = toRgb(preview("darkForeground"));
const darkSurface = preview("darkSurface").match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
assert.ok(darkSurface, "Expected translucent orange dark preview surface");
const darkBase = toRgb(value(darkAccent, "goose-interactive-selected"));
const darkBackground = darkBase.map((channel, index) =>
  Number(darkSurface[index + 1]) * Number(darkSurface[4]) + channel * (1 - Number(darkSurface[4])),
) as [number, number, number];
assert.ok(contrast(darkForeground, darkBackground) >= 4.5, "Dark selected text contrast must be at least 4.5:1");
assert.ok(contrast(darkForeground, darkBackground) >= 3, "Dark keyboard focus contrast must be at least 3:1");

assert.match(css, /\.goose-accent-option:focus-visible\s*\{[^}]*var\(--goose-accent-option-light-fg\)/);
assert.match(css, /\.dark \.goose-accent-option:focus-visible\s*\{[^}]*var\(--goose-accent-option-dark-fg\)/);
console.log("PASS orange label/key, fixed preview geometry, amber surface scope, no-residue cascade, and text/focus contrast (static; visual acceptance remains separate)");
