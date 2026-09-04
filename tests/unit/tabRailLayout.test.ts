import { expect, test } from "playwright/test";
import {
  getTabRailLayoutMode,
  tabRailItemClassName,
  tabRailListClassName,
} from "../../src/pages/workspace/components/page/tabRailLayout";

test("1 个标签占满，不要 max-w-[120px]", () => {
  expect(getTabRailLayoutMode(1)).toBe("fill");
  expect(tabRailItemClassName(1)).toContain("flex-1");
  expect(tabRailItemClassName(1)).not.toContain("max-w-[120px]");
  expect(tabRailItemClassName(0)).toContain("flex-1");
});

test("2–3 个标签等分 flex 1 1 0", () => {
  expect(getTabRailLayoutMode(2)).toBe("split");
  expect(getTabRailLayoutMode(3)).toBe("split");
  expect(tabRailItemClassName(2)).toContain("flex-[1_1_0]");
  expect(tabRailItemClassName(3)).toContain("flex-[1_1_0]");
  expect(tabRailListClassName(2)).not.toContain("overflow-x-auto");
});

test("4 个及以上 min-width 140px 并横向滚动", () => {
  expect(getTabRailLayoutMode(4)).toBe("scroll");
  expect(tabRailItemClassName(4)).toContain("min-w-[140px]");
  expect(tabRailListClassName(4)).toContain("overflow-x-auto");
});
