// Run: bun --tsconfig-override tsconfig.app.json tests/unit/refinedInterface.selfcheck.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolveAccentRuntimeTokens } from "../../src/lib/accentColor";
import { DEFAULT_FONT_NAMES, getEditorFontFamilies } from "../../src/lib/fontLoader";
import { normalizePageLayout, parseLocalFrontmatterBlob } from "../../src/lib/local-frontmatter";
import { migrateSettingsPersistedState } from "../../src/stores/settings/migrations";
import { DEFAULT_ACCENT_COLOR, EDITOR_FONT_SIZE_DEFAULT, EDITOR_LINE_HEIGHT_DEFAULT, normalizeAccentColor, normalizeEditorFontSize, normalizeEditorLineHeight } from "../../src/stores/settings/types";

assert.equal(EDITOR_FONT_SIZE_DEFAULT, 17);
assert.equal(EDITOR_LINE_HEIGHT_DEFAULT, 1.5);
assert.equal(normalizeEditorLineHeight(1.95), 1.95);
assert.equal(normalizeEditorLineHeight(NaN), 1.5);
assert.equal(normalizeEditorLineHeight(9), 2.4);
assert.equal(normalizeEditorFontSize(-1), 12);
assert.equal(normalizeEditorFontSize(undefined), 17);
for (const value of ["compact", undefined, null, "invalid"]) assert.equal(normalizePageLayout(value), "standard");
assert.equal(normalizePageLayout("full"), "full");
assert.equal(parseLocalFrontmatterBlob("goose-layout: compact").settings.pageLayout, "standard");
const old = { editorFontSize: 16, editorLineHeight: 1.5, defaultPageLayout: "compact", customFonts: { default: { font: "Custom" } } };
const migrated = migrateSettingsPersistedState(old, 5);
assert.equal(migrated.editorFontSize, 17);
assert.equal(migrated.editorLineHeight, 1.5);
assert.equal(migrated.defaultPageLayout, "standard");
assert.deepEqual(migrated.customFonts, old.customFonts);
assert.equal(old.editorFontSize, 16, "Migration must not mutate the stored input");
const custom = migrateSettingsPersistedState({ editorFontSize: 19, editorLineHeight: 1.7, defaultPageLayout: "full" }, 5);
assert.equal(custom.editorFontSize, 19);
assert.equal(custom.editorLineHeight, 1.7);
assert.equal(custom.defaultPageLayout, "full");
assert.equal(migrateSettingsPersistedState({ editorFontSize: 16, editorLineHeight: 1.5 }, 6).editorFontSize, 16);
assert.equal(migrateSettingsPersistedState({ editorFontSize: 16, editorLineHeight: 1.5 }, 6).editorLineHeight, 1.5);
const fonts = { default: { label: null, font: null }, serif: { label: null, font: null }, mono: { label: null, font: null } };
assert.equal(DEFAULT_FONT_NAMES.default, "Songti SC");
assert.deepEqual(getEditorFontFamilies("default", fonts), ["Songti SC", "Noto Serif CJK SC", "STSong"]);
assert.equal(getEditorFontFamilies("default", { ...fonts, default: { label: null, font: "Custom Font" } })[0], "Custom Font");

