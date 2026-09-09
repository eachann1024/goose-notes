import { screen, type BrowserWindow } from "electron";
import { computeWindowDragOrigin } from "../../src/lib/electron/windowDrag";

const TICK_MS = 16;

type DragLoop = {
  timer: ReturnType<typeof setInterval>;
};

const loops = new WeakMap<BrowserWindow, DragLoop>();
const hooked = new WeakSet<BrowserWindow>();

function hookWindowCleanup(win: BrowserWindow): void {
  if (hooked.has(win)) return;
  hooked.add(win);
  win.on("closed", () => {
    endWindowMove(win);
  });
}

export function endWindowMove(win: BrowserWindow | null): void {
  if (!win) return;
  const loop = loops.get(win);
  if (!loop) return;
  clearInterval(loop.timer);
  loops.delete(win);
}

export function startWindowMove(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  endWindowMove(win);
  hookWindowCleanup(win);

  const [originX, originY] = win.getPosition();
  const press = screen.getCursorScreenPoint();
  const origin = { x: originX, y: originY };

  const tick = () => {
    if (win.isDestroyed()) {
      endWindowMove(win);
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const next = computeWindowDragOrigin(origin, press, cursor);
    win.setPosition(Math.round(next.x), Math.round(next.y));
  };

  const timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  loops.set(win, { timer });
}
