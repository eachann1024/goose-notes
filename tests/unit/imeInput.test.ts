import { expect, test } from "playwright/test";
import {
  isDuplicateCompositionEndChange,
  isImeKeyboardEvent,
  shouldSkipAppHotkeyEvent,
} from "../../src/hooks/useImeInput";

test("IME keyboard detection covers modern and legacy Chromium events", () => {
  expect(isImeKeyboardEvent({ isComposing: true })).toBe(true);
  expect(isImeKeyboardEvent({ keyCode: 229 })).toBe(true);
  expect(isImeKeyboardEvent({ which: 229 })).toBe(true);
  expect(isImeKeyboardEvent({ isComposing: false, keyCode: 13 })).toBe(false);
});

test("global hotkeys ignore IME and repeated actions unless navigation opts in", () => {
  expect(shouldSkipAppHotkeyEvent({ isComposing: true })).toBe(true);
  expect(shouldSkipAppHotkeyEvent({ keyCode: 229 })).toBe(true);
  expect(shouldSkipAppHotkeyEvent({ which: 229 })).toBe(true);
  expect(shouldSkipAppHotkeyEvent({ repeat: true })).toBe(true);
  expect(shouldSkipAppHotkeyEvent({ repeat: true }, true)).toBe(false);
  expect(shouldSkipAppHotkeyEvent({ repeat: false })).toBe(false);
});

test("the duplicate change after compositionend is ignored only for the same value", () => {
  expect(isDuplicateCompositionEndChange("阿斯加德", "阿斯加德")).toBe(true);
  expect(isDuplicateCompositionEndChange("阿斯加德", "阿斯加德快乐")).toBe(
    false,
  );
  expect(isDuplicateCompositionEndChange(null, "阿斯加德")).toBe(false);
});
