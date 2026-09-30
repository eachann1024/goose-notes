const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const read = (path) => readFileSync(path, "utf8");

const quick = read("src/pages/quick-note/quicknote.css");
assert.match(quick, /quicknote-slot-btn\[data-active="true"\][\s\S]*?outline: 1px solid var\(--goose-interactive-selected-border\)/);
assert.match(quick, /quicknote-slot-btn:not\(\[data-active="true"\]\):hover[\s\S]*?outline: 1px solid var\(--goose-interactive-hover-border\)/);
assert.match(quick, /quicknote-collect-stop-text-btn:hover[\s\S]*?background: var\(--goose-color-danger-subtle-bg\)/);
assert.ok(!quick.includes(".dark .quicknote-collect-chip"));

const toolbars = read("src/pages/workspace/styles/editor-base/toolbars.css");
const aiMenu = read("src/pages/workspace/styles/editor-ai-menu.css");
assert.match(toolbars, /goose-block-toolbar-control:not\(:disabled\):not\(\[aria-disabled="true"\]\):hover[\s\S]*?var\(--goose-interactive-hover\)/);
assert.match(toolbars, /goose-block-toolbar-control:focus-visible[\s\S]*?outline: 2px solid hsl\(var\(--ring\)\)/);
assert.match(aiMenu, /bn-suggestion-menu-item:hover[\s\S]*?var\(--goose-interactive-hover-fg\)/);
assert.match(aiMenu, /bn-suggestion-menu-item\[aria-selected="true"\][\s\S]*?var\(--goose-interactive-selected-fg\)/);
assert.ok(!aiMenu.includes("color-mix("));

const workspace = read("src/pages/workspace/styles/index.css");
assert.match(workspace, /--workspace-resize-line: linear-gradient\(/);
assert.match(workspace, /history-version-item\[data-selected="true"\][\s\S]*?var\(--goose-interactive-selected\)/);
assert.ok(!workspace.includes("page-menu-text-shimmer"));
assert.ok(!workspace.includes("#10b981"));

const settingsScaffold = read("src/pages/workspace/components/sidebar/settings/SettingsScaffold.tsx");
const appearance = read("src/pages/workspace/components/sidebar/SettingsAppearance.tsx");
const tabRail = read("src/pages/workspace/components/page/TabRail.tsx");
assert.match(settingsScaffold, /aria-pressed=\{activeTab === tab\.id\}/);
assert.match(appearance, /aria-pressed=\{theme === "system"\}/);
assert.match(appearance, /aria-pressed=\{uiFontSize === "small"\}/);
assert.match(appearance, /aria-pressed=\{displayedCodeStyle === t\.value\}/);
assert.match(tabRail, /aria-selected=\{isActive\}/);
assert.match(tabRail, /aria-pressed:hover:text-\[var\(--goose-interactive-selected-fg\)\]/);
console.log("Global accent coverage checks passed.");

// Pointer input never hides the keyboard Tab path (main and quicknote share bootstrap).
const main = read("src/main.tsx");
const handlers = {};
const document = {
  documentElement: { dataset: {} },
  addEventListener: (type, handler) => { handlers[type] = handler; },
};
const focusSetup = main.slice(main.indexOf('  document.addEventListener("pointerdown"'), main.indexOf('  const root = createRoot(rootElement);'));
new Function("document", focusSetup)(document);
handlers.pointerdown();
assert.equal(document.documentElement.dataset.goosePointerFocus, "true");
handlers.keydown({ key: "a" });
assert.equal(document.documentElement.dataset.goosePointerFocus, "true");
handlers.keydown({ key: "Tab" });
assert.equal(document.documentElement.dataset.goosePointerFocus, undefined);
assert.match(read("src/styles/focus-reset.css"), /html\[data-goose-pointer-focus="true"\][\s\S]*?outline: none !important/);
assert.match(read("src/components/ui/button.tsx"), /variant: "ghost", size: "icon", className: "goose-toolbar-action"/);
assert.match(read("src/components/ui/popover.tsx"), /mountedNode/);
console.log("Pointer focus, quiet toolbar and portal mount checks passed.");
