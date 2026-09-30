// Run: bun tests/unit/darkWorkspaceBorders.selfcheck.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const css = postcss.parse(readFileSync(new URL("../../src/pages/workspace/styles/index.css", import.meta.url), "utf8"));
const declarations = (selector: string) => {
  const result: Record<string, string> = {};
  css.walkRules(selector, (rule) => {
    if (rule.parent?.type !== "root") return;
    rule.walkDecls((decl) => { result[decl.prop] = decl.value; });
  });
  assert.ok(Object.keys(result).length, `Missing rule: ${selector}`);
  return result;
};
const edge = "var(--workspace-top-edge)";
assert.equal(declarations(".dark .workspace-shell .sidebar-rail-shell")["border-right"], "0", "Only the rounded frame should draw the rail/list boundary in dark mode");
assert.equal(declarations(".dark .workspace-shell .workspace-content-frame")["border-color"], edge, "All dark outer edges must use the same opaque color as the top edge");
assert.equal(declarations(".dark .workspace-stage:not([data-sidebar-collapsed]):not([data-sidebar-overlay]) .workspace-sidebar-pane::after").background, edge, "The docked divider must match the outer frame without leaking into collapsed/overlay layouts");
assert.equal(declarations(".workspace-shell .workspace-content-frame").border, "1px solid var(--workspace-divider)", "Preserve the light-mode outer edge");
const divider = declarations(".workspace-stage:not([data-sidebar-collapsed]):not([data-sidebar-overlay]) .workspace-sidebar-pane::after");
assert.equal(divider.width, "1px");
assert.equal(divider["pointer-events"], "none", "The line must not intercept sidebar resizing");
assert.equal(divider.background, "var(--workspace-divider)", "Preserve the light-mode separator");
console.log("PASS dark workspace single-outline and shared-edge regressions");
