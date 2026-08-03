import { expect, test } from "playwright/test";
import { findNonOverlappingToolbarPosition } from "../../src/components/editor/utils/formattingToolbarPosition";
import { getColorPanelPosition } from "../../src/components/editor/toolbars/formatting/ColorPicker";

const boundary = {
  top: 8,
  right: 792,
  bottom: 592,
  left: 8,
  width: 784,
  height: 584,
};

test("formatting toolbar stays below the complete selection when space allows", () => {
  expect(
    findNonOverlappingToolbarPosition({
      reference: {
        top: 100,
        right: 500,
        bottom: 180,
        left: 200,
        width: 300,
        height: 80,
      },
      floating: { width: 320, height: 40 },
      boundary,
      preferredSide: "bottom",
      gap: 16,
    }),
  ).toEqual({ x: 190, y: 196 });
});

test("formatting toolbar flips above instead of overlapping a bottom selection", () => {
  expect(
    findNonOverlappingToolbarPosition({
      reference: {
        top: 520,
        right: 500,
        bottom: 580,
        left: 200,
        width: 300,
        height: 60,
      },
      floating: { width: 320, height: 40 },
      boundary,
      preferredSide: "bottom",
      gap: 16,
    }),
  ).toEqual({ x: 190, y: 464 });
});

test("formatting toolbar uses a side fallback for a tall Windows selection", () => {
  expect(
    findNonOverlappingToolbarPosition({
      reference: {
        top: 20,
        right: 420,
        bottom: 580,
        left: 220,
        width: 200,
        height: 560,
      },
      floating: { width: 160, height: 40 },
      boundary,
      preferredSide: "bottom",
      gap: 16,
    }),
  ).toEqual({ x: 436, y: 280 });
});

test("formatting toolbar hides when no non-overlapping position is reachable", () => {
  expect(
    findNonOverlappingToolbarPosition({
      reference: {
        top: 8,
        right: 792,
        bottom: 592,
        left: 8,
        width: 784,
        height: 584,
      },
      floating: { width: 320, height: 40 },
      boundary,
      preferredSide: "bottom",
      gap: 16,
    }),
  ).toBeNull();
});

test("color panel stays centered on its trigger in viewport coordinates", () => {
  expect(
    getColorPanelPosition({
      trigger: { top: 104, right: 279, bottom: 143, left: 240, width: 39 },
      panelWidth: 246,
      panelHeight: 270,
      viewportWidth: 914,
      viewportHeight: 480,
      gap: 12,
    }),
  ).toEqual({ top: 155, left: 259.5, showAbove: false });
});

test("color panel clamps to the viewport instead of shifting its anchor", () => {
  expect(
    getColorPanelPosition({
      trigger: { top: 300, right: 40, bottom: 326, left: 14, width: 26 },
      panelWidth: 220,
      panelHeight: 180,
      viewportWidth: 800,
      viewportHeight: 600,
      gap: 8,
    }),
  ).toEqual({ top: 292, left: 118, showAbove: true });
});

test("color panel opens above a bottom-docked quicknote toolbar trigger", () => {
  // 速记小窗底栏：触发器贴底，下方几乎没空间；必须向上展开完整色板。
  expect(
    getColorPanelPosition({
      trigger: { top: 410, right: 180, bottom: 438, left: 152, width: 28 },
      panelWidth: 172,
      panelHeight: 190,
      viewportWidth: 360,
      viewportHeight: 480,
      gap: 8,
    }),
  ).toEqual({ top: 402, left: 166, showAbove: true });
});
