import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { resolveWindowToggleAction, shouldRaiseMainWindow } from "../../src/lib/electron/windowToggle";

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

test("已前台的主窗不必再 raise", () => {
  expect(
    shouldRaiseMainWindow({
      visible: true,
      minimized: false,
      focused: true,
    }),
  ).toBe(false);
});

test("隐藏、最小化或未聚焦的主窗需要 raise", () => {
  expect(
    shouldRaiseMainWindow({
      visible: false,
      minimized: false,
      focused: false,
    }),
  ).toBe(true);
  expect(
    shouldRaiseMainWindow({
      visible: true,
      minimized: true,
      focused: false,
    }),
  ).toBe(true);
  expect(
    shouldRaiseMainWindow({
      visible: true,
      minimized: false,
      focused: false,
    }),
  ).toBe(true);
});

test("速记快捷键使用可见性二态切换且不复用主窗三态逻辑", () => {
  const source = readFileSync(
    new URL("../../electron/main/windows.ts", import.meta.url),
    "utf8",
  );
  const quicknoteToggle = source.slice(
    source.indexOf("export async function toggleQuicknoteWindow"),
    source.indexOf("export function hideQuicknote"),
  );

  expect(source).toContain("function raiseWindow");
  expect(source).toContain("app.focus({ steal: true })");
  expect(quicknoteToggle).toContain("if (win.isVisible())");
  expect(quicknoteToggle).toContain("hideQuicknote();");
  expect(quicknoteToggle).toContain("raiseWindow(win);");
  expect(quicknoteToggle).not.toContain("toggleWindow(win)");
});
