import { expect, test } from "playwright/test";
import { effectiveSingleTabMode } from "../../src/lib/tabMode";

test("Electron 跟随 singleTabMode", () => {
  expect(effectiveSingleTabMode(true, false)).toBe(true);
  expect(effectiveSingleTabMode(false, false)).toBe(false);
});

test("Electron 下 effectiveSingleTabMode 恒为 false", () => {
  expect(effectiveSingleTabMode(true, true)).toBe(false);
  expect(effectiveSingleTabMode(false, true)).toBe(false);
});
