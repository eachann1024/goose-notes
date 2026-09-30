// Run: bun tests/unit/pageLayoutTopSpacing.selfcheck.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import postcss from "postcss";

const css = postcss.parse(readFileSync(new URL("../../src/pages/workspace/styles/page-layout.css", import.meta.url), "utf8"));
const declarations = (selector: string, container?: string) => {
  const result: Record<string, string> = {};
  css.walkRules(selector, (rule) => {
    if (container ? rule.parent?.type !== "atrule" || rule.parent.params !== container : rule.parent?.type !== "root") return;
    rule.walkDecls((decl) => { result[decl.prop] = decl.value; });
  });
  assert.ok(Object.keys(result).length, `Missing rule: ${selector}`);
  return result;
};
const base = declarations("[data-page-layout]");
const full = declarations('[data-page-layout="full"]');
assert.equal(base["--page-layout-top"], "80px");
assert.equal(full["--page-layout-top"], "24px");
assert.equal(full["--page-layout-width"], "none");
assert.equal(declarations("[data-page-layout] .page-layout-document").padding, "var(--page-layout-top) var(--page-layout-gutter) 100px");
const narrow = "page-layout (max-width: 680px)";
assert.equal(declarations("[data-page-layout] .page-layout-document", narrow).padding, "48px 32px 80px", "Standard keeps responsive gutters");
assert.equal(declarations('[data-page-layout="full"] .page-layout-document', narrow)["padding-top"], "var(--page-layout-top)", "Full width keeps its 24px top gutter below 680px");
assert.equal(declarations("[data-page-layout] .page-layout-document", "page-layout (max-width: 400px)")["padding-inline"], "24px");

const selector = '[data-page-layout] .workspace-editor-surface .bn-editor > .bn-block-group > .bn-block-outer:first-child > .bn-block > [data-content-type="heading"]:not([data-is-toggleable="true"])';
assert.equal(declarations(selector)["margin-top"], "0");
const block = (id: string, type = "heading", children = "", toggle = false) => `<div class="bn-block-outer"><div class="bn-block"><div id="${id}" data-content-type="${type}"${toggle ? ' data-is-toggleable="true"' : ""}><h2>${id}</h2></div>${children}</div></div>`;
const group = (children: string) => `<div class="bn-block-group">${children}</div>`;
const matching = (blocks: string) => {
  const { document } = parseHTML(`<div data-page-layout="full"><div class="workspace-editor-surface"><div class="bn-editor">${group(blocks)}</div></div></div>`);
  return Array.from(document.querySelectorAll(selector), (element) => element.id);
};
assert.deepEqual(matching(block("first", "heading", group(block("nested"))) + block("later")), ["first"], "Nested and subsequent headings retain their spacing");
assert.deepEqual(matching(block("paragraph", "paragraph") + block("later")), [], "A later heading must not become the first heading exception");
assert.deepEqual(matching(block("toggle", "heading", group(block("nested")), true)), [], "Toggle and nested headings retain their spacing");
console.log("PASS page layout top spacing: full/standard responsive gutters and root-only leading heading");
