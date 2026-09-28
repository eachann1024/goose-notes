import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseHTML } from "linkedom";
import {
  clampSidebarResizeWidth,
  resolveSidebarKeyboardWidth,
  resolveSidebarOverlayWidth,
  resolveSidebarWidth,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "../../src/pages/workspace/components/sidebar/hooks/useSidebarResize";
import { createEditorPaneRegistry } from "../../src/pages/workspace/components/editor-split/editorPaneRegistry";
import { shouldDismissSidebarOverlay } from "../../src/pages/workspace/components/sidebar/sidebarOverlayEscape";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");
const sidebar = source("src/pages/workspace/components/sidebar/Sidebar.tsx");
const header = source(
  "src/pages/workspace/components/sidebar/SidebarSectionHeader.tsx",
);
const outline = source("src/pages/workspace/components/sidebar/SidebarOutline.tsx");
const registry = source(
  "src/pages/workspace/components/editor-split/editorPaneRegistry.ts",
);
const panel = source("src/pages/workspace/components/outline/OutlinePanel.tsx");
const css = source("src/pages/workspace/components/sidebar/sidebar-layout.css");
const workspaceCss = source("src/pages/workspace/styles/index.css");
const edge = source("src/pages/workspace/components/sidebar/SidebarResizeEdge.tsx");
const resize = source("src/pages/workspace/components/sidebar/hooks/useSidebarResize.ts");

const overlayDocument = parseHTML("<html><body></body></html>").document as unknown as Document;
const overlayRoot = {
  activeElement: null as Element | null,
  querySelector: overlayDocument.querySelector.bind(overlayDocument),
};
const escape = { key: "Escape", target: null } as KeyboardEvent;
assert.equal(shouldDismissSidebarOverlay(escape, overlayRoot), true);
for (const patch of [
  { key: "Enter" }, { defaultPrevented: true }, { repeat: true },
  { isComposing: true }, { keyCode: 229 }, { which: 229 },
  { altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true },
]) {
  assert.equal(shouldDismissSidebarOverlay({ ...escape, ...patch }, overlayRoot), false, JSON.stringify(patch));
}
for (const markup of [
  "<input>", "<textarea></textarea>", "<select></select>",
  '<div contenteditable="true"><span></span></div>',
  '<div contenteditable="plaintext-only"><span></span></div>',
  '<div contenteditable><span></span></div>',
  '<div data-shortcut-recorder><button></button></div>',
]) {
  overlayDocument.body.innerHTML = markup;
  const target = overlayDocument.querySelector("span, button") ?? overlayDocument.body.firstElementChild;
  assert.equal(shouldDismissSidebarOverlay({ ...escape, target }, overlayRoot), false, markup);
  overlayRoot.activeElement = target;
  assert.equal(shouldDismissSidebarOverlay(escape, overlayRoot), false, `focused ${markup}`);
  overlayRoot.activeElement = null;
}
for (const markup of [
  '<dialog open></dialog>', '<div role="dialog"></div>',
  '<div role="dialog" data-state="open"></div>',
  '<div role="alertdialog" data-state="open"></div>',
  '<div role="menu" data-state="open"></div>',
  '<div data-goose-floating-content data-state="open"></div>',
]) {
  overlayDocument.body.innerHTML = markup;
  assert.equal(shouldDismissSidebarOverlay(escape, overlayRoot), false, markup);
}
for (const markup of [
  '<dialog></dialog>', '<div role="dialog" data-state="closed"></div>',
  '<div role="menu" hidden></div>', '<div role="alertdialog" aria-hidden="true"></div>',
  '<div data-goose-floating-content data-state="closed"></div>',
  '<div contenteditable="false"></div>',
]) {
  overlayDocument.body.innerHTML = markup;
  const target = overlayDocument.body.firstElementChild;
  // ponytail: linkedom only tests attribute presence; emulate the native false value, leave real focus behavior to browser QA.
  if (target?.getAttribute("contenteditable") === "false") {
    Object.defineProperty(target, "isContentEditable", { value: false });
  }
  assert.equal(shouldDismissSidebarOverlay({ ...escape, target }, overlayRoot), true, markup);
}
assert.match(sidebar, /if \(!sidebarOverlay\) return;[\s\S]*?document\.addEventListener\("keydown", onEscape\);/);
assert.match(sidebar, /return \(\) => document\.removeEventListener\("keydown", onEscape\);/);
assert.match(sidebar, /if \(!shouldDismissSidebarOverlay\(event, document\)\) return;/);
assert.match(sidebar, /setLeftExpandOverride\(false\)/);
assert.doesNotMatch(sidebar, /setSidebarCollapsed|aria-modal/);
assert.match(sidebar, /sidebarRef\.current\?\.contains\(active\)[\s\S]*?active === sidebarRef\.current\?\.previousElementSibling/);
assert.match(sidebar, /useLayoutEffect\(\(\) => \{\s*if \(sidebarOverlay \|\| !restoreSidebarFocusRef\.current\) return;\s*restoreSidebarFocusRef\.current = false;[\s\S]*?button\[aria-label="展开侧栏"\][\s\S]*?focus\(\{ preventScroll: true \}\)/);
assert.match(sidebar, /\{sidebarOverlay && \(\s*<button\s+type="button"\s+className="sidebar-overlay-backdrop"\s+aria-label="关闭导航面板"\s+tabIndex=\{-1\}\s+onClick=\{closeSidebarOverlay\}\s*\/>\s*\)\}\s*<div\s+ref=\{sidebarRef\}/);
assert.match(css, /\.workspace-stage\[data-sidebar-overlay\] > \.sidebar-overlay-backdrop \{\s*position: absolute;\s*inset: 0;\s*z-index: 20;/);
assert.match(css, /\.workspace-sidebar-pane\[data-sidebar-overlay\] \{\s*position: absolute;\s*z-index: 30;/);

assert.equal(resolveSidebarKeyboardWidth(288, "ArrowLeft"), 272);
assert.equal(resolveSidebarKeyboardWidth(288, "ArrowRight"), 304);
assert.equal(resolveSidebarKeyboardWidth(SIDEBAR_MIN_WIDTH, "ArrowLeft"), SIDEBAR_MIN_WIDTH);
assert.equal(resolveSidebarKeyboardWidth(SIDEBAR_MIN_WIDTH + 8, "ArrowLeft"), SIDEBAR_MIN_WIDTH);
assert.equal(resolveSidebarKeyboardWidth(SIDEBAR_MAX_WIDTH, "ArrowRight"), SIDEBAR_MAX_WIDTH);
assert.equal(resolveSidebarKeyboardWidth(SIDEBAR_MAX_WIDTH - 8, "ArrowRight"), SIDEBAR_MAX_WIDTH);
assert.equal(resolveSidebarKeyboardWidth(350, "Home"), SIDEBAR_MIN_WIDTH);
assert.equal(resolveSidebarKeyboardWidth(350, "End"), SIDEBAR_MAX_WIDTH);
for (const key of ["ArrowUp", "ArrowDown", "Tab", "Enter", "Escape", " ", "a"]) {
  assert.equal(resolveSidebarKeyboardWidth(288, key), null, `unrelated key: ${key}`);
}
for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
  assert.equal(resolveSidebarKeyboardWidth(288, key, true), null, `disabled key: ${key}`);
}
const preferredWidth = resolveSidebarWidth("480");
const overlayMax = (viewport: number) => resolveSidebarOverlayWidth(SIDEBAR_MAX_WIDTH, viewport);
assert.deepEqual(
  [375, 500, 375, 500].map((viewport) => clampSidebarResizeWidth(preferredWidth, overlayMax(viewport))),
  [319, 444, 319, 444],
  "viewport projections preserve the original preference",
);
assert.equal(preferredWidth, 480);
assert.equal(clampSidebarResizeWidth(preferredWidth), 480, "desktop restores the untouched preference");
for (const viewport of [375, 500]) {
  const frame = 8, resizeHitbox = 24, minimumScrim = 24;
  const visibleWidth = clampSidebarResizeWidth(preferredWidth, overlayMax(viewport));
  assert.equal(frame + resizeHitbox + minimumScrim, 56);
  assert.equal(viewport - visibleWidth, frame + resizeHitbox + minimumScrim);
  assert.ok(viewport - frame - visibleWidth - resizeHitbox >= minimumScrim, "outside resize leaves a clickable 24px scrim");
}
assert.equal(resolveSidebarKeyboardWidth(preferredWidth, "ArrowLeft", false, overlayMax(375)), 303);
assert.equal(resolveSidebarKeyboardWidth(preferredWidth, "End", false, overlayMax(375)), 319);
assert.equal(resolveSidebarKeyboardWidth(preferredWidth, "Home", false, overlayMax(375)), 268);
assert.equal(resolveSidebarKeyboardWidth(preferredWidth, "ArrowLeft", true, overlayMax(375)), null);
assert.equal(clampSidebarResizeWidth(clampSidebarResizeWidth(preferredWidth, 319) - 16, 319), 303, "drag starts at the visible width");
assert.equal(clampSidebarResizeWidth(303, overlayMax(500)), 303, "explicit resize remains the new preference");
for (const viewport of [188, 20]) {
  const max = overlayMax(viewport);
  assert.equal(clampSidebarResizeWidth(preferredWidth, max), max);
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
    assert.equal(resolveSidebarKeyboardWidth(preferredWidth, key, false, max), max);
  }
}
assert.equal(clampSidebarResizeWidth(overlayMax(188)), SIDEBAR_MIN_WIDTH, "desktop restores its minimum");
assert.deepEqual(
  [500, 375, 500].map((viewport) => [overlayMax(viewport), clampSidebarResizeWidth(300, overlayMax(viewport))]),
  [[444, 300], [319, 300], [444, 300]],
  "the maximum changes even when the visible sidebar does not",
);
assert.match(edge, /tabIndex=\{0\}/);
assert.match(edge, /role="separator"/);
assert.match(edge, /aria-label="调整侧栏宽度"/);
assert.match(edge, /aria-orientation="vertical"/);
assert.match(edge, /aria-valuemin=\{minWidth\}/);
assert.match(edge, /aria-valuemax=\{maxWidth\}/);
assert.match(edge, /aria-valuenow=\{width\}/);
assert.match(edge, /focus-visible:ring-ring/);
assert.match(css, /\.workspace-shell \.workspace-sidebar-pane\[data-sidebar-overlay\] > \[role="separator"\] \{\s*right: -24px !important;\s*\}/);
assert.match(css, /\.workspace-shell \.workspace-sidebar-pane\[data-sidebar-overlay\] > \[role="separator"\] > div \{\s*left: 0;\s*\}/);
assert.match(edge, /right: "calc\(-12px - var\(--workspace-sidebar-gap, 8px\) \/ 2\)", width: "24px"/, "desktop position and 24px hitbox are unchanged");
assert.match(edge, /left-1\/2 top-1\/2 -translate-x-1\/2 -translate-y-1\/2/, "overlay only moves the line anchor, preserving its centering");
assert.match(sidebar, /<SidebarResizeEdge\s+width=\{width\}/);
assert.match(sidebar, /minWidth=\{minWidth\}\s+maxWidth=\{maxWidth\}/);
assert.match(sidebar, /observer\.observe\(document\.documentElement\)/);
assert.match(sidebar, /setViewportWidth\(window\.innerWidth\)/);
assert.doesNotMatch(sidebar, /\bsetWidth\(/);
assert.match(resize, /const width = clampSidebarResizeWidth\(preferredWidth, maxWidth\)/);
assert.match(resize, /const startWidth = width/);
assert.match(resize, /setWidth\(clampSidebarResizeWidth\(newWidth, maxWidth\)\)/);
assert.match(resize, /localStorage\.setItem\("sidebar-width", String\(preferredWidth\)\)/);
assert.match(resize, /\}, \[preferredWidth\]\)/);
assert.match(sidebar, /onKeyDown=\{handleResizeKeyDown\}/);
assert.match(resize, /handleResizeMouseDown[\s\S]*?if \(disableResize \|\| event\.button !== 0\) return/);
assert.match(resize, /if \(nextWidth === null\) return;\s+event\.preventDefault\(\)/);

assert.deepEqual(
  [500, 375, 500, 375].map((viewport) => resolveSidebarOverlayWidth(480, viewport)),
  [444, 319, 444, 319],
  "overlay width follows repeated narrow viewport changes",
);
assert.equal(resolveSidebarWidth(null), 288);
assert.equal(resolveSidebarWidth("240"), 268, "legacy width is clamped, not offset");
assert.equal(resolveSidebarWidth("420"), 420);
assert.equal(resolveSidebarWidth("600"), 480);
for (const invalid of ["", "NaN", "Infinity", "-1", "0"]) {
  assert.equal(resolveSidebarWidth(invalid), 288, `invalid width: ${invalid}`);
}

const registryInstance = createEditorPaneRegistry();
const editorA = {};
const editorB = {};
const scrollA = {} as HTMLDivElement;
const scrollB = {} as HTMLDivElement;
let registryNotifications = 0;
const unsubscribe = registryInstance.subscribe(() => registryNotifications++);
registryInstance.register("pane-a", "page-a", { current: { editor: editorA } } as never, scrollA);
registryInstance.register("pane-b", "page-b", { current: { editor: editorB } } as never, scrollB);
registryInstance.setFocused("pane-a");
assert.deepEqual(registryInstance.getFocusedEntry(), {
  paneId: "pane-a",
  pageId: "page-a",
  editor: editorA,
  scrollEl: scrollA,
});
registryInstance.setFocused("pane-b");
assert.equal(registryInstance.getFocusedEntry()?.pageId, "page-b");
assert.equal(registryInstance.getFocusedEntry()?.scrollEl, scrollB);
assert.ok(registryNotifications >= 3, "pane registration and focus are observable");
const delayedRef: { current: { editor: unknown | null } } = {
  current: { editor: null },
};
registryInstance.register("pane-c", "page-c", delayedRef as never, null);
registryInstance.setFocused("pane-c");
assert.equal(registryInstance.getFocusedEntry()?.editor, null, "late editor starts unready");
const notificationsBeforeLateEditor = registryNotifications;
const editorC = {};
delayedRef.current.editor = editorC;
registryInstance.register("pane-c", "page-c", delayedRef as never, null);
assert.equal(registryInstance.getFocusedEntry()?.editor, editorC);
assert.equal(registryNotifications, notificationsBeforeLateEditor + 1, "late ref registration notifies subscribers");
const stableVersion = registryInstance.getVersion();
const stableNotifications = registryNotifications;
registryInstance.register("pane-c", "page-c", delayedRef as never, null);
assert.equal(registryInstance.getVersion(), stableVersion, "duplicate register is idempotent");
assert.equal(registryNotifications, stableNotifications, "duplicate register does not notify");
registryInstance.unregister("pane-c");
assert.equal(registryNotifications, stableNotifications + 1, "unregister notifies subscribers");
assert.notEqual(registryInstance.getFocusedEntry()?.pageId, "page-c");
const remainingPane = registryInstance.getFocusedEntry();
const remainingVersion = registryInstance.getVersion();
registryInstance.register("pane-c", "page-c", { current: null }, null);
assert.deepEqual(registryInstance.getFocusedEntry(), remainingPane, "empty teardown preserves the surviving pane");
assert.deepEqual(registryInstance.getScrollElements(), [scrollA, scrollB]);
assert.equal(registryInstance.getVersion(), remainingVersion);
assert.equal(registryNotifications, stableNotifications + 1, "empty teardown does not notify");
registryInstance.unregister("pane-a");
registryInstance.unregister("pane-b");
assert.equal(registryInstance.getFocusedEntry(), null, "no ghost remains behind the surviving panes");
unsubscribe();

for (const [editorRef, scrollEl] of [
  [{ current: { editor: editorA } }, null],
  [{ current: null }, scrollA],
] as const) {
  const lifecycle = createEditorPaneRegistry();
  let notifications = 0;
  const stop = lifecycle.subscribe(() => notifications++);
  lifecycle.register("pane", "page", { current: null }, null);
  assert.equal(lifecycle.getFocusedEntry(), null, "initial empty refs are not registered");
  assert.equal(lifecycle.getVersion(), 0);
  assert.equal(notifications, 0);
  lifecycle.register("pane", "page", editorRef as never, scrollEl);
  lifecycle.setFocused("pane");
  assert.deepEqual(lifecycle.getFocusedEntry(), {
    paneId: "pane", pageId: "page", editor: editorRef.current?.editor ?? null, scrollEl,
  }, "a late editor or scroll container can register independently");
  lifecycle.unregister("pane");
  const unregisteredVersion = lifecycle.getVersion();
  const unregisteredNotifications = notifications;
  lifecycle.register("pane", "page", { current: null }, null);
  assert.equal(lifecycle.getFocusedEntry(), null, "the final null ref callback cannot resurrect a deleted pane");
  assert.equal(lifecycle.getVersion(), unregisteredVersion);
  assert.equal(notifications, unregisteredNotifications);
  stop();
}

assert.match(sidebar, /sidebar-mode-rail/);
assert.match(sidebar, /aria-pressed=\{currentView === "pages"\}/);
assert.match(sidebar, /aria-pressed=\{currentView === "outline"\}/);
assert.match(sidebar, /hidden=\{currentView !== "pages"\}/);
assert.match(sidebar, /inert=\{currentView !== "pages"\}/);
assert.match(
  sidebar,
  /\{inHistoryMode && \([\s\S]*?<HistoryVersionList \/>\s*<\/div>\s*\)\}\s*<div\s+className="sidebar-design[^"]*"\s+hidden=\{inHistoryMode\}\s+inert=\{inHistoryMode\}\s+aria-hidden=\{inHistoryMode\}/,
  "history is conditional; the normal sidebar stays mounted and inaccessible while hidden",
);
assert.match(sidebar, /<\/div>\s*<SidebarFooter/, "footer stays outside the hidden normal sidebar");
assert.doesNotMatch(sidebar, /setActivePage\s*\(/);
assert.match(sidebar, /focusedPageIdOf\(split\)/);
assert.match(sidebar, /focusKey:/);
assert.match(sidebar, /onCollapseAll=/);
assert.ok(
  sidebar.indexOf('if (view === "outline") closeNotebookAiIfFullscreen();') <
    sidebar.indexOf("setCurrentView(view)"),
  "outline action still closes fullscreen AI before its idempotent state update",
);
assert.match(header, /aria-label="收起全部页面"/);
assert.match(header, /className="sidebar-heading-copy"/);
assert.match(header, /\{eyebrow && <span className="sidebar-heading-eyebrow">\{eyebrow\}<\/span>\}/);
assert.doesNotMatch(header, /onSwitchToPages|onSwitchToOutline/);
assert.match(sidebar, /eyebrow=\{currentView === "outline" \? "文档大纲"/);
assert.match(registry, /subscribe:\s*\(listener: \(\) => void\)/);
assert.match(registry, /getFocusedEntry/);
assert.match(registry, /pageId:\s*string/);
assert.match(outline, /focusedPane\.pageId === pageId/);
assert.match(outline, /focusedPane\?\.paneId === paneId/);
assert.doesNotMatch(outline, /setTimeout|requestAnimationFrame/);
assert.match(outline, /\[focusKey, pageId, paneId, registry, registryVersion/);
assert.match(panel, /emptyHint = "使用 ## 或 ### 添加章节"/);
assert.match(css, /width: 48px/);
assert.match(css, /\.sidebar-design\[hidden\],\s*\.sidebar-content-pane\[hidden\] \{ display: none !important; \}/);
assert.match(sidebar, /forceCollapseLeft && leftExpandOverride/);
assert.match(sidebar, /sidebarOverlay \? 0 : width/);
assert.match(sidebar, /toggleAttribute\("data-sidebar-overlay", sidebarOverlay\)/);
assert.match(sidebar, /sidebarRef\.current\?\.toggleAttribute\("data-sidebar-overlay", sidebarOverlay\)/);
assert.match(sidebar, /setSidebarObservedWidth\(entry\.contentRect\.width\)/);
assert.match(css, /\.workspace-stage\[data-sidebar-overlay\] \{ position: relative; \}/);
assert.match(css, /\.workspace-sidebar-pane\[data-sidebar-overlay\][\s\S]*position: absolute/);
assert.match(css, /width: min\(var\(--sidebar-configured-width\), calc\(100vw - 56px\)\) !important/);
assert.match(css, /height: auto !important/);
assert.match(css, /data-electron-chrome\] \.workspace-sidebar-pane\[data-sidebar-overlay\][\s\S]*inset-block: 0/);
assert.match(outline, /prefers-reduced-motion: reduce/);
assert.match(outline, /!page\.isFolder && !page\.trashedAt/);
assert.match(
  workspaceCss,
  /\[data-sidebar-collapsed="true"\],\s*\.workspace-shell\[data-electron-chrome\]:has\(> \.workspace-stage\[data-sidebar-overlay\]\) \.electron-titlebar \{\s*padding-left: calc\(var\(--electron-traffic-inset, 78px\) \+ 76px\);\s*\}/,
  "overlay shares collapsed titlebar control clearance without changing collapsed state",
);

console.log("sidebarDualNavigation.selfcheck: PASS");
