import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { isEditorSideMenuHoverTarget } from "../../src/components/editor/core/sideMenuHover";

function mockTarget(closestMatch: string | null) {
  return {
    closest: (selector: string) => {
      const tokens = selector.split(",").map((part) => part.trim());
      return closestMatch && tokens.includes(closestMatch) ? {} : null;
    },
  };
}

test("左右 gutter 不弹出把手，只有编辑器内容或已出现的把手才算 hover", () => {
  expect(isEditorSideMenuHoverTarget(null)).toBe(false);
  expect(isEditorSideMenuHoverTarget(mockTarget(null) as EventTarget)).toBe(
    false,
  );
  expect(
    isEditorSideMenuHoverTarget(mockTarget(".bn-editor") as EventTarget),
  ).toBe(true);
  expect(
    isEditorSideMenuHoverTarget(mockTarget(".bn-side-menu") as EventTarget),
  ).toBe(true);
  expect(
    isEditorSideMenuHoverTarget({
      parentElement: mockTarget(".bn-editor"),
    } as EventTarget),
  ).toBe(true);
});

test("SideMenu 用 hover 判定挡住 BlockNote 的左右 250px 吸附", () => {
  const source = readFileSync(
    new URL("../../src/components/editor/core/EditorSideMenu.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL(
      "../../src/pages/workspace/styles/editor-base/shell.css",
      import.meta.url,
    ),
    "utf8",
  );
  expect(source).toContain("isEditorSideMenuHoverTarget");
  expect(source).toContain("hoveringEditor || isDragging");
  expect(css).toContain(".bn-side-menu::after");
  expect(css).toContain("left: 100%");
});
