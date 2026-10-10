import { BrowserWindow } from "electron";
import {
  clampBoundsToWorkArea,
  MIN_QUICKNOTE_HEIGHT,
  MIN_QUICKNOTE_WIDTH,
  type WindowBounds,
} from "../windowLayout";
import {
  QUICKNOTE_WIDTH,
  QUICKNOTE_HEIGHT,
  rendererDevUrl,
  rendererFile,
  framelessWindowIcon,
  windowWebPrefs,
  setHiddenThrottle,
  denyWindowOpenHandler,
} from "./configuration";
import {
  notifyBrowserWindowCreated,
  emitVisibilityChange,
  markQuicknoteActivateSuppressed,
} from "./visibility";
import {
  hydrateRememberedQuicknote,
  rememberQuicknoteFromWindow,
  persistWindowLayout,
  schedulePersistLayout,
  allocWindowId,
  workAreaNear,
} from "./layout";
import { appQuitting, getQuicknoteWindow } from "./registry";
import { bindCloseTabAccelerator } from "./close";
import { registry, QUICKNOTE_IDLE_DESTROY_MS, windowState } from "./state";

export function clearQuicknoteDestroyTimer(): void {
  if (!windowState.quicknoteDestroyTimer) return;
  clearTimeout(windowState.quicknoteDestroyTimer);
  windowState.quicknoteDestroyTimer = null;
}

export function scheduleQuicknoteIdleDestroy(win: BrowserWindow): void {
  clearQuicknoteDestroyTimer();
  if (win.isDestroyed() || appQuitting()) return;
  const timer = setTimeout(() => {
    windowState.quicknoteDestroyTimer = null;
    if (appQuitting()) return;
    if (win.isDestroyed()) return;
    if (win.isVisible()) return;
    win.destroy();
  }, QUICKNOTE_IDLE_DESTROY_MS);
  timer.unref();
  windowState.quicknoteDestroyTimer = timer;
}

export function resolveQuicknoteBounds(): Partial<WindowBounds> {
  const stored = hydrateRememberedQuicknote();
  if (!stored) {
    return { width: QUICKNOTE_WIDTH, height: QUICKNOTE_HEIGHT };
  }
  try {
    return clampBoundsToWorkArea(
      stored.bounds,
      workAreaNear({ x: stored.bounds.x, y: stored.bounds.y }),
      { width: MIN_QUICKNOTE_WIDTH, height: MIN_QUICKNOTE_HEIGHT },
    );
  } catch {
    return { width: QUICKNOTE_WIDTH, height: QUICKNOTE_HEIGHT };
  }
}

export function createQuicknoteWindow(): BrowserWindow {
  const existing = getQuicknoteWindow();
  if (existing) return existing;

  const id = allocWindowId();
  const isMac = process.platform === "darwin";
  const bounds = resolveQuicknoteBounds();
  const win = new BrowserWindow({
    title: "速记",
    width: bounds.width ?? QUICKNOTE_WIDTH,
    height: bounds.height ?? QUICKNOTE_HEIGHT,
    ...(bounds.x != null && bounds.y != null
      ? { x: bounds.x, y: bounds.y }
      : {}),
    minWidth: MIN_QUICKNOTE_WIDTH,
    minHeight: MIN_QUICKNOTE_HEIGHT,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#ffffff",
    transparent: false,
    ...(framelessWindowIcon() ? { icon: framelessWindowIcon() } : {}),
    // panel 浮在当前空间，show 时不激活整个应用，避免把已 hide 的 workspace 一起放出来。
    ...(isMac
      ? {
          type: "panel" as const,
          hiddenInMissionControl: true,
        }
      : {}),
    webPreferences: {
      ...windowWebPrefs(id, "quicknote"),
      backgroundThrottling: true,
    },
  });
  if (isMac) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "floating");
  }

  registry.register({ id, kind: "quicknote", win });
  denyWindowOpenHandler(win);
  bindCloseTabAccelerator(win);
  notifyBrowserWindowCreated(win, "quicknote");

  win.on("show", () => {
    clearQuicknoteDestroyTimer();
    setHiddenThrottle(win, false);
    emitVisibilityChange();
  });

  win.on("moved", () => {
    rememberQuicknoteFromWindow(win);
    schedulePersistLayout();
  });
  win.on("resized", () => {
    rememberQuicknoteFromWindow(win);
    schedulePersistLayout();
  });

  win.on("hide", () => {
    if (!appQuitting()) markQuicknoteActivateSuppressed();
    rememberQuicknoteFromWindow(win);
    persistWindowLayout();
    setHiddenThrottle(win, true);
    scheduleQuicknoteIdleDestroy(win);
    emitVisibilityChange();
  });

  win.on("blur", () => {
    setHiddenThrottle(win, true);
    emitVisibilityChange();
  });

  win.on("focus", () => {
    setHiddenThrottle(win, false);
    emitVisibilityChange();
  });

  win.on("close", () => {
    if (!appQuitting()) markQuicknoteActivateSuppressed();
    rememberQuicknoteFromWindow(win);
    persistWindowLayout({ evenIfQuitting: true });
  });

  win.on("closed", () => {
    registry.unregister(id);
    clearQuicknoteDestroyTimer();
    emitVisibilityChange();
  });

  const devUrl = rendererDevUrl();
  if (devUrl) {
    void win.loadURL(`${devUrl}/quicknote.html`);
  } else {
    void win.loadFile(rendererFile("quicknote.html"));
  }

  return win;
}
