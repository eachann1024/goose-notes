import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, createElement, useCallback, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { DEFAULT_APP_SHORTCUTS } from "../../src/stores/settings/slices/shortcutsSlice";
import { activateWorkspace, isHotkeyAllowedInSettings, isSettingsTab, isWorkspaceNavigationHotkey } from "../../src/lib/settings-navigation";

// This suite runs in its own Bun invocation: mocks isolate the navigation shell
// from filesystem/editor runtimes while exercising the real event listeners.
const { window: host, document: doc } = parseHTML("<html><body></body></html>");
const globalValues = { window: host, document: doc, HTMLElement: host.HTMLElement, Element: host.Element, CustomEvent: host.CustomEvent, KeyboardEvent: host.Event, useCallback, useEffect, IS_REACT_ACT_ENVIRONMENT: true };
const originals = new Map(Object.keys(globalValues).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globalValues)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const calls: string[] = [];
const record = (name: string) => () => { calls.push(name); };
let nativeClose: (() => void) | undefined;
const page = { id: "page", workspaceId: "notebook" };
const pages = { activePageId: "page", pages: { page }, getPage: () => page, setActivePage: record("set-active-page"), createPage: () => { calls.push("create-page"); return "new-page"; } };
const sidebar = { sidebarCollapsed: true, setSidebarCollapsed: record("persist-sidebar"), toggleSidebarCollapsed: record("persist-sidebar"), focusedByNotebook: {}, selectedByNotebook: {}, setExpanded: record("collapse-list") };
const tabs = { openTabs: [{ id: "tab", pageId: "page" }], activeTabId: "tab", closeTab: record("close-tab"), openTab: record("open-tab"), openNewTab: record("new-tab"), setActiveTab: record("activate-tab"), reopenLastClosedTab: record("reopen-tab"), goBackTabHistory: record("nav-back"), goForwardTabHistory: record("nav-forward") };
const settings = { appShortcuts: DEFAULT_APP_SHORTCUTS, increaseEditorFontSize: record("format"), decreaseEditorFontSize: record("format"), setEditorFontSize: record("format"), toggleDarkMode: record("theme") };
const store = (state: object) => Object.assign(() => state, { getState: () => state });
mock.module("@/stores/useSettings", () => ({ useSettings: store(settings), EDITOR_FONT_SIZE_DEFAULT: 16 }));
mock.module("@/stores/usePages", () => ({ usePages: store(pages) }));
mock.module("@/stores/useTabs", () => ({ useTabs: store(tabs) }));
mock.module("@/stores/useNotebooks", () => ({ useNotebooks: store({ activeNotebookId: "notebook", notebooks: { notebook: { source: "internal" } } }) }));
mock.module("@/stores/useSidebarView", () => ({ useSidebarView: store(sidebar) }));
mock.module("@/lib/setupGuide", () => ({ isSetupGuideVisible: () => false }));
mock.module("@/components/ui/sonner", () => ({ toast: { dismiss: record("dismiss-toast"), success: record("toast-success") } }));
mock.module("@/lib/tabMode", () => ({ effectiveSingleTabMode: () => false }));
mock.module("@/lib/electron/windowContext", () => ({ createDesktopWindow: record("new-window") }));
mock.module("@/lib/electron/runtime", () => ({ isElectronRuntime: () => true, getGooseDesktop: () => ({ closeWindow: record("close-window"), onCloseActiveTab: (callback: () => void) => { nativeClose = callback; return () => { nativeClose = undefined; }; } }) }));
mock.module("@/lib/closeAllOverlays", () => ({ closeAllOverlays: record("close-overlays") }));
mock.module("@/pages/workspace/components/notebook-ai/useNotebookAiPanel", () => ({ closeNotebookAiIfFullscreen: record("close-fullscreen-ai"), closeNotebookAiPanel: () => { calls.push("close-ai"); return false; } }));
mock.module("@/stores/useLocalFolderTargetPicker", () => ({ useLocalFolderTargetPicker: store({ openMovePicker: record("move-file") }) }));
mock.module("@/lib/local-folder-file-actions", () => ({ LOCAL_FOLDER_FILE_SHORTCUTS: { moveItem: "Mod+Shift+M", openInExternalApp: "Mod+Shift+O", revealInFileManager: "Mod+Shift+R", openInTerminal: "Mod+Shift+Y", copyFilePath: "Mod+Shift+C" }, hasCurrentLocalFolderPage: () => true, resolveCurrentLocalFolderPage: () => page, copyLocalFolderPagePath: record("file-action"), openLocalFolderPageInExternalApp: record("file-action"), openLocalFolderPageInTerminal: record("file-action"), revealLocalFolderPageInFileManager: record("file-action") }));
mock.module("@/lib/editor-split/commands", () => ({ closePaneOrTab: () => { calls.push("close-pane"); return "closed-pane"; }, focusNeighbor: record("split"), focusNextSplitPane: record("split"), focusPreviousSplitPane: record("split"), splitDown: record("split"), splitRight: record("split"), toggleZoom: record("split") }));
mock.module("@/pages/workspace/components/page/visibleTabs", () => ({ findLoneVisibleWorkspaceTab: () => tabs.openTabs[0] }));
mock.module("@/lib/page-delete-actions", () => ({ deletePageWithUndo: record("delete-page") }));
const { useAppHotkeys } = await import("../../src/hooks/useAppHotkeys");
const { useSidebarEffects } = await import("../../src/pages/workspace/components/sidebar/hooks/useSidebarEffects");
const { SettingsScaffold } = await import("../../src/pages/workspace/components/sidebar/settings/SettingsScaffold");

