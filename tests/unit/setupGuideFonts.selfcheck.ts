import assert from "node:assert/strict";
import {
  defaultFontValueForMode,
  getDefaultFontMode,
} from "../../src/pages/workspace/components/shared/DefaultFontSelect";

assert.equal(getDefaultFontMode(null), "system");
assert.equal(getDefaultFontMode("serif"), "serif");
assert.equal(getDefaultFontMode("monospace"), "mono");
assert.equal(getDefaultFontMode("Songti SC"), "custom");
assert.equal(defaultFontValueForMode("system"), null);
assert.equal(defaultFontValueForMode("serif"), "serif");
assert.equal(defaultFontValueForMode("mono"), "monospace");
assert.equal(defaultFontValueForMode("custom"), null);

console.log("setup-guide font self-check passed");
