import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { migrateSettingsPersistedState } from "../../src/stores/settings/migrations";
import {
  DEFAULT_QUICKNOTE_HOTKEY,
  DEFAULT_SEARCH_HOTKEY,
  DEFAULT_WAKE_HOTKEY,
  LEGACY_DEFAULT_QUICKNOTE_HOTKEY,
  mergeDesktopSettings,
} from "../../src/stores/settings/types";

test("undefined stored desktop settings fall back to default hotkeys", () => {
  expect(DEFAULT_SEARCH_HOTKEY).toBe("CmdOrCtrl+Shift+K");
  expect(DEFAULT_QUICKNOTE_HOTKEY).toBe("Alt+N");
  const merged = mergeDesktopSettings(undefined);
  expect(merged.wakeHotkey).toBe(DEFAULT_WAKE_HOTKEY);
  expect(merged.wakeHotkeyEnabled).toBe(true);
  expect(merged.searchHotkey).toBe(DEFAULT_SEARCH_HOTKEY);
  expect(merged.searchHotkeyEnabled).toBe(true);
  expect(merged.quicknoteHotkey).toBe(DEFAULT_QUICKNOTE_HOTKEY);
  expect(merged.quicknoteHotkeyEnabled).toBe(true);
});

test("legacy archive without quicknote fields keeps the stored wake hotkey", () => {
  const merged = mergeDesktopSettings({
    wakeHotkey: "CmdOrCtrl+Shift+N",
    wakeHotkeyEnabled: false,
  });
  expect(merged.wakeHotkey).toBe("CmdOrCtrl+Shift+N");
  expect(merged.wakeHotkeyEnabled).toBe(false);
  expect(merged.searchHotkey).toBe(DEFAULT_SEARCH_HOTKEY);
  expect(merged.searchHotkeyEnabled).toBe(true);
  expect(merged.quicknoteHotkey).toBe(DEFAULT_QUICKNOTE_HOTKEY);
  expect(merged.quicknoteHotkeyEnabled).toBe(true);
  expect(merged.quicknoteHotkeyStatus.state).toBe("idle");
  expect(merged.searchHotkeyStatus.state).toBe("idle");
});

for (const version of [0, 1, 2, 3, 4]) {
  test(`v${version} migrates the old quicknote default to Option/Alt+N`, () => {
    const stored = {
      desktop: {
        quicknoteHotkey: LEGACY_DEFAULT_QUICKNOTE_HOTKEY,
        quicknoteHotkeyEnabled: false,
      },
    };
    expect(migrateSettingsPersistedState(stored, version)).toMatchObject({
      desktop: {
        quicknoteHotkey: DEFAULT_QUICKNOTE_HOTKEY,
        quicknoteHotkeyEnabled: false,
      },
    });
    expect(stored.desktop.quicknoteHotkey).toBe(LEGACY_DEFAULT_QUICKNOTE_HOTKEY);
  });
}

test("quicknote migration preserves custom shortcuts and already-updated settings", () => {
  for (const shortcut of ["", "Alt+Q", DEFAULT_QUICKNOTE_HOTKEY]) {
    const stored = {
      desktop: { quicknoteHotkey: shortcut, quicknoteHotkeyEnabled: false },
    };
    expect(migrateSettingsPersistedState(stored, 4)).toMatchObject(stored);
  }
  const current = {
    desktop: { quicknoteHotkey: LEGACY_DEFAULT_QUICKNOTE_HOTKEY },
  };
  expect(migrateSettingsPersistedState(current, 5)).toMatchObject(current);
});

test("main process registers Option/Alt+N before settings hydrate", () => {
  const main = readFileSync(
    new URL("../../electron/main/index.ts", import.meta.url),
    "utf8",
  );
  expect(main).toContain('const DEFAULT_QUICKNOTE = "Alt+N"');
  expect(main).not.toContain('"CmdOrCtrl+Alt+Q"');
});
