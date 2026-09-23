// Run: bun --tsconfig-override ./tsconfig.app.json tests/unit/editorLineHeight.assert.ts
import assert from "node:assert/strict";
import { normalizeEditorLineHeight } from "../../src/stores/settings/types";
for (const value of [undefined, null, "1.7", NaN, Infinity, -Infinity]) {
  assert.equal(normalizeEditorLineHeight(value), 1.5);
}
for (const [input, expected] of [[0, 1.2], [9, 2.4], [1.74, 1.7], [1.76, 1.8], [1.2, 1.2], [2.4, 2.4]]) {
  assert.equal(normalizeEditorLineHeight(input), expected);
}
console.log("editor line height checks passed");
