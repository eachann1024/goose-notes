// Run: bun tests/unit/workspaceSurfaces.selfcheck.ts (structure, not visual acceptance).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../../src/pages/workspace/styles/index.css");
const layout = read("../../src/pages/workspace/WorkspaceLayout.tsx");
const sidebar = read("../../src/pages/workspace/components/sidebar/sidebar-layout.css");
const aiCss = read("../../src/pages/workspace/styles/notebook-ai.css");
const aiPanel = read("../../src/pages/workspace/components/notebook-ai/NotebookAiPanel.tsx");
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `Missing rule: ${selector}`);
  return css.slice(start, css.indexOf("}", start));
};

assert.match(css, /--workspace-sidebar-surface: var\(--goose-sidebar-surface, color-mix\(in srgb, hsl\(var\(--goose-shell-bg\)\) 60%, hsl\(var\(--goose-editor-bg\)\)\)\)/);
assert.equal(css.match(/--workspace-sidebar-surface:/g)?.length, 1, "Dark mode must inherit the independent file surface");
for (const selector of [".workspace-shell[data-electron-chrome] .electron-titlebar", ".workspace-shell .sidebar-mode-rail"]) {
  assert.match(rule(selector), /background: var\(--goose-shell-surface\)/);
}
assert.match(rule(".workspace-shell .sidebar-mode-rail"), /border-right: 0/);
assert.match(css, /--workspace-sidebar-gap: 0px/);
assert.equal(layout.match(/workspace-content-frame/g)?.length, 1, "File list, editor and AI share one outer frame");
assert.match(layout, /workspace-content-frame pointer-events-none rounded-lg shadow-md" aria-hidden="true"/);
assert.doesNotMatch(layout, /workspace-main-sheet[^"\n]*shadow-/, "Do not shadow the editor separately");
assert.match(rule(".workspace-shell .workspace-content-frame"), /border: 1px solid var\(--workspace-divider\)/);
assert.match(css, /:not\(\[data-sidebar-overlay\]\):has\(\.sidebar-mode-rail\)\) > \.workspace-content-frame/, "Exclude only a visible docked icon rail; history and overlays keep the full frame");
assert.match(sidebar, /flex: 0 0 var\(--workspace-rail-width\)/);
assert.match(css, /\.workspace-stage:not\(\[data-sidebar-collapsed\]\):not\(\[data-sidebar-overlay\]\)/);
assert.match(rule(".workspace-shell .workspace-stage .workspace-sidebar-pane .sidebar-size-container .sidebar-design"), /background: transparent/);
assert.equal(layout.match(/workspace-content-columns/g)?.length, 3, "Page, folder and welcome tab share the same surface");
assert.match(css, /> :first-child:not\(\[data-editor-split="true"\]\)/, "Keep split-pane geometry intact");
assert.match(sidebar, /:is\(\.main-tree-row, \.sidebar-tree-row\) \{\s*border-radius: 8px/);
assert.match(aiCss, /\.notebook-ai-shell \{\s*background: var\(--workspace-main-surface\)/);
assert.doesNotMatch(read("../../src/pages/workspace/styles/beautiful-ui.css"), /\.notebook-ai-messages \{\s*background:/, "Message viewport must not mask the shared surface, including gradients");
assert.doesNotMatch(aiPanel, /goose-shell-bg|rounded-\[12px\]|rounded-b-\[12px\]/, "AI must not add an inset shell or inner card corners");
assert.doesNotMatch(layout.match(/className="notebook-ai-fullscreen-host[^"\n]+/)?.[0] ?? "", /bg-/);
assert.match(aiCss, /\.notebook-ai-empty-state-fullscreen \{\s*max-width: 720px/);
assert.match(aiCss, /\[data-ai-panel-layout="side-panel"\] \.notebook-ai-shell \{\s*background: var\(--workspace-sidebar-surface\)/);
assert.match(css, /\.workspace-content-columns:has\(> \[data-ai-panel-layout="side-panel"\]\) \{\s*gap: 0/);
assert.match(css, /\.electron-ai-header \{\s*width: calc\(var\(--workspace-ai-width/);
assert.match(aiPanel, /setProperty\("--workspace-ai-width", `\$\{effectiveWidth\}px`\)/);
assert.match(aiPanel, /removeProperty\("--workspace-ai-width"\)/);
assert.match(aiPanel, /!isFullscreen && !isElectronChrome \? \(/, "Desktop AI toolbar must not be duplicated inside its panel");
const titlebar = read("../../src/pages/workspace/components/page/DesktopTitleBar.tsx");
assert.match(titlebar, /goBackTabHistory\(\)/);
assert.match(titlebar, /goForwardTabHistory\(\)/);
assert.match(titlebar, /disabled=\{disabled\}/);
assert.match(titlebar, /electron-ai-header/);
assert.match(css, /\.electron-document-header::before/);
console.log("PASS workspace and AI surface structure; visual and native acceptance remain separate");
