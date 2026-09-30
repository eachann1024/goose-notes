import { describe, expect, test } from "bun:test";
import { FIXED_SPLIT_SHORTCUTS, isReservedCloseOrSplitShortcut } from "../../src/lib/fixed-app-shortcuts";
import { createShortcutsSlice, normalizeFixedShortcutSettings, DEFAULT_APP_SHORTCUTS, type ShortcutsSlice } from "../../src/stores/settings/slices/shortcutsSlice";
import { migrateSettingsPersistedState } from "../../src/stores/settings/migrations";
import { formatShortcut } from "../../src/lib/utils";

describe("fixed close and split shortcuts", () => {
  test("migrates legacy values and conflicting bindings without mutating input", () => {
    const old = { closeTabShortcut: "Alt+W", searchPanelCloseShortcut: "MouseBack", appShortcuts: { splitRight: "Alt+D", closeSplitPane: "Mod+Q", navBack: "Ctrl+D", toggleSidebar: "Esc", toggleTheme: "Alt+L", newTab: "" }, desktop: { searchHotkey: "Mod+Shift+D", searchHotkeyEnabled: false } };
    const next = migrateSettingsPersistedState(old, 9);
    expect(next.closeTabShortcut).toBe("Escape");
    expect(next.searchPanelCloseShortcut).toBe("Escape");
    expect(next.appShortcuts).toMatchObject({ ...FIXED_SPLIT_SHORTCUTS, navBack: DEFAULT_APP_SHORTCUTS.navBack, toggleSidebar: DEFAULT_APP_SHORTCUTS.toggleSidebar, toggleTheme: "Alt+L", newTab: "" });
    expect(next.desktop).toMatchObject({ searchHotkey: "CmdOrCtrl+Shift+K", searchHotkeyEnabled: false });
    expect(old.appShortcuts.splitRight).toBe("Alt+D");
    expect(normalizeFixedShortcutSettings(next)).toEqual(next);
  });
  test("all actions reject changing fixed bindings or occupying reserved keys", () => {
    let state: ShortcutsSlice;
    state = createShortcutsSlice((update) => { state = { ...state, ...(typeof update === "function" ? update(state) : update) }; });
    for (const id of Object.keys(FIXED_SPLIT_SHORTCUTS)) state.setAppShortcut(id, "Alt+Q");
    state.setCloseTabShortcut("");
    state.setSearchPanelCloseShortcut("Alt+Q");
    expect(state.appShortcuts).toMatchObject(FIXED_SPLIT_SHORTCUTS);
    expect(state.closeTabShortcut).toBe("Escape");
    expect(state.searchPanelCloseShortcut).toBe("Escape");
    for (const value of ["Esc", "Mod+W", ...Object.values(FIXED_SPLIT_SHORTCUTS).filter(Boolean)]) {
      state.setAppShortcut("navBack", value);
      state.setSearchHotkey(value);
      expect(state.appShortcuts.navBack).toBe(DEFAULT_APP_SHORTCUTS.navBack);
      expect(state.desktop.searchHotkey).toBe("CmdOrCtrl+Shift+K");
    }
    state.setAppShortcut("navBack", "MouseBack");
    expect(state.appShortcuts.navBack).toBe("MouseBack");
  });
  test("platform aliases reserve the displayed fixed bindings", () => {
    expect(isReservedCloseOrSplitShortcut("Command+D", "mac")).toBe(true);
    expect(isReservedCloseOrSplitShortcut("Ctrl+D", "windows")).toBe(true);
    expect(isReservedCloseOrSplitShortcut("Control+Shift+D", "linux")).toBe(true);
    expect(isReservedCloseOrSplitShortcut("", "mac")).toBe(false);
    expect(formatShortcut(FIXED_SPLIT_SHORTCUTS.splitRight, "mac")).toBe("⌘D");
    expect(formatShortcut(FIXED_SPLIT_SHORTCUTS.splitRight, "windows")).toBe("Ctrl + D");
  });
});

test("UI and runtime share fixed bindings; no close or split recorder remains", async () => {
  const settings = await Bun.file("src/pages/workspace/components/sidebar/settings/SettingsShortcuts.tsx").text();
  expect(settings).toContain('title="分屏快捷键（固定）"');
  expect(settings).toContain('title="关闭行为（固定）"');
  expect(settings).not.toContain('id="shortcut-split-');
  expect(settings).not.toContain('id="close-tab-shortcut"');
  expect(settings).not.toContain('id="search-panel-close-shortcut"');
  const hook = await Bun.file("src/hooks/useAppHotkeys.ts").text();
  expect(hook).not.toContain("closeTabShortcutRef");
  expect(hook).not.toContain("appShortcutsRef.current.split");
  expect(hook).toContain('isElectronRuntime() && matchShortcut(event, "Mod+W")');
  const ordered = hook.slice(hook.indexOf("const runUnifiedClose"), hook.indexOf("const createNewNoteFromHotkey"));
  expect(ordered.indexOf("toast.dismiss()")).toBeLessThan(ordered.indexOf("const dialogEl"));
  expect(ordered.indexOf("const dialogEl")).toBeLessThan(ordered.indexOf("closePaneOrTab()"));
  expect(ordered.indexOf("closePaneOrTab()")).toBeLessThan(ordered.indexOf(".closeTab(activeId)"));
});
