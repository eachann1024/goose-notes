// Run: bun --tsconfig-override tsconfig.app.json tests/unit/systemFonts.selfcheck.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_FONT_NAMES,
  getEditorFontFamilies,
  normalizeLocalFontName,
  ensureEditorFontAvailable,
  ensurePersistentRemoteFont,
  REMOTE_FONT_SOURCES,
  applyFontVariables,
  SYSTEM_FONT_STACK,
  toCssFontFamily,
} from "../../src/lib/fontLoader";
import { buildNotebookCardTheme } from "../../src/lib/imageExport/themes/presets/notebook";
import { getExportHtmlCss } from "../../src/lib/export/exportHtmlCss";
import { resolveDocxFonts } from "../../src/lib/docxExport/docxStyles";
import { migrateSettingsPersistedState } from "../../src/stores/settings/migrations";
import type { CustomFonts } from "../../src/stores/settings/types";

const emptyFonts: CustomFonts = {
  default: { label: null, font: null },
  serif: { label: null, font: null },
  mono: { label: null, font: null },
};

assert.equal(SYSTEM_FONT_STACK, '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
assert.equal(DEFAULT_FONT_NAMES.default, SYSTEM_FONT_STACK);
assert.deepEqual(getEditorFontFamilies("default", emptyFonts), [
  "-apple-system",
  "BlinkMacSystemFont",
  "Segoe UI",
  "sans-serif",
]);
assert.equal(toCssFontFamily("-apple-system"), "-apple-system");
assert.equal(toCssFontFamily("BlinkMacSystemFont"), "BlinkMacSystemFont");
assert.equal(toCssFontFamily(SYSTEM_FONT_STACK), SYSTEM_FONT_STACK);
assert.equal(toCssFontFamily("serif"), "serif");
assert.equal(toCssFontFamily("monospace"), "monospace");
assert.equal(getEditorFontFamilies("default", {
  ...emptyFonts,
  default: { label: null, font: "Songti SC" },
})[0], "Songti SC");
assert.equal(normalizeLocalFontName("Songti SC"), "Songti SC");

const migrateDefaultFont = (font: string | null) => {
  const state = migrateSettingsPersistedState({
    customFonts: {
      default: { label: "Keep label", font },
      serif: { label: null, font: "Songti SC" },
      mono: { label: null, font: null },
    },
  }, 8);
  return (state.customFonts as CustomFonts).default;
};

const legacy = {
  uiFontFamily: "HarmonyOS Sans SC",
  sidebarFontFamily: '"HarmonyOS Sans"',
  customFonts: {
    default: { label: "My font", font: "HarmonyOS Sans SC" },
    serif: { label: null, font: "Songti SC" },
    mono: { label: null, font: "Custom Mono" },
  },
};
const migrated = migrateSettingsPersistedState(legacy, 8);
assert.equal(migrated.uiFontFamily, null);
assert.equal(migrated.sidebarFontFamily, null);
assert.deepEqual(migrated.customFonts, {
  default: { label: "My font", font: null },
  serif: { label: null, font: "Songti SC" },
  mono: { label: null, font: "Custom Mono" },
});
assert.equal(legacy.customFonts.default.font, "HarmonyOS Sans SC", "Migration must not mutate stored input");
assert.deepEqual(migrateDefaultFont('  ui-sans-serif, "Custom Font"  '), {
  label: "Keep label",
  font: '  ui-sans-serif, "Custom Font"  ',
});
assert.deepEqual(migrateDefaultFont('ui-sans-serif, HarmonyOS Sans SC, "Custom Font"'), {
  label: "Keep label",
  font: 'ui-sans-serif, "Custom Font"',
});
assert.deepEqual(migrateDefaultFont("HarmonyOS Sans SC"), {
  label: "Keep label",
  font: null,
});

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const applied = new Map<string, string>();
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: { documentElement: { style: { setProperty: (key: string, value: string) => applied.set(key, value) } } },
});
try {
  applyFontVariables(emptyFonts);
  assert.equal(applied.get("--font-default"), SYSTEM_FONT_STACK);
  const missingCustomFont = {
    ...emptyFonts,
    default: { label: null, font: "Missing Custom Font" },
  };
  applyFontVariables(missingCustomFont);
  assert.equal(
    applied.get("--font-default"),
    `"Missing Custom Font", ${SYSTEM_FONT_STACK}`,
  );
  assert.deepEqual(getEditorFontFamilies("default", missingCustomFont), [
    "Missing Custom Font",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "sans-serif",
  ]);
} finally {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
}
assert.equal(applied.get("--font-ui"), SYSTEM_FONT_STACK);
assert.equal(applied.get("--font-sidebar"), SYSTEM_FONT_STACK);

const indexCss = readFileSync(new URL("../../src/index.css", import.meta.url), "utf8");
assert.match(indexCss, /--font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;/);
assert.match(indexCss, /--font-sidebar: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;/);
assert.match(indexCss, /--font-default: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;/);
assert.match(indexCss, /letter-spacing: normal;/);
assert.doesNotMatch(indexCss, /-webkit-font-smoothing|moz-osx-font-smoothing/);

