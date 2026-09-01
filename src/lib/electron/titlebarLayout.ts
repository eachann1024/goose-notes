/**
 * Electron macOS 顶栏几何：web 顶栏高度随界面字号（标准 14 / 放大 16）变化，
 * 红绿灯 y 是按钮顶部偏移，不是视觉中线。
 */

/** Tailwind `h-11` = 2.75rem。 */
export const TITLE_BAR_HEIGHT_REM = 2.75;

/** macOS 红绿灯直径约 12px。 */
export const TRAFFIC_LIGHT_SIZE_PX = 12;

export const TRAFFIC_LIGHT_X_PX = 16;

/** 默认「标准」界面：14px × 2.75rem。 */
export const DEFAULT_TITLE_BAR_HEIGHT_PX = 14 * TITLE_BAR_HEIGHT_REM;

export function titleBarHeightPx(uiFontSizePx: number): number {
  const size =
    Number.isFinite(uiFontSizePx) && uiFontSizePx > 0 ? uiFontSizePx : 14;
  return size * TITLE_BAR_HEIGHT_REM;
}

export function trafficLightPositionForTitleBar(titleBarHeightPx: number): {
  x: number;
  y: number;
} {
  const height =
    Number.isFinite(titleBarHeightPx) && titleBarHeightPx > 0
      ? titleBarHeightPx
      : DEFAULT_TITLE_BAR_HEIGHT_PX;
  return {
    x: TRAFFIC_LIGHT_X_PX,
    y: Math.max(0, Math.round((height - TRAFFIC_LIGHT_SIZE_PX) / 2)),
  };
}
