import { expect, test } from "playwright/test";
import {
  canDragTabBetweenWindows,
  dockHitRect,
  insertIndexFromTabRects,
  insertLineLeft,
  pointInRect,
  resolveTabDrag,
  TAB_DOCK_SLOP_PX,
  tabDragEnabled,
  tearOffWindowBounds,
  TEAR_OFF_MARGIN_PX,
} from "../../src/lib/electron/tabTearOff";

const source = {
  id: "a",
  outerBounds: { x: 100, y: 80, width: 1250, height: 800 },
  contentBounds: { x: 100, y: 80, width: 1250, height: 800 },
};
const target = {
  id: "b",
  outerBounds: { x: 1400, y: 80, width: 1250, height: 800 },
  contentBounds: { x: 1400, y: 80, width: 1250, height: 800 },
};
const titleBarHeight = 38.5;

test("拖到另一窗口顶栏则 dock，contentX 相对目标内容区", () => {
  const hit = dockHitRect(
    target.outerBounds,
    target.contentBounds,
    titleBarHeight,
  );
  expect(hit.y).toBe(80);
  expect(hit.height).toBe(titleBarHeight + TAB_DOCK_SLOP_PX);
  expect(pointInRect({ x: 1500, y: 90 }, hit)).toBe(true);

  expect(
    resolveTabDrag({
      sourceWindowId: "a",
      sourceTabCount: 1,
      cursor: { x: 1500, y: 90 },
      surfaces: [source, target],
      titleBarHeight,
    }),
  ).toEqual({ action: "dock", targetWindowId: "b", contentX: 100 });
});

test("单标签拖出空白处不撕窗；两标签才 tearOff", () => {
  const far = { x: 40, y: 40 };
  expect(
    resolveTabDrag({
      sourceWindowId: "a",
      sourceTabCount: 1,
      cursor: far,
      surfaces: [source, target],
      titleBarHeight,
    }),
  ).toEqual({ action: "none" });
  expect(
    resolveTabDrag({
      sourceWindowId: "a",
      sourceTabCount: 2,
      cursor: far,
      surfaces: [source, target],
      titleBarHeight,
    }),
  ).toEqual({ action: "tearOff" });
});

test("源窗边框内（含撕离余量）保持 none，交给窗内排序", () => {
  expect(
    resolveTabDrag({
      sourceWindowId: "a",
      sourceTabCount: 3,
      cursor: { x: 120, y: 100 },
      surfaces: [source, target],
      titleBarHeight,
    }),
  ).toEqual({ action: "none" });
  expect(
    resolveTabDrag({
      sourceWindowId: "a",
      sourceTabCount: 3,
      cursor: {
        x: source.outerBounds.x - TEAR_OFF_MARGIN_PX + 1,
        y: source.outerBounds.y + 10,
      },
      surfaces: [source, target],
      titleBarHeight,
    }),
  ).toEqual({ action: "none" });
});

test("Windows 原生标题栏也算拼接命中区", () => {
  const framed = {
    id: "b",
    outerBounds: { x: 1400, y: 40, width: 1250, height: 840 },
    contentBounds: { x: 1408, y: 72, width: 1234, height: 800 },
  };
  const hit = dockHitRect(
    framed.outerBounds,
    framed.contentBounds,
    titleBarHeight,
  );
  expect(hit.y).toBe(40);
  expect(hit.height).toBe(32 + titleBarHeight + TAB_DOCK_SLOP_PX);
  expect(
    resolveTabDrag({
      sourceWindowId: "a",
      sourceTabCount: 1,
      cursor: { x: 1500, y: 50 },
      surfaces: [source, framed],
      titleBarHeight,
    }).action,
  ).toBe("dock");
});

test("插入下标按中线左右，固定标签只在左侧区段", () => {
  const rects = [
    { left: 0, width: 100, pinned: true },
    { left: 108, width: 100, pinned: false },
    { left: 216, width: 100, pinned: false },
  ];
  expect(insertIndexFromTabRects(rects, 40, false)).toBe(1);
  expect(insertIndexFromTabRects(rects, 170, false)).toBe(2);
  expect(insertIndexFromTabRects(rects, 300, false)).toBe(3);
  expect(insertIndexFromTabRects(rects, 20, true)).toBe(0);
  expect(insertIndexFromTabRects(rects, 80, true)).toBe(1);
  expect(insertLineLeft(rects, 0)).toBe(0);
  expect(insertLineLeft(rects, 2)).toBe(216);
  expect(insertLineLeft(rects, 3)).toBe(316);
});

test("撕离窗出现在指针下方，沿用源窗尺寸", () => {
  expect(
    tearOffWindowBounds({
      cursor: { x: 500, y: 200 },
      source: source.outerBounds,
      grabOffsetX: 60,
      titleBarHeight: 40,
    }),
  ).toEqual({
    x: 440,
    y: 180,
    width: 1250,
    height: 800,
  });
});

test("只有一项时禁止拖动标签，至少两项才可拖", () => {
  expect(
    canDragTabBetweenWindows({
      isElectron: true,
      variant: "electron-titlebar",
    }),
  ).toBe(true);
  expect(
    tabDragEnabled({
      isElectron: true,
      variant: "electron-titlebar",
      tabCount: 1,
    }),
  ).toBe(false);
  expect(
    tabDragEnabled({
      isElectron: false,
      variant: "page-header",
      tabCount: 1,
    }),
  ).toBe(false);
  expect(
    tabDragEnabled({
      isElectron: true,
      variant: "electron-titlebar",
      tabCount: 2,
    }),
  ).toBe(true);
  expect(
    tabDragEnabled({
      isElectron: false,
      variant: "page-header",
      tabCount: 2,
    }),
  ).toBe(true);
});
