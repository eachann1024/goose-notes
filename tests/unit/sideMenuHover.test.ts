import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import {
  HEADING_SIDE_MENU_EXTRA_GAP,
  SIDE_MENU_CONTENT_GAP,
  TABLE_SIDE_MENU_INSET,
  isEditorSideMenuHoverTarget,
  isPointerInSideMenuCorridor,
  isTableSideMenuUiTarget,
} from "../../src/components/editor/core/sideMenuHover";

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

test("表格行把手和扩展按钮也算 hover，避免从格子移向侧栏时先卸掉", () => {
  expect(
    isEditorSideMenuHoverTarget(
      mockTarget(".goose-table-handle-btn") as EventTarget,
    ),
  ).toBe(true);
  expect(
    isEditorSideMenuHoverTarget(mockTarget(".bn-table-handle") as EventTarget),
  ).toBe(true);
  expect(
    isEditorSideMenuHoverTarget(
      mockTarget(".goose-table-extend-button") as EventTarget,
    ),
  ).toBe(true);
  expect(
    isTableSideMenuUiTarget(mockTarget(".goose-table-handle-btn") as EventTarget),
  ).toBe(true);
  expect(
    isTableSideMenuUiTarget(mockTarget(".bn-editor") as EventTarget),
  ).toBe(false);
  expect(
    isEditorSideMenuHoverTarget(mockTarget(".page-scroll-container") as EventTarget),
  ).toBe(false);
});

test("几何走廊覆盖块全高和表格左内边距，从任意行横移仍算 hover", () => {
  const table = { left: 100, top: 40, height: 160 };
  expect(
    isPointerInSideMenuCorridor(97, 50, table, SIDE_MENU_CONTENT_GAP),
  ).toBe(true);
  expect(
    isPointerInSideMenuCorridor(
      104,
      170,
      table,
      SIDE_MENU_CONTENT_GAP,
      TABLE_SIDE_MENU_INSET,
    ),
  ).toBe(true);
  expect(
    isPointerInSideMenuCorridor(90, 80, table, SIDE_MENU_CONTENT_GAP),
  ).toBe(false);
  expect(
    isPointerInSideMenuCorridor(97, 220, table, SIDE_MENU_CONTENT_GAP),
  ).toBe(false);
  expect(isPointerInSideMenuCorridor(97, 80, undefined, SIDE_MENU_CONTENT_GAP)).toBe(
    false,
  );
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
  expect(source).toContain("isPointerInSideMenuCorridor");
  expect(source).toContain("isTableSideMenuUiTarget");
  expect(source).toContain("keepWhileHidden");
  expect(source).toContain("hoveringEditor || isDragging");
  expect(source).toContain("onContextMenu={(e) => {");
  expect(source).toContain("e.preventDefault()");
  expect(source).toContain("e.stopPropagation()");
  expect(css).toContain(".bn-side-menu::after");
  expect(css).toContain("left: 100%");
  expect(css).toContain('.bn-side-menu[data-heading-gutter="true"]::after');
  expect(SIDE_MENU_CONTENT_GAP).toBe(6);
  expect(HEADING_SIDE_MENU_EXTRA_GAP).toBe(8);
  expect(TABLE_SIDE_MENU_INSET).toBe(9);
});