// Freeze every palette outside the intentionally redesigned mono-light and maple themes.
const keys = ["iris", "ocean", "mono", "pine", "amber", "coral", "rose", "grape"] as const;
const protectedTokens = keys.flatMap(k => [false, true].filter(d => k !== "amber" && (d || k !== "mono")).map(d => [k, d, resolveAccentRuntimeTokens(k, d)]));
assert.equal(createHash("sha256").update(JSON.stringify(protectedTokens)).digest("hex"), "5a8d22af83babcb65f3ade0d3ca52f56e086fb0ab06a50eafa0292127afecfb1");
assert.equal(DEFAULT_ACCENT_COLOR, "mono");
for (const value of [undefined, null, "invalid"]) assert.equal(normalizeAccentColor(value), "mono");
for (const value of keys) assert.equal(normalizeAccentColor(value), value, "Never overwrite a saved theme choice");
assert.equal(resolveAccentRuntimeTokens("amber", false)["--goose-interactive-selected"], "#fcf8f0");
assert.equal(resolveAccentRuntimeTokens("amber", false)["--goose-sidebar-hover"], "#eee5d3");
const warm = resolveAccentRuntimeTokens("mono", false);
assert.equal(warm["--goose-interactive-selected"], "#fcfcf7");
assert.equal(warm["--goose-sidebar-hover"], "#e3e1d5");
assert.equal(warm["--goose-editor-selection-bg"], "#eeebde");
const css = readFileSync(new URL("../../src/styles/goose-accent-colors.css", import.meta.url), "utf8");
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [m[1].trim(), m[2].trim()]);
const protectedRules = rules.filter(([selector]) => !selector.includes('data-goose-accent="amber"') && (!selector.includes('data-goose-accent="mono"') || selector.includes(".dark[")));
assert.equal(createHash("sha256").update(JSON.stringify(protectedRules)).digest("hex"), "cab8d3478f996707d63c2ccd9d317e5ab820036bee906e8071a6a56c491074e8");
const warmDeclarations = rules.filter(([selector]) => selector === ':root[data-goose-accent="mono"]' || selector === ':root:not(.dark)[data-goose-accent="mono"]').map(([, body]) => body).join("\n");
for (const [name, value] of Object.entries(warm)) {
  if (name === "--goose-icon-chip-on-selected") continue; // CSS aliases the selected token.
  assert.ok(warmDeclarations.includes(`${name}: ${value};`), `CSS/runtime mismatch: ${name}`);
}
assert.match(warmDeclarations, /linear-gradient\(158deg, #ece8dd, #f5f3eb\)/);
assert.match(warmDeclarations, /linear-gradient\(165deg, #fcfbf7, #fffffc\)/);
assert.match(warmDeclarations, /linear-gradient\(165deg, #f6f5f0, #fbfbf7\)/);
for (const [selector, body] of rules.filter(([selector]) => selector.includes('data-goose-accent="mono"') && !selector.includes(".dark[") && /selection/.test(selector))) {
  assert.ok(body.includes("#eeebde"), `Editor selection must stay warm: ${selector}`);
}
const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const background of ["#ece8dd", "#e3e1d5", "#fcfbf7", "#f6f5f0"]) {
  assert.ok(contrast("#2b2e2b", background) >= 4.5, "Body contrast");
  assert.ok(contrast("#60655c", background) >= 4.5, "Secondary text contrast");
  assert.ok(contrast("#756b42", background) >= 3, "Focus contrast");
}
assert.ok(contrast(warm["--goose-inline-code-fg"], warm["--goose-inline-code-bg"]) >= 4.5);
assert.match(css, /:root:not\(\.dark\)\[data-goose-accent="amber"\]/);
assert.match(css, /:root:not\(\.dark\)\[data-goose-accent="mono"\]/);
assert.match(css, /--goose-shell-surface: var\(--goose-sidebar-surface\)/);
const layoutCss = readFileSync(new URL("../../src/pages/workspace/styles/page-layout.css", import.meta.url), "utf8");
assert.match(layoutCss, /:has\(h1\)/, "BlockNote can wrap a heading; do not require a direct h1 child");
assert.match(layoutCss, /page-layout-document > \.workspace-editor-surface \{ padding-block: 0;/, "Document owns both top and bottom gutters");
assert.match(layoutCss, /--page-heading-gap: max\(0px, calc\(var\(--page-title-gap\) - var\(--previous-prose-gap, 0px\)\)\)/, "Wrapped prose must not add both neighboring margins");
assert.match(layoutCss, /letter-spacing: normal;\s*-webkit-font-smoothing: auto;/, "Prose must not inherit UI tracking or smoothing");
assert.match(layoutCss, /--bn-colors-editor-text: hsl\(var\(--foreground\)\)/, "Approved palettes must reach BlockNote's text token");
assert.match(layoutCss, /@container page-layout \(max-width: 680px\) \{\s*\[data-page-layout\] \.page-layout-document/, "Responsive padding must match the base selector specificity");
console.log("PASS refined interface: defaults, safe legacy migration, fonts, layout, 13 unchanged palettes, B warm surfaces and contrast");
