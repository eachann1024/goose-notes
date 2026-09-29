import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const layout = readSource("src/pages/workspace/components/sidebar/sidebar-layout.css");
const styles = readSource("src/pages/workspace/styles/index.css");
const sidebar = readSource("src/pages/workspace/components/sidebar/Sidebar.tsx");

function rule(source, selector) {
  const start = source.indexOf(`${selector} {`);
  assert.ok(start >= 0, `Missing rule: ${selector}`);
  return source.slice(start + selector.length + 2, source.indexOf("}", start));
}

describe("sidebar shell surface", () => {
  it("rail remains transparent without a permanent border in every theme", () => {
    const rail = rule(layout, ".sidebar-rail-shell");
    assert.ok(rail.includes("background: transparent;"));
    assert.doesNotMatch(rail, /border(?:-[\w-]+)?\s*:/);
    assert.ok(!styles.includes(".sidebar-rail-shell"));
  });

  it("sidebar surface and overlay rounding target content, not the sibling rail", () => {
    assert.ok(sidebar.includes('className="sidebar-rail-shell"'));
    assert.ok(sidebar.includes('className="sidebar-content-surface flex min-h-0 min-w-0 flex-1 flex-col"'));
    assert.doesNotMatch(styles, /\.sidebar-size-container\s*>\s*div\s*>\s*div\s*\{/);
    const content = rule(styles, ".workspace-shell .workspace-sidebar-pane .sidebar-size-container > div > .sidebar-content-surface");
    assert.ok(content.includes("background: var(--workspace-sidebar-surface);"));
    assert.ok(content.includes("border-radius: var(--radius-lg) 0 0 var(--radius-lg);"));
    const overlay = rule(styles, ".workspace-shell .workspace-sidebar-pane[data-sidebar-overlay] .sidebar-size-container > div > .sidebar-content-surface");
    assert.ok(overlay.includes("border-radius: var(--radius-lg);"));
  });
});
