// Run: bun tests/unit/pageLayout.assert.ts
import assert from "node:assert/strict";
import {
  applyFrontmatterBodyToContent,
  isLocalPageFrontmatterSettingsUpdate,
  mergeLocalPageSettingsIntoFrontmatter as merge,
  mergeSettingsIntoFrontmatterHeader as mergeHeader,
  pageSettingsFromMarkdown,
  parseLocalFrontmatterBlob as parse,
} from "../../src/lib/local-frontmatter";
import { extractFrontmatter } from "../../src/lib/markdown-raw-guard";

const defaults = { fontFamily: "default", isLocked: false, isPinned: false, isFavorite: false } as const;
const body = "# Mock layout\n\n**Keep** text\n\n| A | B |\n| - | - |\n| 1 | 2 |";
for (const pageLayout of ["full", "standard", "compact"] as const) {
  const settings = { ...defaults, pageLayout };
  const result = merge("---\ntitle: keep\ntags: [one, two]\ngoose-font: mono\n---", settings);
  assert.equal(result.parseFailed, false);
  assert.equal(parse(result.blob).settings.pageLayout, pageLayout);
  assert.equal(parse(result.blob).data.title, "keep");
  assert.deepEqual(parse(result.blob).data.tags, ["one", "two"]);
  assert.equal(!!result.blob?.includes("goose-layout:"), true);
  const md = mergeHeader(`---\ngoose-layout: reading\n---\n\n${body}`, settings)!;
  assert.equal(extractFrontmatter(md.markdown).body, body);
  assert.equal(pageSettingsFromMarkdown(md.markdown).pageLayout, pageLayout);
  const content = [{ type: "paragraph", content: "Mock unchanged" }];
  assert.deepEqual(applyFrontmatterBodyToContent(content, `goose-layout: ${pageLayout}`), content);
}
assert.equal(merge(undefined, defaults).blob, undefined);
assert.equal(isLocalPageFrontmatterSettingsUpdate({ pageLayout: "compact" }), true);
for (const value of ["reading", "wide", "READING", "null", "true", "42", "[reading]", "{key: compact}"]) {
  assert.equal(parse(`goose-layout: ${value}`).settings.pageLayout, "standard");
}
for (const yaml of [": [broken", "- compact", "reading", "null", "42", "goose-layout: compact\ngoose-layout: reading"]) {
  const blob = `---\n${yaml}\n---`;
  assert.equal(parse(blob).ok, false);
  assert.equal(parse(blob).settings.pageLayout, undefined);
  const result = merge(blob, { ...defaults, pageLayout: "compact" });
  assert.equal(result.parseFailed, true);
  assert.equal(result.blob, blob);
  assert.throws(() => mergeHeader(`${blob}\n\n${body}`, defaults), /阻止保存/);
  assert.equal(extractFrontmatter(`${blob}\n\n${body}`).body, body);
}
const unclosed = `---\ngoose-layout: compact\n${body}`;
assert.equal(parse(unclosed).ok, false);
assert.equal(extractFrontmatter(unclosed).body, unclosed);
assert.throws(() => mergeHeader(unclosed, defaults), /未闭合/);
assert.equal(mergeHeader(body, defaults), null);
assert.equal(pageSettingsFromMarkdown(undefined).pageLayout, undefined);
assert.equal(parse("---\r\ngoose-layout: reading\r\n---").settings.pageLayout, "standard");
console.log("PASS pageLayout: modes, whitelist, defaults, body preservation, malformed/unclosed/non-mapping/duplicate YAML");
