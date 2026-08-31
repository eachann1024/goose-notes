import { expect, test } from "playwright/test";
import {
  DEFAULT_QUICKNOTE_HOTKEY,
  DEFAULT_WAKE_HOTKEY,
  mergeDesktopSettings,
} from "../../src/stores/settings/types";

test("undefined stored desktop settings fall back to default hotkeys", () => {
  const merged = mergeDesktopSettings(undefined);
  expect(merged.wakeHotkey).toBe(DEFAULT_WAKE_HOTKEY);
  expect(merged.wakeHotkeyEnabled).toBe(true);
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
  expect(merged.quicknoteHotkey).toBe(DEFAULT_QUICKNOTE_HOTKEY);
  expect(merged.quicknoteHotkeyEnabled).toBe(true);
  expect(merged.quicknoteHotkeyStatus.state).toBe("idle");
});
