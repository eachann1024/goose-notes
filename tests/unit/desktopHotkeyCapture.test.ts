import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import {
  isShortcutRecorderTarget,
  shouldResumeGlobalHotkeysAfterFocusOut,
} from "../../src/lib/electron/hotkeyCapture";

test("non-element targets never pause or resume global hotkeys", () => {
  expect(isShortcutRecorderTarget(null)).toBe(false);
  expect(isShortcutRecorderTarget({})).toBe(false);
  expect(shouldResumeGlobalHotkeysAfterFocusOut(null, null)).toBe(false);
  expect(shouldResumeGlobalHotkeysAfterFocusOut({}, null)).toBe(false);
});

test("Electron recorder focus unregisters global shortcuts so the input can capture keys", () => {
  const hook = readFileSync(
    new URL("../../src/hooks/useDesktopHotkeys.ts", import.meta.url),
    "utf8",
  );
  expect(hook).toContain("pauseHotkeys");
  expect(hook).toContain("resumeHotkeys");
  expect(hook).toContain("isShortcutRecorderTarget");
  expect(hook).toContain("shouldResumeGlobalHotkeysAfterFocusOut");
});

test("macOS packaged Info.plist explains global hotkey permissions", () => {
  const packer = readFileSync(
    new URL("../../scripts/prepare-electron-pack.mjs", import.meta.url),
    "utf8",
  );
  const builderYml = readFileSync(
    new URL("../../electron-builder.yml", import.meta.url),
    "utf8",
  );
  for (const source of [packer, builderYml]) {
    expect(source).toContain("NSAppleEventsUsageDescription");
    expect(source).toContain("NSAccessibilityUsageDescription");
  }
});

test("settings desktop hotkeys card can open Accessibility settings", () => {
  const settings = readFileSync(
    new URL(
      "../../src/pages/workspace/components/sidebar/settings/SettingsShortcuts.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(settings).toContain("getAccessibilityStatus");
  expect(settings).toContain("requestAccessibility");
  expect(settings).toContain("打开系统设置");
});
