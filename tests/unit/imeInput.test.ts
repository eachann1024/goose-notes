import { expect, test } from "playwright/test";
import {
  isDuplicateCompositionEndChange,
  isImeKeyboardEvent,
} from "../../src/hooks/useImeInput";

test("IME keyboard detection covers modern and legacy Chromium events", () => {
  expect(isImeKeyboardEvent({ isComposing: true })).toBe(true);
  expect(isImeKeyboardEvent({ keyCode: 229 })).toBe(true);
  expect(isImeKeyboardEvent({ which: 229 })).toBe(true);
  expect(isImeKeyboardEvent({ isComposing: false, keyCode: 13 })).toBe(false);
});

test("the duplicate change after compositionend is ignored only for the same value", () => {
  expect(isDuplicateCompositionEndChange("阿斯加德", "阿斯加德")).toBe(true);
  expect(isDuplicateCompositionEndChange("阿斯加德", "阿斯加德快乐")).toBe(
    false,
  );
  expect(isDuplicateCompositionEndChange(null, "阿斯加德")).toBe(false);
});
