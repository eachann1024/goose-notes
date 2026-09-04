import { expect, test } from "playwright/test";
import { isPrimaryModW } from "../../electron/main/closeTabAccelerator";

const cmdW = {
  type: "keyDown",
  key: "w",
  code: "KeyW",
  meta: true,
  control: false,
  alt: false,
  shift: false,
};

test("macOS 只认 ⌘W，不认 Ctrl+W 或 Shift", () => {
  expect(isPrimaryModW(cmdW, "darwin")).toBe(true);
  expect(isPrimaryModW({ ...cmdW, type: "keyUp" }, "darwin")).toBe(false);
  expect(isPrimaryModW({ ...cmdW, control: true }, "darwin")).toBe(false);
  expect(isPrimaryModW({ ...cmdW, meta: false, control: true }, "darwin")).toBe(
    false,
  );
  expect(isPrimaryModW({ ...cmdW, shift: true }, "darwin")).toBe(false);
  expect(isPrimaryModW({ ...cmdW, alt: true }, "darwin")).toBe(false);
});

test("Windows/Linux 只认 Ctrl+W", () => {
  const ctrlW = { ...cmdW, meta: false, control: true };
  expect(isPrimaryModW(ctrlW, "win32")).toBe(true);
  expect(isPrimaryModW(ctrlW, "linux")).toBe(true);
  expect(isPrimaryModW(cmdW, "win32")).toBe(false);
  expect(isPrimaryModW({ ...ctrlW, shift: true }, "win32")).toBe(false);
});
