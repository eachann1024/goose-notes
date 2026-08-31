import { BrowserWindow, type BrowserWindowConstructorOptions } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MAIN_WIDTH = 1250;
export const MAIN_HEIGHT = 800;
export const QUICKNOTE_WIDTH = 480;
export const QUICKNOTE_HEIGHT = 350;

/** DesktopTitleBar / HistoryToolbar 为 Tailwind h-11 = 44px（与先前 Tauri 顶栏一致）。 */
export const TITLE_BAR_HEIGHT = 44;
/** macOS 红绿灯约 12px。hiddenInset 下 y=16 仍贴顶，y 用视觉中线 22。 */
const TRAFFIC_LIGHT_POSITION = {
  x: 16,
  y: 22,
} as const;

let mainWindow: BrowserWindow | null = null;
let quicknoteWindow: BrowserWindow | null = null;

function preloadPath(): string {
  return path.join(__dirname, "../preload/index.cjs");
}

function rendererDevUrl(): string | null {
  const url = process.env.ELECTRON_RENDERER_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function rendererFile(name: "index.html" | "quicknote.html"): string {
  return path.join(__dirname, "../renderer", name);
}

function isDevRenderer(): boolean {
  return Boolean(rendererDevUrl());
}

const sharedWebPrefs = (): BrowserWindowConstructorOptions["webPreferences"] => ({
  preload: preloadPath(),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: false,
  // 正式包启用 V8 代码缓存；开发热更新不要 code cache。
  ...(isDevRenderer() ? {} : { v8CacheOptions: "code" as const }),
});

function applyTrafficLightPosition(win: BrowserWindow): void {
  if (process.platform !== "darwin" || win.isDestroyed()) return;
  win.setWindowButtonPosition({
    x: TRAFFIC_LIGHT_POSITION.x,
    y: TRAFFIC_LIGHT_POSITION.y,
  });
}

function setHiddenThrottle(win: BrowserWindow, hidden: boolean): void {
  if (win.isDestroyed()) return;
  // 隐藏窗节流；可见编辑器保持 Chromium 默认（前台不节流）。
  win.webContents.backgroundThrottling = hidden;
}

export function createMainWindow(): BrowserWindow {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    title: "Goose Note",
    width: MAIN_WIDTH,
    height: MAIN_HEIGHT,
    minWidth: 800,
    minHeight: 560,
    show: false,
    backgroundColor: "#ffffff",
    transparent: false,
    autoHideMenuBar: true,
    frame: true,
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: {
            x: TRAFFIC_LIGHT_POSITION.x,
            y: TRAFFIC_LIGHT_POSITION.y,
          },
        }
      : {}),
    webPreferences: sharedWebPrefs(),
  });

  applyTrafficLightPosition(win);

  win.once("ready-to-show", () => {
    applyTrafficLightPosition(win);
    setHiddenThrottle(win, false);
    win.show();
  });

  win.on("show", () => {
    applyTrafficLightPosition(win);
    setHiddenThrottle(win, false);
  });

  win.on("hide", () => {
    setHiddenThrottle(win, true);
  });

  win.on("leave-full-screen", () => {
    applyTrafficLightPosition(win);
  });

  win.on("close", (event) => {
    if (!appQuitting()) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  const devUrl = rendererDevUrl();
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(rendererFile("index.html"));
  }

  mainWindow = win;
  return win;
}

export function createQuicknoteWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: "速记",
    width: QUICKNOTE_WIDTH,
    height: QUICKNOTE_HEIGHT,
    minWidth: 320,
    minHeight: 240,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#ffffff",
    transparent: false,
    webPreferences: {
      ...sharedWebPrefs(),
      backgroundThrottling: true,
    },
  });

  win.on("show", () => {
    setHiddenThrottle(win, false);
  });

  win.on("hide", () => {
    setHiddenThrottle(win, true);
  });

  win.on("close", (event) => {
    if (!appQuitting()) {
      event.preventDefault();
      win.hide();
      setHiddenThrottle(win, true);
    }
  });

  win.on("closed", () => {
    if (quicknoteWindow === win) quicknoteWindow = null;
  });

  const devUrl = rendererDevUrl();
  if (devUrl) {
    void win.loadURL(`${devUrl}/quicknote.html`);
  } else {
    void win.loadFile(rendererFile("quicknote.html"));
  }

  quicknoteWindow = win;
  return win;
}

let quitting = false;
export function markQuitting(): void {
  quitting = true;
}
function appQuitting(): boolean {
  return quitting;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

export function getQuicknoteWindow(): BrowserWindow | null {
  return quicknoteWindow && !quicknoteWindow.isDestroyed() ? quicknoteWindow : null;
}

function waitReadyToShow(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed() || !win.webContents.isLoading()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    win.once("ready-to-show", done);
    win.webContents.once("did-finish-load", done);
  });
}

export type WindowToggleAction = "hide" | "focus" | "show";

export function resolveWindowToggleAction(state: {
  visible: boolean;
  focused: boolean;
}): WindowToggleAction {
  if (!state.visible) return "show";
  if (state.focused) return "hide";
  return "focus";
}

export async function toggleWindow(win: BrowserWindow | null): Promise<void> {
  if (!win || win.isDestroyed()) return;
  const visible = win.isVisible();
  const focused = visible && win.isFocused();
  const action = resolveWindowToggleAction({ visible, focused });
  if (action === "hide") {
    win.hide();
    setHiddenThrottle(win, true);
    return;
  }
  if (action === "show") {
    if (win.isMinimized()) win.restore();
    setHiddenThrottle(win, false);
    win.show();
  }
  win.focus();
}

/** 首次唤起才创建速记窗，避免启动就多一个 renderer。 */
export async function toggleQuicknoteWindow(): Promise<void> {
  let win = getQuicknoteWindow();
  if (!win) {
    win = createQuicknoteWindow();
    await waitReadyToShow(win);
    if (win.isDestroyed()) return;
    setHiddenThrottle(win, false);
    win.show();
    win.focus();
    return;
  }
  await toggleWindow(win);
}

export function hideQuicknote(): void {
  const win = getQuicknoteWindow();
  if (win && !win.isDestroyed()) {
    win.hide();
    setHiddenThrottle(win, true);
  }
}

export function broadcast(channel: string, payload: unknown): void {
  for (const win of [getMainWindow(), getQuicknoteWindow()]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}
