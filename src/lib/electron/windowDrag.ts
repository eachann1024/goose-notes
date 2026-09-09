/**
 * Electron 顶栏：按住拖动窗口，单击才进入标题编辑。
 *
 * 控件保持 data-electron-no-drag；位移超过阈值后走 startWindowDrag IPC，
 * 避免 CSS -webkit-app-region: drag 吞掉单击。
 */
import { getGooseDesktop } from "./runtime";

export const TITLE_WINDOW_DRAG_THRESHOLD_PX = 4;
export const WINDOW_DRAGGING_CLASS = "window-dragging";

function setWindowDraggingCursor(on: boolean): void {
  const root =
    typeof document === "undefined" ? null : document.documentElement;
  root?.classList.toggle(WINDOW_DRAGGING_CLASS, on);
}

export type WindowPoint = { x: number; y: number };

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

/** 按下时窗口原点 + 按下/当前屏幕坐标 → 新窗口左上角。 */
export function computeWindowDragOrigin(
  windowOrigin: WindowPoint,
  pressScreen: WindowPoint,
  currentScreen: WindowPoint,
): WindowPoint {
  return {
    x: windowOrigin.x + (currentScreen.x - pressScreen.x),
    y: windowOrigin.y + (currentScreen.y - pressScreen.y),
  };
}

function isElectronHost(): boolean {
  return typeof __HOST_TARGET__ === "undefined" || __HOST_TARGET__ === "electron";
}

export async function startWindowDragging(): Promise<void> {
  if (!isElectronHost()) return;
  setWindowDraggingCursor(true);
  await getGooseDesktop()?.startWindowDrag?.();
}

export async function endWindowDragging(): Promise<void> {
  if (!isElectronHost()) return;
  setWindowDraggingCursor(false);
  await getGooseDesktop()?.endWindowDrag?.();
}

type IdleDragPointer = {
  button: number;
  clientX: number;
  clientY: number;
  pointerId: number;
  currentTarget: {
    setPointerCapture?: (pointerId: number) => void;
  };
};

/** 阈值内当单击；越过阈值后开始拖窗，抬起时结束。 */
export function bindIdleWindowDrag(
  event: IdleDragPointer,
  startedRef: { current: boolean },
): void {
  if (event.button !== 0) return;
  startedRef.current = false;
  event.currentTarget.setPointerCapture?.(event.pointerId);

  const startX = event.clientX;
  const startY = event.clientY;

  const onMove = (ev: PointerEvent) => {
    if (startedRef.current) return;
    if (!shouldStartWindowDrag(startX, startY, ev.clientX, ev.clientY)) return;
    startedRef.current = true;
    window.removeEventListener("pointermove", onMove);
    void startWindowDragging();
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (startedRef.current) void endWindowDragging();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
