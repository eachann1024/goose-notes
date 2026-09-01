import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";
import { UI_FONT_SIZE_MAP } from "../../src/lib/appearance";
import {
  DEFAULT_TITLE_BAR_HEIGHT_PX,
  titleBarHeightPx,
  trafficLightPositionForTitleBar,
  TRAFFIC_LIGHT_SIZE_PX,
} from "../../src/lib/electron/titlebarLayout";

test("标准 14px 顶栏高度是 2.75rem，红绿灯 y 为按钮顶部而非中线", () => {
  const height = titleBarHeightPx(UI_FONT_SIZE_MAP.small);
  expect(height).toBe(38.5);
  expect(height).toBe(DEFAULT_TITLE_BAR_HEIGHT_PX);
  expect(trafficLightPositionForTitleBar(height)).toEqual({
    x: 16,
    y: Math.round((38.5 - TRAFFIC_LIGHT_SIZE_PX) / 2),
  });
  expect(trafficLightPositionForTitleBar(height).y).toBe(13);
});

test("放大 16px 顶栏高度是 44px，红绿灯垂直居中", () => {
  const height = titleBarHeightPx(UI_FONT_SIZE_MAP.normal);
  expect(height).toBe(44);
  expect(trafficLightPositionForTitleBar(height)).toEqual({ x: 16, y: 16 });
});

test("非法字号回退到标准顶栏高度", () => {
  expect(titleBarHeightPx(Number.NaN)).toBe(DEFAULT_TITLE_BAR_HEIGHT_PX);
  expect(titleBarHeightPx(0)).toBe(DEFAULT_TITLE_BAR_HEIGHT_PX);
  expect(trafficLightPositionForTitleBar(Number.NaN).y).toBe(13);
});

test("主进程按顶栏高度计算红绿灯，不再把 y 当成 44px 中线", () => {
  const windows = readFileSync(
    new URL("../../electron/main/windows.ts", import.meta.url),
    "utf8",
  );
  expect(windows).toContain("trafficLightPositionForTitleBar");
  expect(windows).toContain('titleBarStyle: "hidden"');
  expect(windows).not.toContain('titleBarStyle: "hiddenInset"');
  expect(windows).not.toContain("y: 22");
});