const loader = readFileSync(new URL("../../src/lib/fontLoader.ts", import.meta.url), "utf8");
const fontsCss = readFileSync(new URL("../../src/fonts.css", import.meta.url), "utf8");
const layoutCss = readFileSync(new URL("../../src/pages/workspace/styles/page-layout.css", import.meta.url), "utf8");
const main = readFileSync(new URL("../../src/main.tsx", import.meta.url), "utf8");
const autoImports = readFileSync(new URL("../../src/auto-imports.d.ts", import.meta.url), "utf8");
const workspaceStartup = readFileSync(new URL("../../src/lib/workspaceStartup.ts", import.meta.url), "utf8");
for (const source of [loader, fontsCss, indexCss]) assert.doesNotMatch(source, /HarmonyOS|鸿蒙/i);
assert.doesNotMatch(loader, /document\.fonts\.check/);
assert.match(loader, /document\.fonts\.load\([^,]+, "中文"\)/);
assert.match(fontsCss, /dm-mono-latin-400-normal\.woff2/);
assert.match(fontsCss, /@font-face\s*\{\s*font-family:\s*"仓耳今楷"[\s\S]*?local\("仓耳今楷"\)[\s\S]*?url\("https:\/\//);
assert.ok(
  REMOTE_FONT_SOURCES["仓耳今楷"].every((url) =>
    decodeURIComponent(url).includes("仓耳今楷03W04.woff2"),
  ),
);
assert.doesNotMatch(main, /preloadFonts/);
assert.doesNotMatch(loader, /preloadFonts/);
assert.doesNotMatch(autoImports, /preloadFonts/);
assert.match(workspaceStartup, /await ensureEditorFontAvailable\(\s*activePage\?\.fontFamily/);
assert.match(loader, /selectsJinKai = selectedFamilies\.some/);
assert.match(layoutCss, /font-weight: 700/);
assert.match(layoutCss, /strong \{ font-weight: 700; \}/);
assert.doesNotMatch(layoutCss, /font-weight: 650/);

const cardTheme = buildNotebookCardTheme({ customFonts: emptyFonts });
assert.equal(cardTheme.titleFont, SYSTEM_FONT_STACK);
assert.equal(cardTheme.bodyFont, SYSTEM_FONT_STACK);
const exportCss = await getExportHtmlCss();
assert.ok(exportCss.includes(`--font-default: ${SYSTEM_FONT_STACK};`));
assert.doesNotMatch(exportCss, /HarmonyOS|鸿蒙/i);
assert.match(exportCss, /--font-mono:[\s\S]*?monospace;/);

const originalFontFace = Object.getOwnPropertyDescriptor(globalThis, "FontFace");
const faceSources: string[] = [];
let addedFaces = 0;
class FontFaceStub {
  constructor(_family: string, source: string) {
    faceSources.push(source);
  }
  async load() {
    if (faceSources.at(-1)?.startsWith("local(")) throw new Error("missing local face");
    return this;
  }
}
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    documentElement: { style: { setProperty: () => undefined } },
    fonts: { load: async () => [], add: () => { addedFaces += 1; } },
  },
});
Object.defineProperty(globalThis, "FontFace", {
  configurable: true,
  value: FontFaceStub,
});
try {
  await ensureEditorFontAvailable("serif", emptyFonts);
  assert.equal(await ensurePersistentRemoteFont("仓耳今楷"), true);
  assert.ok(faceSources.some((source) => source.startsWith("local(")));
  assert.ok(faceSources.some((source) => source.startsWith("url(")));
  assert.equal(addedFaces, 1);
} finally {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
  if (originalFontFace) Object.defineProperty(globalThis, "FontFace", originalFontFace);
  else Reflect.deleteProperty(globalThis, "FontFace");
}

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const withPlatform = (platform: string, run: () => void) => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { platform },
  });
  try {
    run();
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
};
withPlatform("MacIntel", () => {
  const fonts = resolveDocxFonts("default", emptyFonts);
  assert.equal(fonts.body, "PingFang SC");
  assert.equal(fonts.eastAsia, "PingFang SC");
  assert.equal(resolveDocxFonts("default", {
    ...emptyFonts,
    default: { label: null, font: "Songti SC" },
  }).body, "Songti SC");
  assert.equal(resolveDocxFonts("default", {
    ...emptyFonts,
    default: { label: null, font: "serif" },
  }).body, "Songti SC");
  assert.equal(resolveDocxFonts("default", {
    ...emptyFonts,
    default: { label: null, font: "monospace" },
  }).body, "Menlo");
  assert.equal(resolveDocxFonts("default", {
    ...emptyFonts,
    default: { label: null, font: "Segoe UI" },
  }).body, "Segoe UI");
  assert.equal(resolveDocxFonts("serif", emptyFonts).body, "仓耳今楷");
  assert.equal(resolveDocxFonts("serif", {
    ...emptyFonts,
    serif: { label: null, font: "serif" },
  }).body, "Songti SC");
  assert.equal(resolveDocxFonts("mono", emptyFonts).mono, "DM Mono");
  assert.equal(resolveDocxFonts("mono", {
    ...emptyFonts,
    mono: { label: null, font: "monospace" },
  }).mono, "Menlo");
});
withPlatform("Win32", () => {
  assert.equal(resolveDocxFonts("default", emptyFonts).body, "Microsoft YaHei");
  assert.equal(resolveDocxFonts("default", {
    ...emptyFonts,
    default: { label: null, font: "serif" },
  }).body, "SimSun");
  assert.equal(resolveDocxFonts("default", {
    ...emptyFonts,
    default: { label: null, font: "monospace" },
  }).body, "Consolas");
});
if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
else Reflect.deleteProperty(globalThis, "navigator");

console.log("PASS system fonts: CSS/runtime/export stacks, safe migration, async probes and DOCX platform fallbacks");
