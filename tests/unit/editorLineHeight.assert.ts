// Run: bun --tsconfig-override ./tsconfig.app.json tests/unit/editorLineHeight.assert.ts
import assert from "node:assert/strict";
import { migrateSettingsPersistedState } from "../../src/stores/settings/migrations";
import { EDITOR_LINE_HEIGHT_DEFAULT, normalizeEditorLineHeight } from "../../src/stores/settings/types";
for (const value of [undefined, null, "1.7", NaN, Infinity, -Infinity]) {
  assert.equal(normalizeEditorLineHeight(value), 1.5);
}
for (const [input, expected] of [[0, 1.2], [9, 2.4], [1.74, 1.74], [1.76, 1.76], [1.95, 1.95], [1.2, 1.2], [2.4, 2.4]]) {
  assert.equal(normalizeEditorLineHeight(input), expected);
}

assert.equal(EDITOR_LINE_HEIGHT_DEFAULT, 1.5);
const previous = { editorLineHeight: 1.95 };
assert.equal(migrateSettingsPersistedState(previous, 7).editorLineHeight, 1.5);
assert.equal(previous.editorLineHeight, 1.95);
for (const height of [1.2, 1.4, 1.5, 1.7, 1.8, 2, 2.4]) {
  assert.equal(migrateSettingsPersistedState({ editorLineHeight: height }, 7).editorLineHeight, height);
}
assert.equal(migrateSettingsPersistedState(previous, 8).editorLineHeight, 1.95);
console.log("editor line height and migration checks passed");
