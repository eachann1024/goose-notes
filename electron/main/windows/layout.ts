import { app, BrowserWindow, screen } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  clampBoundsToWorkArea,
  computeOffsetBounds,
  parseWindowLayout,
  serializeWindowLayout,
  windowLayoutFilePath,
  type QuicknoteLayout,
  type WindowBounds,
  type WindowLayout,
  type WindowTabSnapshot,
} from "../windowLayout";
import {
  MAIN_WIDTH,
  MAIN_HEIGHT,
  type CreateWorkspaceWindowOpts,
} from "./configuration";
import { appQuitting, getQuicknoteWindow } from "./registry";
import { registry, LAYOUT_PERSIST_DEBOUNCE_MS, windowState } from "./state";

export function layoutPath(): string {
  return windowLayoutFilePath(app.getPath("userData"));
}

export function readStoredLayout(): WindowLayout | null {
  try {
    return parseWindowLayout(readFileSync(layoutPath(), "utf8"));
  } catch {
    return null;
  }
}

export function readWindowBounds(win: BrowserWindow): WindowBounds {
  const raw =
    (win.isMaximized() || win.isFullScreen()) &&
    typeof win.getNormalBounds === "function"
      ? win.getNormalBounds()
      : win.getBounds();
  return { x: raw.x, y: raw.y, width: raw.width, height: raw.height };
}

export function readWindowChrome(win: BrowserWindow): {
  maximized?: boolean;
  fullScreen?: boolean;
} {
  return {
    ...(win.isMaximized() ? { maximized: true } : {}),
    ...(win.isFullScreen() ? { fullScreen: true } : {}),
  };
}

export function hydrateRememberedQuicknote(): QuicknoteLayout | null {
  if (windowState.rememberedQuicknote !== undefined)
    return windowState.rememberedQuicknote;
  windowState.rememberedQuicknote = readStoredLayout()?.quicknote ?? null;
  return windowState.rememberedQuicknote;
}

export function rememberQuicknoteFromWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  windowState.rememberedQuicknote = { bounds: readWindowBounds(win) };
}

export function persistWindowLayout(opts?: { evenIfQuitting?: boolean }): void {
  if (appQuitting() && !opts?.evenIfQuitting) return;
  try {
    const liveQuicknote = getQuicknoteWindow();
    if (liveQuicknote) rememberQuicknoteFromWindow(liveQuicknote);
    const layout = registry.snapshotLayout(
      (win) => {
        if (!win || win.isDestroyed()) return null;
        return readWindowBounds(win);
      },
      (win) => {
        if (!win || win.isDestroyed()) return null;
        return readWindowChrome(win);
      },
    );
    const quicknote = hydrateRememberedQuicknote();
    if (quicknote) layout.quicknote = quicknote;
    if (layout.windows.length === 0 && !layout.quicknote) return;
    mkdirSync(app.getPath("userData"), { recursive: true });
    writeFileSync(layoutPath(), serializeWindowLayout(layout));
  } catch {
    // ignore corrupt disk / first-run races
  }
}

export function schedulePersistLayout(): void {
  if (appQuitting()) return;
  if (windowState.persistTimer) clearTimeout(windowState.persistTimer);
  windowState.persistTimer = setTimeout(() => {
    windowState.persistTimer = null;
    persistWindowLayout();
  }, LAYOUT_PERSIST_DEBOUNCE_MS);
  windowState.persistTimer.unref();
}

export function allocWindowId(preferred?: string): string {
  if (preferred && !registry.has(preferred)) return preferred;
  return randomUUID();
}

export function workAreaNear(point: { x: number; y: number }): WindowBounds {
  const area = screen.getDisplayNearestPoint(point).workArea;
  return { x: area.x, y: area.y, width: area.width, height: area.height };
}

export function resolveCreateBounds(
  opts: CreateWorkspaceWindowOpts,
): Partial<WindowBounds> {
  const size = { width: MAIN_WIDTH, height: MAIN_HEIGHT };
  try {
    if (opts.bounds) {
      return clampBoundsToWorkArea(
        opts.bounds,
        workAreaNear({ x: opts.bounds.x, y: opts.bounds.y }),
      );
    }
    const source =
      opts.sourceWindow && !opts.sourceWindow.isDestroyed()
        ? opts.sourceWindow.getBounds()
        : null;
    if (!source) return size;
    return computeOffsetBounds(
      {
        x: source.x,
        y: source.y,
        width: source.width,
        height: source.height,
      },
      workAreaNear({ x: source.x, y: source.y }),
      size,
    );
  } catch {
    return size;
  }
}

export function sendWindowInit(
  win: BrowserWindow,
  payload: { takeTab?: WindowTabSnapshot; restoredTabs?: WindowTabSnapshot[] },
): void {
  const send = () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send("desktop:window-init", payload);
  };
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", send);
    return;
  }
  send();
}
