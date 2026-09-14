import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { migrateSettingsPersistedState } from "../../src/stores/settings/migrations";
import { createShortcutsSlice, DEFAULT_APP_SHORTCUTS, type ShortcutsSlice } from "../../src/stores/settings/slices/shortcutsSlice";
import { DEFAULT_SEARCH_HOTKEY } from "../../src/stores/settings/types";
import { syncAllDesktopGlobalHotkeys } from "../../src/lib/electron/globalHotkeys";

test("search defaults have separate scopes and independent disable/edit actions", () => {
  let state: ShortcutsSlice;
  state = createShortcutsSlice((update) => {
    state = { ...state, ...(typeof update === "function" ? update(state) : update) };
  });
  expect(DEFAULT_APP_SHORTCUTS.openSearch).toBe("Mod+K");
  expect(DEFAULT_SEARCH_HOTKEY).toBe("CmdOrCtrl+Shift+K");
  state.setAppShortcut("openSearch", "");
  expect(state.desktop.searchHotkeyEnabled).toBe(true);
  state.setSearchHotkeyEnabled(false);
  state.setAppShortcut("openSearch", "Alt+K");
  expect(state.desktop.searchHotkeyEnabled).toBe(false);
  state.setSearchHotkey("Mod+Alt+K");
  state.setSearchHotkeyEnabled(true);
  expect(state.appShortcuts.openSearch).toBe("Alt+K");
  expect(state.desktop.searchHotkey).toBe("Mod+Alt+K");
});

for (const version of [0, 1, 2, 3]) {
  test(`v${version} migrates only the old global default without enabling it`, () => {
    const stored = { appShortcuts: { openSearch: "" }, desktop: { searchHotkey: "CmdOrCtrl+K", searchHotkeyEnabled: false } };
    expect(migrateSettingsPersistedState(stored, version)).toMatchObject({
      appShortcuts: { openSearch: "" },
      desktop: { searchHotkey: DEFAULT_SEARCH_HOTKEY, searchHotkeyEnabled: false },
    });
    expect(stored.desktop.searchHotkey).toBe("CmdOrCtrl+K");
  });
}

test("migration preserves custom, disabled and already split settings", () => {
  for (const shortcut of ["", "Mod+Alt+K", "CmdOrCtrl+Shift+K"]) {
    const stored = { appShortcuts: { openSearch: "Mod+Shift+K" }, desktop: { searchHotkey: shortcut, searchHotkeyEnabled: false } };
    expect(migrateSettingsPersistedState(stored, 3)).toMatchObject(stored);
  }
  const current = { desktop: { searchHotkey: "CmdOrCtrl+K" } };
  expect(migrateSettingsPersistedState(current, 4)).toMatchObject(current);
});

test("desktop synchronization submits disabled, edited and failed search independently", async () => {
  const requests: unknown[] = [];
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let searchOk = true;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    gooseDesktop: { registerHotkeys: async (request: unknown) => {
      requests.push(request);
      return { wakeOk: true, quicknoteOk: true, searchOk };
    } },
  } });
  try {
    const input = { wake: { shortcut: "", enabled: false }, quicknote: { shortcut: "", enabled: false }, search: { shortcut: DEFAULT_SEARCH_HOTKEY, enabled: true } };
    expect((await syncAllDesktopGlobalHotkeys(input)).search.ok).toBe(true);
    expect(requests.at(-1)).toEqual({ wake: "", quicknote: "", search: DEFAULT_SEARCH_HOTKEY });
    await syncAllDesktopGlobalHotkeys({ ...input, search: { ...input.search, enabled: false } });
    expect(requests.at(-1)).toEqual({ wake: "", quicknote: "", search: "" });
    searchOk = false;
    expect((await syncAllDesktopGlobalHotkeys({ ...input, search: { shortcut: "Mod+Alt+K", enabled: true } })).search.state).toBe("occupied");
    expect(requests.at(-1)).toEqual({ wake: "", quicknote: "", search: "Mod+Alt+K" });
    expect((await syncAllDesktopGlobalHotkeys({ ...input, search: { shortcut: "", enabled: true } })).search.ok).toBe(true);
    expect(requests.at(-1)).toEqual({ wake: "", quicknote: "", search: "" });
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("search waits for hydration at startup and remains a focus/open action", () => {
  const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const main = source("../../electron/main/index.ts");
  expect(main).toMatch(/registerHotkeys\(\{[\s\S]*?search: ""/);
  expect(main).not.toContain('"CmdOrCtrl+K"');
  const hook = source("../../src/hooks/useDesktopHotkeys.ts");
  expect(hook).toContain('if (__HOST_TARGET__ !== "electron" || !hydrated) return;');
  expect(hook).toContain('return api.onOpenSearch(');
  const hotkeys = source("../../electron/main/hotkeys.ts");
  const searchAction = hotkeys.slice(hotkeys.indexOf('searchOk: bindSlot("search"'), hotkeys.indexOf("export function registerHotkeys"));
  expect(searchAction).toContain('dispatchRegisteredGlobalHotkey("search")');
  expect(searchAction).not.toContain("toggleWindow");
  expect(hotkeys).toContain("showOrCreateMainWindow");
  expect(hotkeys).toContain('"desktop:open-search"');
  expect(hotkeys).toContain("before-input-event");
  expect(source("../../src/stores/settings/index.ts")).toContain("version: 4");
});
