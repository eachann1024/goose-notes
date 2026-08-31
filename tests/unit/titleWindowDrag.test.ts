import { expect, test } from "playwright/test";
import { shouldStartWindowDrag } from "../../src/lib/electron/windowDrag";

test("title pointer stays a click within the drag threshold", () => {
  expect(shouldStartWindowDrag(10, 10, 12, 11)).toBe(false);
  expect(shouldStartWindowDrag(0, 0, 3, 2)).toBe(false);
});

test("title pointer becomes a window drag once movement crosses the threshold", () => {
  expect(shouldStartWindowDrag(10, 10, 14, 10)).toBe(true);
  expect(shouldStartWindowDrag(0, 0, 0, 5)).toBe(true);
});
