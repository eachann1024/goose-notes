import { expect, test } from "playwright/test";
import { resolveWindowToggleAction } from "../../src/lib/electron/windowToggle";

test("window toggle shows a hidden window", () => {
  expect(resolveWindowToggleAction({ visible: false, focused: false })).toBe(
    "show",
  );
  expect(resolveWindowToggleAction({ visible: false, focused: true })).toBe(
    "show",
  );
});

test("window toggle hides a visible and focused window", () => {
  expect(resolveWindowToggleAction({ visible: true, focused: true })).toBe(
    "hide",
  );
});

test("window toggle focuses a visible but unfocused window", () => {
  expect(resolveWindowToggleAction({ visible: true, focused: false })).toBe(
    "focus",
  );
});
