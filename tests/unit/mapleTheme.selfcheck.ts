// Run: bun tests/unit/mapleTheme.selfcheck.ts (palette/contrast contract; browser QA is separate).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeAccentColor } from "../../src/stores/settings/types";
import { resolveAccentRuntimeTokens } from "../../src/lib/accentColor";
import { TEXT_COLORS } from "../../src/lib/textColors";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../../src/styles/goose-accent-colors.css");
const appearance = read("../../src/pages/workspace/components/sidebar/SettingsAppearance.tsx");
const rule = (selector: string) => {
  const marker = `${selector} {`;
  const bodies: string[] = [];
  let offset = 0;
  while (true) {
    const start = css.indexOf(marker, offset);
    if (start < 0) break;
    const end = css.indexOf("}", start);
    bodies.push(css.slice(start + marker.length, end));
    offset = end + 1;
  }
  assert.ok(bodies.length, `Missing ${selector}`);
  return bodies.join("\n");
};
const value = (source: string, name: string) => {
  const found = [...source.matchAll(new RegExp(`--${name}:\\s*([^;]+)`, "g"))].at(-1);
  assert.ok(found, `Missing --${name}`);
  return found[1].trim();
};
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

for (const [key, label] of [["amber", "浅秋"], ["wheat", "麦笺"]] as const) {
  assert.equal(normalizeAccentColor(key), key, "Saved theme survives normalization");
  assert.match(appearance, new RegExp(`value: "${key}",[\\s\\S]*?label: "${label}"`));
  for (const dark of [false, true]) {
    const accent = rule(`:root${dark ? ".dark" : ""}[data-goose-accent="${key}"]`);
    const surface = dark ? accent : rule(`:root:not(.dark)[data-goose-accent="${key}"]`);
    const runtime = resolveAccentRuntimeTokens(key, dark);
    for (const [name, color] of Object.entries(runtime)) {
      if (name === "--goose-icon-chip-on-selected") continue;
      assert.equal(value(accent, name.slice(2)), color, `${key} runtime/CSS parity: ${name}`);
      assert.ok(!name.includes("surface"), "Surface overrides must not persist inline after changing theme");
    }
    const backgrounds = [
      ...stops(value(surface, "goose-sidebar-surface")),
      ...stops(value(surface, "goose-editor-surface")),
      ...stops(value(surface, "goose-ai-surface")),
    ];
    for (const name of ["foreground", "muted-foreground"]) {
      const role = name === "foreground" ? "primary" : "secondary";
      assert.equal(value(surface, name), `var(--goose-text-${role}-channels)`, `${key}/${dark}/${name}: shared text role`);
      for (const bg of backgrounds) {
        assert.ok(contrast(toRgb(TEXT_COLORS[dark ? "dark" : "light"][role]), bg) >= 4.5, `${key}/${dark}/${name}: small-text contrast`);
      }
    }
    for (const state of ["selected", "hover"]) {
      assert.equal(runtime[`--goose-interactive-${state}-fg`], "var(--goose-text-primary)");
      assert.ok(contrast(toRgb(TEXT_COLORS[dark ? "dark" : "light"].primary), toRgb(runtime[`--goose-interactive-${state}`])) >= 4.5, `${key}/${dark}/${state}: readable interaction text`);
    }
    for (const bg of backgrounds) {
      assert.ok(contrast(toRgb(value(accent, "goose-accent-focus")), bg) >= 3, `${key}/${dark}: visible focus`);
    }
  }
}
assert.equal(normalizeAccentColor("unknown-theme"), "mono");
assert.match(appearance, /完整主题/);
assert.match(appearance, /功能图标的铅笔描边/);
console.log("PASS saved themes, CSS/runtime parity, light/dark text and focus contrast");
