import { expect, test } from "@playwright/test";
import {
  adjacentInlineCodeTextIndex,
  edgeGraphemeLength,
  heldInlineCodeBoundaryArrowAction,
  isSingleGrapheme,
  isTwoGraphemes,
  resolveHeldInlineCodeBoundary,
} from "../../src/components/editor/extensions/inlineCodeBoundaryNavigationExtension";

test("只在左移一步即可到达行内代码起点时接管光标", () => {
  expect(isSingleGrapheme("1")).toBe(true);
  expect(isSingleGrapheme("中")).toBe(true);
  expect(isSingleGrapheme("😀")).toBe(true);
  expect(isSingleGrapheme("12")).toBe(false);
  expect(isSingleGrapheme("")).toBe(false);
});

test("识别首字符前一步的预备位置", () => {
  expect(isTwoGraphemes("py")).toBe(true);
  expect(isTwoGraphemes("中😀")).toBe(true);
  expect(isTwoGraphemes("p")).toBe(false);
  expect(isTwoGraphemes("pyt")).toBe(false);
});

test("从左右边界返回代码内时按完整字素移动", () => {
  expect(edgeGraphemeLength("Agent", "start")).toBe(1);
  expect(edgeGraphemeLength("Agent", "end")).toBe(1);
  expect(edgeGraphemeLength("😀Agent🚀", "start")).toBe(2);
  expect(edgeGraphemeLength("😀Agent🚀", "end")).toBe(2);
});

test("行内代码边界保持精确的两步方向键语义", () => {
  expect(heldInlineCodeBoundaryArrowAction("end", "inside", "right")).toBe(
    "to-outside",
  );
  expect(heldInlineCodeBoundaryArrowAction("end", "outside", "right")).toBe(
    "advance",
  );
  expect(heldInlineCodeBoundaryArrowAction("end", "outside", "left")).toBe(
    "to-inside",
  );
  expect(heldInlineCodeBoundaryArrowAction("end", "inside", "left")).toBe(
    "enter",
  );
  expect(heldInlineCodeBoundaryArrowAction("start", "inside", "left")).toBe(
    "exit",
  );
  expect(heldInlineCodeBoundaryArrowAction("start", "inside", "right")).toBe(
    "enter",
  );
});

test("旧内核重映射文档位置后仍可通过真实 DOM 末端退出 code", () => {
  expect(
    resolveHeldInlineCodeBoundary(
      { edge: "end", phase: "inside", pos: 12 },
      "end",
      "inside",
      "end",
      13,
    ),
  ).toEqual({ edge: "end", phase: "inside", pos: 12 });

  expect(
    resolveHeldInlineCodeBoundary(null, "end", "inside", "end", 13),
  ).toEqual({ edge: "end", phase: "inside", pos: 13 });

  expect(
    resolveHeldInlineCodeBoundary(
      { edge: "end", phase: "inside", pos: 12 },
      "end",
      "inside",
      "start",
      13,
    ),
  ).toBeNull();
});

test("退出 code 时落到相邻正文，不越过首字符", () => {
  expect(adjacentInlineCodeTextIndex([1], 3, "after")).toBe(2);
  expect(adjacentInlineCodeTextIndex([1], 3, "before")).toBe(0);
  expect(adjacentInlineCodeTextIndex([0], 1, "after")).toBeNull();
  expect(adjacentInlineCodeTextIndex([0], 1, "before")).toBeNull();
});
