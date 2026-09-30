// Run: bun --tsconfig-override ./tsconfig.app.json tests/unit/interfaceScale.selfcheck.ts
import assert from "node:assert/strict";
import { applyAppearanceScaleVariables, UI_FONT_SIZE_MAP } from "../../src/lib/appearance";
import { normalizeUIFontSize } from "../../src/stores/settings/types";

const properties = new Map<string, string>();
const originalDocument = globalThis.document;
Object.defineProperty(globalThis, "document", { configurable: true, value: {
  documentElement: { style: {
    setProperty: (key: string, value: string) => properties.set(key, value),
    getPropertyValue: (key: string) => properties.get(key) ?? "",
  } },
} });
try {
  assert.deepEqual(UI_FONT_SIZE_MAP, { small: 14, normal: 16, large: 18 });
  for (const size of ["small", "normal", "large"] as const) {
    assert.equal(normalizeUIFontSize(JSON.parse(JSON.stringify(size))), size);
    applyAppearanceScaleVariables({ uiFontSize: size, editorFontSize: 17, sidebarFontSize: 13 });
    assert.equal(properties.get("font-size"), `${UI_FONT_SIZE_MAP[size]}px`);
    assert.equal(properties.get("--editor-font-size"), "17px");
    assert.equal(properties.get("--sidebar-font-size"), "13px");
    assert.equal(properties.get("--editor-scale"), "1.0000");
  }
  assert.equal(normalizeUIFontSize(undefined), "small");
  assert.equal(normalizeUIFontSize("invalid"), "small");
} finally {
  if (originalDocument === undefined) Reflect.deleteProperty(globalThis, "document");
  else Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
}
console.log("interface scale: three levels, persistence normalization and independent sizes passed");
