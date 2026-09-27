// Run after capturing both pages: node tests/typography-reference.check.mjs reference.json app.json
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

assert.equal(process.argv.length, 4, "Provide reference and app DOM/font measurement JSON paths");
const [reference, app] = process.argv.slice(2).map(path => JSON.parse(readFileSync(path, "utf8")));
assert.ok(reference.metrics.blocks.length > 0);
assert.equal(app.metrics.blocks.length, reference.metrics.blocks.length);
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.1, `${label}: ${actual} != ${expected}`);
near(app.metrics.editor.width, reference.metrics.editor.width, "reading width");
for (const [index, expected] of reference.metrics.blocks.entries()) {
  const actual = app.metrics.blocks[index];
  for (const key of ["text", "font", "size", "weight", "lineHeight", "letterSpacing", "color", "fontSmoothing"]) {
    assert.equal(actual[key], expected[key], `block ${index} ${key}`);
  }
  near(actual.rect.top - app.metrics.blocks[0].rect.top, expected.rect.top - reference.metrics.blocks[0].rect.top, `block ${index} vertical position`);
  near(actual.rect.height, expected.rect.height, `block ${index} height`);
}
for (const tag of ["h1", "p", "h2", "blockquote"]) {
  const faces = sample => {
    const entry = sample.fonts.find(item => item.selector.endsWith(` ${tag}`));
    assert.ok(entry?.fonts.length, `Missing rendered ${tag} fonts`);
    return entry.fonts.map(({ familyName, postScriptName, glyphCount }) => ({ familyName, postScriptName, glyphCount }));
  };
  assert.deepEqual(faces(app), faces(reference), `${tag} rendered font faces`);
}
console.log(`PASS ${reference.metrics.blocks.length} reference blocks: actual fonts, typography, ink, width and spacing`);
