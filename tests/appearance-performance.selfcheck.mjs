import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const input = read("src/pages/workspace/components/sidebar/SettingsAppearance.tsx");
const dialog = read("src/pages/workspace/components/sidebar/SettingsDialog.tsx");

assert.doesNotMatch(app, /useSettings\(\)/, "App must not subscribe to every settings write");
assert.match(app, /function AppearanceSync\(\)[\s\S]*?return null;/);
assert.doesNotMatch(app.split("function App()")[1], /applyFontVariables|applyAppearanceScaleVariables/);
assert.match(input, /onChange=\{\(event\) => setDraft\(event.target.value\)\}/);
assert.match(input, /onBlur=\{commit\}/);
assert.match(input, /if \(event.nativeEvent.isComposing\) return;/);
assert.match(input, /if \(font && !normalizeLocalFontName\(font\)\)/);
assert.match(input, /if \(font !== value\) onChange\(font\);/);
assert.doesNotMatch(dialog, /listAvailableOpenApps/, "Opening appearance must not scan installed apps");
assert.doesNotMatch(input, /代码主题|codeStyles|setCodeStyle/);
console.log("PASS appearance isolation, batched font commits and removed code-theme controls");
