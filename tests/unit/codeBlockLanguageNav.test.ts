import { expect, test } from "playwright/test";
import {
  defaultLanguageHighlightIndex,
  moveLanguageHighlightIndex,
} from "../../src/components/editor/blocks/code/codeBlockLanguageNav";

test("搜索时默认选中第一项", () => {
  expect(
    defaultLanguageHighlightIndex(["python", "php", "perl"], "p", "javascript"),
  ).toBe(0);
});

test("无搜索时对准当前语言", () => {
  expect(
    defaultLanguageHighlightIndex(
      ["javascript", "typescript", "python"],
      "",
      "python",
    ),
  ).toBe(2);
});

test("无搜索且当前语言不在列表里时回落到第一项", () => {
  expect(
    defaultLanguageHighlightIndex(["javascript", "python"], "  ", "rust"),
  ).toBe(0);
});

test("上下键循环移动高亮", () => {
  expect(moveLanguageHighlightIndex(0, 3, 1)).toBe(1);
  expect(moveLanguageHighlightIndex(2, 3, 1)).toBe(0);
  expect(moveLanguageHighlightIndex(0, 3, -1)).toBe(2);
  expect(moveLanguageHighlightIndex(1, 3, -1)).toBe(0);
});

test("空列表和越界下标也能安全移动", () => {
  expect(moveLanguageHighlightIndex(0, 0, 1)).toBe(0);
  expect(moveLanguageHighlightIndex(9, 3, 1)).toBe(0);
});
