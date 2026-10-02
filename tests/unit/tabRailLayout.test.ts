import { expect, test } from "playwright/test";
import {
  getTabRailLayoutMode,
  isTabRailTitleFieldTarget,
  shouldHandleTabActivationKey,
  tabRailItemClassName,
  tabRailListClassName,
  tabRailSelectionClassName,
} from "../../src/pages/workspace/components/page/tabRailLayout";

function mockTarget(closestMatch: string | null) {
  return {
    closest: (selector: string) => {
      const tokens = selector.split(",").map((part) => part.trim());
      return closestMatch && tokens.includes(closestMatch) ? {} : null;
    },
  };
}

test("单标签不显示强调色，多标签保留选中和悬停强调色", () => {
  expect(tabRailSelectionClassName(1, true)).toBe("text-foreground");
  expect(tabRailSelectionClassName(1, false)).toBe("text-foreground");
  expect(tabRailSelectionClassName(2, true)).toContain("bg-[var(--goose-interactive-selected)]");
  expect(tabRailSelectionClassName(2, false)).toContain("hover:bg-[var(--goose-interactive-hover)]");
});

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

test("Space/Enter 在普通 tab 上应激活", () => {
  const tab = mockTarget(null);
  expect(shouldHandleTabActivationKey("Enter", tab as EventTarget)).toBe(true);
  expect(shouldHandleTabActivationKey(" ", tab as EventTarget)).toBe(true);
});

test("Space/Enter 打在 title field 不应激活", () => {
  const titleField = mockTarget("input");
  expect(isTabRailTitleFieldTarget(titleField as EventTarget)).toBe(true);
  expect(shouldHandleTabActivationKey("Enter", titleField as EventTarget)).toBe(
    false,
  );
  expect(shouldHandleTabActivationKey(" ", titleField as EventTarget)).toBe(
    false,
  );
  expect(
    isTabRailTitleFieldTarget(mockTarget("[data-page-title-field]") as EventTarget),
  ).toBe(true);
});

test("其他键不激活 tab", () => {
  const tab = mockTarget(null);
  expect(shouldHandleTabActivationKey("ArrowLeft", tab as EventTarget)).toBe(
    false,
  );
  expect(shouldHandleTabActivationKey("a", tab as EventTarget)).toBe(false);
});
