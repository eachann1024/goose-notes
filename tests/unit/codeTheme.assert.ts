// Run: bun --tsconfig-override tsconfig.app.json tests/unit/codeTheme.assert.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveCodeTheme } from "../../src/stores/settings/types";
import { migrateSettingsPersistedState } from "../../src/stores/settings/migrations";

assert.equal(resolveCodeTheme(false), "github-light");
assert.equal(resolveCodeTheme(true), "github-dark");
for (const codeStyle of ["github", "default", "catppuccin", "modern", "night", "dracula", "nord", "nord-light", "vivid", "unknown", null]) {
  const original = { codeStyle, theme: "dark", accentColor: "rose", editorFontSize: 19 };
  const migrated = migrateSettingsPersistedState(original, 6);
  assert.equal("codeStyle" in migrated, false);
  assert.equal(migrated.theme, "dark");
  assert.equal(migrated.accentColor, "rose");
  assert.equal(migrated.editorFontSize, 19);
  assert.equal(original.codeStyle, codeStyle, "Do not mutate the stored input");
}
const css = readFileSync(new URL("../../src/pages/workspace/styles/code-themes.css", import.meta.url), "utf8");
assert.deepEqual([...css.matchAll(/data-code-theme="([^"]+)"/g)].map(match => match[1]), ["github-light", "github-dark"]);
console.log("PASS fixed GitHub light/dark, legacy migration and theme CSS cleanup");
