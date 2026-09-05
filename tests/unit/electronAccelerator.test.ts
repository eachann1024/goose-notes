import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import {
  electronAcceleratorAliases,
  electronAcceleratorsMatch,
  toElectronAccelerator,
} from "../../src/lib/electron/accelerator";
import {
  DEFAULT_QUICKNOTE_HOTKEY,
  DEFAULT_SEARCH_HOTKEY,
  DEFAULT_WAKE_HOTKEY,
} from "../../src/stores/settings/types";

test("default desktop hotkeys convert to Electron accelerators", () => {
  expect(toElectronAccelerator(DEFAULT_WAKE_HOTKEY)).toBe(
    "CommandOrControl+Alt+N",
  );
  expect(toElectronAccelerator(DEFAULT_QUICKNOTE_HOTKEY)).toBe(
    "CommandOrControl+Alt+Q",
  );
  expect(toElectronAccelerator(DEFAULT_SEARCH_HOTKEY)).toBe(
    "CommandOrControl+Shift+K",
  );
  expect(toElectronAccelerator("Mod+Alt+N")).toBe("CommandOrControl+Alt+N");
  expect(toElectronAccelerator("Meta+Alt+N")).toBe("Command+Alt+N");
});

test("CommandOrControl aliases match so a second register of the same default is a no-op", () => {
  expect(
    electronAcceleratorsMatch(
      "CommandOrControl+Alt+N",
      "CmdOrCtrl+Alt+N",
      "darwin",
    ),
  ).toBe(true);
  expect(
    electronAcceleratorsMatch("Command+Alt+N", "CommandOrControl+Alt+N", "darwin"),
  ).toBe(true);
  expect(
    electronAcceleratorsMatch(
      "Control+Alt+N",
      "CommandOrControl+Alt+N",
      "win32",
    ),
  ).toBe(true);
  expect(
    electronAcceleratorsMatch("CommandOrControl+Alt+N", "CommandOrControl+Alt+Q"),
  ).toBe(false);
  expect(electronAcceleratorAliases("CommandOrControl+K", "darwin")).toEqual([
    "CommandOrControl+K",
    "CmdOrCtrl+K",
    "Command+K",
  ]);
});

test("main process keeps an already-registered accelerator instead of unregistering it", () => {
  const source = readFileSync(
    new URL("../../electron/main/hotkeys.ts", import.meta.url),
    "utf8",
  );
  expect(source).toContain("electronAcceleratorsMatch");
  expect(source).toContain("tryRegisterAccelerator");
  expect(source).toContain("键没变就别卸");
});
