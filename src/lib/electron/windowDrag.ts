/**
 * Electron 顶栏：按住拖动窗口，单击才进入标题编辑。
 *
 * 整条顶栏用 -webkit-app-region: drag；可点击控件用 no-drag。
 * 标题闲置态位移超过阈值再尝试拖动（Electron 无 startDragging IPC，
 * 实际拖动依赖 CSS drag region 的空白区域）。
 */
export const TITLE_WINDOW_DRAG_THRESHOLD_PX = 4;

export function shouldStartWindowDrag(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  thresholdPx = TITLE_WINDOW_DRAG_THRESHOLD_PX,
): boolean {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return dx * dx + dy * dy >= thresholdPx * thresholdPx;
}

export async function startWindowDragging(): Promise<void> {
  if (__HOST_TARGET__ !== "electron") return;
  // 预加载契约不含 startDragging；窗口拖动走 CSS -webkit-app-region。
}
