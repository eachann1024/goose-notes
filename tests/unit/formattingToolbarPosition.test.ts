import { expect, test } from "playwright/test";
import { findNonOverlappingToolbarPosition } from "../../src/components/editor/utils/formattingToolbarPosition";

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