let root: Root | null = null;
let selectedTab: string | undefined;
function Effects() {
  useAppHotkeys();
  useSidebarEffects({ activeNotebookId: "notebook", currentView: "pages", onOpenSettings: tab => { selectedTab = tab; doc.body.setAttribute("data-goose-settings-open", ""); }, onSettingsTabChange: tab => { selectedTab = tab; } });
  return null;
}
function mount(element = createElement(Effects)) {
  const container = doc.createElement("div"); doc.body.append(container);
  root = createRoot(container);
  act(() => root!.render(element));
}
function event(type: string, properties: Record<string, unknown> = {}) {
  const event = new host.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, properties);
  return event;
}
function key(key: string, code = "", extra: Record<string, unknown> = {}) {
  const e = event("keydown", { key, code, ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, ...extra });
  act(() => doc.dispatchEvent(e));
  return e;
}
beforeEach(() => { calls.length = 0; selectedTab = undefined; doc.body.innerHTML = ""; doc.body.removeAttribute("data-goose-settings-open"); });
afterEach(() => { act(() => root?.unmount()); root = null; doc.body.innerHTML = ""; });
afterAll(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

describe("settings activation and shortcut boundary", () => {
  test("all categories open by event; legacy tab change remains valid; invalid IDs are ignored", () => {
    mount();
    for (const tab of ["appearance", "general", "shortcuts", "local-folder", "git-sync", "ai", "data"]) {
      act(() => host.dispatchEvent(new host.CustomEvent("goose-note:open-settings", { detail: { tab } })));
      expect(selectedTab).toBe(tab); expect(isSettingsTab(tab)).toBe(true);
    }
    act(() => host.dispatchEvent(new host.CustomEvent("goose-note:settings-tab-change", { detail: { tab: "shortcuts" } })));
    expect(selectedTab).toBe("shortcuts");
    act(() => host.dispatchEvent(new host.CustomEvent("goose-note:settings-tab-change", { detail: { tab: "about" } })));
    expect(selectedTab).toBe("shortcuts"); expect(isSettingsTab("about")).toBe(false);
  });
  test("settings blocks background file, split, find, formatting and delete actions", () => {
    mount(); doc.body.setAttribute("data-goose-settings-open", "");
    for (const [value, code, extra] of [["d", "KeyD", {}], ["f", "KeyF", {}], ["=", "Equal", {}], ["m", "KeyM", { shiftKey: true }]] as const) expect(key(value, code, extra).defaultPrevented).toBe(true);
    key("Backspace", "Backspace");
    expect(calls).toEqual([]);
    doc.body.removeAttribute("data-goose-settings-open"); key("Backspace", "Backspace"); expect(calls).toContain("delete-page");
  });
  test("ordinary settings text and shortcut recording are left to the focused control", () => {
    mount(); doc.body.setAttribute("data-goose-settings-open", "");
    const input = doc.createElement("input"); input.setAttribute("data-shortcut-recorder", ""); doc.body.append(input);
    const recorded = event("keydown", { key: "d", code: "KeyD", metaKey: true }); input.dispatchEvent(recorded);
    expect(recorded.defaultPrevented).toBe(false); expect(calls).toEqual([]);
    expect(key("a", "KeyA", { metaKey: false }).defaultPrevented).toBe(false);
  });
  test("explicit search/tab/new note/navigation exit; temporary sidebar toggle never persists preference", async () => {
    mount();
    let activations = 0, toggles = 0;
    const activate = () => { activations++; }; const toggle = () => { toggles++; };
    host.addEventListener("goose-note:workspace-activate", activate); host.addEventListener("goose-note:toggle-settings-sidebar", toggle);
    doc.body.setAttribute("data-goose-settings-open", "");
    key("b", "KeyB", { metaKey: false, altKey: true });
    expect(toggles).toBe(1); expect(calls).not.toContain("persist-sidebar");
    for (const [value, code] of [["t", "KeyT"], ["n", "KeyN"], ["k", "KeyK"], ["[", "BracketLeft"]]) key(value, code);
    await Promise.resolve();
    expect(activations).toBeGreaterThanOrEqual(4); expect(calls).toContain("create-page"); expect(calls).toContain("new-tab");
    const beforePassive = activations;
    host.dispatchEvent(new host.Event("focus")); host.dispatchEvent(new host.Event("blur"));
    expect(activations).toBe(beforePassive);
    activateWorkspace(host as unknown as Window); expect(activations).toBe(beforePassive + 1);
    host.removeEventListener("goose-note:workspace-activate", activate); host.removeEventListener("goose-note:toggle-settings-sidebar", toggle);
  });
  test("native Cmd+W closes child layer then settings before hidden AI/split/tab/window", () => {
    mount(); doc.body.setAttribute("data-goose-settings-open", "");
    let closedSettings = 0;
    const closeSettings = () => { closedSettings++; doc.body.removeAttribute("data-goose-settings-open"); };
    host.addEventListener("goose-note:close-settings", closeSettings);
    const menu = doc.createElement("div"); menu.setAttribute("role", "menu"); menu.setAttribute("data-state", "open"); doc.body.append(menu);
    menu.addEventListener("keydown", e => { e.preventDefault(); menu.remove(); });
    nativeClose?.(); expect(closedSettings).toBe(0); expect(calls).toEqual([]);
    nativeClose?.(); expect(closedSettings).toBe(1); expect(calls).toEqual([]);
    nativeClose?.(); expect(calls).toEqual(["close-ai", "close-pane"]);
    host.removeEventListener("goose-note:close-settings", closeSettings);
  });
  test("Escape closes settings once and IME or holding the key cannot expose hidden content", async () => {
    mount(); doc.body.setAttribute("data-goose-settings-open", "");
    let closedSettings = 0;
    const closeSettings = () => { closedSettings++; doc.body.removeAttribute("data-goose-settings-open"); };
    host.addEventListener("goose-note:close-settings", closeSettings);
    const fire = async (extra: Record<string, unknown> = {}) => {
      const e = event("keydown", { key: "Escape", code: "Escape", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra });
      host.dispatchEvent(e); await Promise.resolve();
    };
    await fire({ isComposing: true }); await fire({ keyCode: 229 }); await fire({ repeat: true });
    expect(closedSettings).toBe(0); expect(calls).toEqual([]);
    await fire(); expect(closedSettings).toBe(1); expect(calls).toEqual([]);
    await fire({ repeat: true }); expect(calls).toEqual([]);
    host.removeEventListener("goose-note:close-settings", closeSettings);
  });
  test("hotkey policy keeps navigation and settings actions, excludes all background tools", () => {
    for (const id of ["open-search", "new-note", "new-tab", "switch-tab-by-number", "cycle-tab", "reopen-tab", "toggle-ai-panel"]) { expect(isHotkeyAllowedInSettings(id)).toBe(true); expect(isWorkspaceNavigationHotkey(id)).toBe(true); }
    for (const id of ["split-right", "split-down", "split-zoom", "editor-find-open", "zoom-in", "move-local-folder-item", "copy-local-file-path"]) expect(isHotkeyAllowedInSettings(id)).toBe(false);
    for (const id of ["open-settings", "toggle-theme", "toggle-sidebar", "unified-close"]) { expect(isHotkeyAllowedInSettings(id)).toBe(true); expect(isWorkspaceNavigationHotkey(id)).toBe(false); }
  });
});

test("settings portals are visible only when open and retain draft DOM and category scroll", () => {
  const sidebarHost = doc.createElement("aside"), mainHost = doc.createElement("main"); doc.body.append(sidebarHost, mainHost);
  let selected = "appearance";
  const tabs = ["appearance", "shortcuts"].map(id => ({ id, label: id, icon: () => null }));
  const props = { activeTab: "appearance", onTabChange: (tab: string) => { selected = tab; }, onClose: () => {}, tabs, sidebarContainer: sidebarHost, mainContainer: mainHost, children: createElement("input", { defaultValue: "unsaved draft" }) };
  const render = (visible: boolean, activeTab = "appearance") => createElement(SettingsScaffold, { ...props, visible, activeTab } as never);
  mount(render(true));
  const navigation = sidebarHost.querySelector(".settings-sidebar-navigation")!, shell = mainHost.querySelector(".settings-shell")!, input = mainHost.querySelector("input")!, scroll = mainHost.querySelector(".settings-scroll")! as HTMLElement;
  expect(shell.classList.contains("workspace-shell")).toBe(false);
  input.value = "changed draft"; scroll.scrollTop = 120;
  act(() => (navigation.querySelectorAll("button")[1] as HTMLElement).click()); expect(selected).toBe("shortcuts");
  act(() => root!.render(render(true, "shortcuts"))); expect(scroll.scrollTop).toBe(0); scroll.scrollTop = 40;
  act(() => root!.render(render(false, "shortcuts")));
  expect(navigation.hasAttribute("hidden")).toBe(true); expect(navigation.hasAttribute("inert")).toBe(true); expect(shell.hasAttribute("hidden")).toBe(true); expect(shell.hasAttribute("inert")).toBe(true);
  act(() => root!.render(render(true, "appearance")));
  expect(scroll.scrollTop).toBe(120); expect(mainHost.querySelector("input")).toBe(input); expect(input.value).toBe("changed draft"); expect(shell.hasAttribute("hidden")).toBe(false); expect(navigation.hasAttribute("hidden")).toBe(false);
});
