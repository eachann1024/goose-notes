import {
  app,
  BrowserWindow,
  screen,
  shell,
  type BrowserWindowConstructorOptions,
} from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TITLE_BAR_HEIGHT_PX,
  trafficLightPositionForTitleBar,
} from "../../src/lib/electron/titlebarLayout";
import {
  resolveWindowToggleAction,
  shouldRaiseMainWindow,
} from "../../src/lib/electron/windowToggle";
import { gooseWindowAdditionalArguments } from "../../src/lib/electron/windowContext";
import { bindOpenMarkdownWindow } from "./openMarkdownFiles";
import {
  clampBoundsToWorkArea,
  computeOffsetBounds,
  DEFAULT_WORKSPACE_HEIGHT,
  DEFAULT_WORKSPACE_WIDTH,
  parseWindowLayout,
  serializeWindowLayout,
  windowLayoutFilePath,
  type WindowBounds,
  type WindowLayout,
  type WindowTabSnapshot,
} from "./windowLayout";
import {
  CLOSE_ACTIVE_TAB_CHANNEL,
  isPrimaryModW,
} from "./closeTabAccelerator";
import {
  shouldHideInsteadOfClose,
  WindowRegistry,
} from "./windowRegistry";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MAIN_WIDTH = DEFAULT_WORKSPACE_WIDTH;
export const MAIN_HEIGHT = DEFAULT_WORKSPACE_HEIGHT;
export const QUICKNOTE_WIDTH = 480;
export const QUICKNOTE_HEIGHT = 350;

/** DesktopTitleBar 为 Tailwind h-11 = 2.75rem，随界面字号（标准 14 / 放大 16）变化。 */
export const TITLE_BAR_HEIGHT = DEFAULT_TITLE_BAR_HEIGHT_PX;

export type CreateWorkspaceWindowOpts = {
  mode: "blank" | "currentTab";
  windowId?: string;
  tab?: WindowTabSnapshot;
  bounds?: WindowBounds;
  restoredTabs?: WindowTabSnapshot[];
  sourceWindow?: BrowserWindow | null;
};

let lastTitleBarHeight = DEFAULT_TITLE_BAR_HEIGHT_PX;
const registry = new WindowRegistry<BrowserWindow>();
let persistTimer: NodeJS.Timeout | null = null;
let quicknoteDestroyTimer: NodeJS.Timeout | null = null;
const QUICKNOTE_IDLE_DESTROY_MS = 5 * 60 * 1000;
const LAYOUT_PERSIST_DEBOUNCE_MS = 300;

const visibilityListeners = new Set<() => void>();
let lastEmittedVisible = false;

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

function windowWebPrefs(
  windowId: string,
  kind: "workspace" | "quicknote",
): BrowserWindowConstructorOptions["webPreferences"] {
  return {
    ...sharedWebPrefs(),
    additionalArguments: gooseWindowAdditionalArguments(windowId, kind),
  };
}

function trafficLightPosition(): { x: number; y: number } {
  return trafficLightPositionForTitleBar(lastTitleBarHeight);
}

function applyTrafficLightPosition(win: BrowserWindow): void {
  if (process.platform !== "darwin" || win.isDestroyed()) return;
  win.setWindowButtonPosition(trafficLightPosition());
}

/** 渲染进程在界面字号变化后同步顶栏高度，红绿灯按新高度垂直居中。 */
export function setMainWindowTitleBarHeight(
  win: BrowserWindow,
  height: number,
): void {
  if (!Number.isFinite(height) || height < 24 || height > 96) return;
  lastTitleBarHeight = height;
  applyTrafficLightPosition(win);
}

function setHiddenThrottle(win: BrowserWindow, hidden: boolean): void {
  if (win.isDestroyed()) return;
  // 隐藏窗节流；可见编辑器保持 Chromium 默认（前台不节流）。
  win.webContents.backgroundThrottling = hidden;
}

function windowIsForeground(win: BrowserWindow | null): boolean {
  if (!win || win.isDestroyed()) return false;
  return win.isVisible() && !win.isMinimized() && win.isFocused();
}

function emitVisibilityChange(): void {
  const visible = hasVisibleWindow();
  if (visible === lastEmittedVisible) return;
  lastEmittedVisible = visible;
  for (const listener of visibilityListeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

export function hasVisibleWindow(): boolean {
  for (const record of registry.all()) {
    if (windowIsForeground(record.win)) return true;
  }
  return false;
}

export function onWindowVisibilityChange(listener: () => void): () => void {
  visibilityListeners.add(listener);
  return () => {
    visibilityListeners.delete(listener);
  };
}

function clearQuicknoteDestroyTimer(): void {
  if (!quicknoteDestroyTimer) return;
  clearTimeout(quicknoteDestroyTimer);
  quicknoteDestroyTimer = null;
}

function scheduleQuicknoteIdleDestroy(win: BrowserWindow): void {
  clearQuicknoteDestroyTimer();
  if (win.isDestroyed() || appQuitting()) return;
  const timer = setTimeout(() => {
    quicknoteDestroyTimer = null;
    if (appQuitting()) return;
    if (win.isDestroyed()) return;
    if (win.isVisible()) return;
    win.destroy();
  }, QUICKNOTE_IDLE_DESTROY_MS);
  timer.unref();
  quicknoteDestroyTimer = timer;
}

function isExternalHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function denyWindowOpenHandler(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

function layoutPath(): string {
  return windowLayoutFilePath(app.getPath("userData"));
}

function readStoredLayout(): WindowLayout | null {
  try {
    return parseWindowLayout(readFileSync(layoutPath(), "utf8"));
  } catch {
    return null;
  }
}

export function persistWindowLayout(opts?: { evenIfQuitting?: boolean }): void {
  if (appQuitting() && !opts?.evenIfQuitting) return;
  try {
    const layout = registry.snapshotLayout((win) => {
      if (!win || win.isDestroyed()) return null;
      const bounds = win.getBounds();
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    });
    if (layout.windows.length === 0) return;
    mkdirSync(app.getPath("userData"), { recursive: true });
    writeFileSync(layoutPath(), serializeWindowLayout(layout));
  } catch {
    // ignore corrupt disk / first-run races
  }
}

function schedulePersistLayout(): void {
  if (appQuitting()) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistWindowLayout();
  }, LAYOUT_PERSIST_DEBOUNCE_MS);
  persistTimer.unref();
}

function allocWindowId(preferred?: string): string {
  if (preferred && !registry.has(preferred)) return preferred;
  return randomUUID();
}

function workAreaNear(point: { x: number; y: number }): WindowBounds {
  const area = screen.getDisplayNearestPoint(point).workArea;
  return { x: area.x, y: area.y, width: area.width, height: area.height };
}

function resolveCreateBounds(opts: CreateWorkspaceWindowOpts): Partial<WindowBounds> {
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

function sendWindowInit(
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

/** Cmd/Ctrl+W：工作区关当前标签；速记小窗仍走 close（隐藏）。绝不把关标签当成关窗。 */
export function requestCloseActiveTab(
  win: BrowserWindow | null | undefined,
): void {
  if (!win || win.isDestroyed()) return;
  const context = lookupWindowContext(win);
  if (context?.kind === "quicknote") {
    win.close();
    return;
  }
  if (win.webContents.isDestroyed()) return;
  win.webContents.send(CLOSE_ACTIVE_TAB_CHANNEL);
}

function bindCloseTabAccelerator(win: BrowserWindow): void {
  win.webContents.on("before-input-event", (event, input) => {
    if (win.webContents.isDevToolsFocused()) return;
    if (!isPrimaryModW(input)) return;
    event.preventDefault();
    requestCloseActiveTab(win);
  });
}

function attachWorkspaceChrome(win: BrowserWindow, id: string): void {
  applyTrafficLightPosition(win);
  denyWindowOpenHandler(win);
  bindOpenMarkdownWindow(win);
  bindCloseTabAccelerator(win);

  win.once("ready-to-show", () => {
    applyTrafficLightPosition(win);
    setHiddenThrottle(win, false);
    win.show();
  });

  win.on("show", () => {
    applyTrafficLightPosition(win);
    setHiddenThrottle(win, false);
    emitVisibilityChange();
  });

  win.on("hide", () => {
    setHiddenThrottle(win, true);
    emitVisibilityChange();
  });

  win.on("blur", () => {
    setHiddenThrottle(win, true);
    emitVisibilityChange();
  });

  win.on("focus", () => {
    setHiddenThrottle(win, false);
    registry.markFocused(id);
    emitVisibilityChange();
  });

  win.on("minimize", () => {
    setHiddenThrottle(win, true);
    emitVisibilityChange();
  });

  win.on("restore", () => {
    setHiddenThrottle(win, false);
    emitVisibilityChange();
  });

  win.on("leave-full-screen", () => {
    applyTrafficLightPosition(win);
  });

  win.on("moved", schedulePersistLayout);
  win.on("resized", schedulePersistLayout);

  win.on("close", (event) => {
    const hide = shouldHideInsteadOfClose({
      quitting: appQuitting(),
      kind: "workspace",
      isLastWorkspace: registry.isLastWorkspace(id),
    });
    if (hide) {
      event.preventDefault();
      win.hide();
      setHiddenThrottle(win, true);
    }
  });

  win.on("closed", () => {
    registry.unregister(id);
    persistWindowLayout();
    emitVisibilityChange();
  });
}

function loadWorkspaceUrl(win: BrowserWindow): void {
  const devUrl = rendererDevUrl();
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(rendererFile("index.html"));
  }
}

export function createWorkspaceWindow(
  opts: CreateWorkspaceWindowOpts = { mode: "blank" },
): BrowserWindow {
  const isMac = process.platform === "darwin";
  const id = allocWindowId(opts.windowId);
  const bounds = resolveCreateBounds(opts);
  const win = new BrowserWindow({
    title: "Goose Note",
    width: bounds.width ?? MAIN_WIDTH,
    height: bounds.height ?? MAIN_HEIGHT,
    ...(bounds.x != null && bounds.y != null ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 800,
    minHeight: 560,
    show: false,
    backgroundColor: "#ffffff",
    transparent: false,
    autoHideMenuBar: true,
    frame: true,
    ...(isMac
      ? {
          // hidden：自定义 y 就是按钮顶部偏移。inset 样式会额外下移，对不齐 web 顶栏。
          titleBarStyle: "hidden" as const,
          trafficLightPosition: trafficLightPosition(),
        }
      : {}),
    webPreferences: windowWebPrefs(id, "workspace"),
  });

  const tabs =
    opts.mode === "currentTab" && opts.tab
      ? [opts.tab]
      : opts.restoredTabs;
  registry.register({ id, kind: "workspace", win, tabs });
  attachWorkspaceChrome(win, id);

  const initPayload: { takeTab?: WindowTabSnapshot; restoredTabs?: WindowTabSnapshot[] } | null =
    opts.mode === "currentTab" && opts.tab
      ? { takeTab: opts.tab }
      : opts.restoredTabs && opts.restoredTabs.length > 0
        ? { restoredTabs: opts.restoredTabs }
        : null;
  if (initPayload) {
    win.webContents.once("did-finish-load", () => sendWindowInit(win, initPayload));
  }

  loadWorkspaceUrl(win);
  return win;
}

export function createMainWindow(): BrowserWindow {
  return createWorkspaceWindow({ mode: "blank" });
}

export function restoreWorkspaceWindows(): BrowserWindow[] {
  const layout = readStoredLayout();
  if (!layout || layout.windows.length === 0) {
    return [createWorkspaceWindow({ mode: "blank" })];
  }
  return layout.windows.map((entry) =>
    createWorkspaceWindow({
      mode: "blank",
      windowId: entry.id,
      bounds: entry.bounds,
      restoredTabs: entry.tabs,
    }),
  );
}

export function createQuicknoteWindow(): BrowserWindow {
  const existing = getQuicknoteWindow();
  if (existing) return existing;

  const id = allocWindowId();
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
      ...windowWebPrefs(id, "quicknote"),
      backgroundThrottling: true,
    },
  });

  registry.register({ id, kind: "quicknote", win });
  denyWindowOpenHandler(win);
  bindCloseTabAccelerator(win);

  win.on("show", () => {
    clearQuicknoteDestroyTimer();
    setHiddenThrottle(win, false);
    emitVisibilityChange();
  });

  win.on("hide", () => {
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

  win.on("close", (event) => {
    if (
      shouldHideInsteadOfClose({
        quitting: appQuitting(),
        kind: "quicknote",
        isLastWorkspace: false,
      })
    ) {
      event.preventDefault();
      win.hide();
      setHiddenThrottle(win, true);
    }
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

let quitting = false;
export function markQuitting(): void {
  persistWindowLayout({ evenIfQuitting: true });
  quitting = true;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  clearQuicknoteDestroyTimer();
}
function appQuitting(): boolean {
  return quitting;
}

export function lookupWindowContext(
  win: BrowserWindow | null,
): { windowId: string; kind: "workspace" | "quicknote" } | null {
  if (!win || win.isDestroyed()) return null;
  const record = registry.findByWin(win);
  if (!record) return null;
  return { windowId: record.id, kind: record.kind };
}

export function currentTitleBarHeight(): number {
  return lastTitleBarHeight;
}

export type WorkspaceDockSurface = {
  id: string;
  outerBounds: WindowBounds;
  contentBounds: WindowBounds;
};

export function listWorkspaceDockSurfaces(): WorkspaceDockSurface[] {
  const surfaces: WorkspaceDockSurface[] = [];
  for (const record of registry.workspaces()) {
    const win = record.win;
    if (!win || win.isDestroyed() || !win.isVisible() || win.isMinimized()) {
      continue;
    }
    try {
      const outer = win.getBounds();
      const content = win.getContentBounds();
      surfaces.push({
        id: record.id,
        outerBounds: {
          x: outer.x,
          y: outer.y,
          width: outer.width,
          height: outer.height,
        },
        contentBounds: {
          x: content.x,
          y: content.y,
          width: content.width,
          height: content.height,
        },
      });
    } catch {
      // ignore transient native bounds errors
    }
  }
  return surfaces;
}

export function sendToWorkspace(
  windowId: string,
  channel: string,
  payload: unknown,
): boolean {
  const record = registry.get(windowId);
  if (!record || record.kind !== "workspace") return false;
  const win = record.win;
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return false;
  // 拖标签时目标窗处于 blur，默认 backgroundThrottling 会推迟 accept/preview。
  win.webContents.backgroundThrottling = false;
  win.webContents.send(channel, payload);
  return true;
}

export function workspaceOuterBounds(windowId: string): WindowBounds | null {
  const record = registry.get(windowId);
  if (!record || record.kind !== "workspace") return null;
  const win = record.win;
  if (!win || win.isDestroyed()) return null;
  try {
    const bounds = win.getBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  } catch {
    return null;
  }
}

export function closeWorkspaceWindow(
  windowId: string | undefined,
  sender: BrowserWindow | null,
): void {
  const record = windowId
    ? registry.get(windowId)
    : sender
      ? registry.findByWin(sender)
      : registry.lastFocusedWorkspace();
  if (!record || record.kind !== "workspace") return;
  if (record.win.isDestroyed()) return;
  record.win.close();
}

/** 最近活动的 workspace 窗；兼容旧的单主窗调用点。 */
export function getMainWindow(): BrowserWindow | null {
  const record = registry.lastFocusedWorkspace();
  if (!record) return null;
  return record.win.isDestroyed() ? null : record.win;
}

export function getQuicknoteWindow(): BrowserWindow | null {
  for (const record of registry.all()) {
    if (record.kind !== "quicknote") continue;
    if (record.win.isDestroyed()) {
      registry.unregister(record.id);
      continue;
    }
    return record.win;
  }
  return null;
}

function waitReadyToShow(win: BrowserWindow, timeoutMs = 8000): Promise<void> {
  if (
    win.isDestroyed() ||
    win.webContents.isDestroyed() ||
    !win.webContents.isLoading()
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    win.once("ready-to-show", done);
    win.once("closed", done);
    win.webContents.once("did-finish-load", done);
  });
}

/** 全局热键唤出时必须抢前台；macOS 不 steal 时 frameless 小窗常常不出现。 */
function raiseWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  setHiddenThrottle(win, false);
  win.show();
  win.moveTop();
  win.focus();
  if (process.platform === "darwin") {
    app.focus({ steal: true });
  }
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
  raiseWindow(win);
}

/**
 * 首次唤起才创建速记窗，避免启动就多一个 renderer。
 *
 * 速记快捷键是严格二态切换：只要窗口可见，再次按键就隐藏，不因全局
 * 快捷键触发时焦点短暂转移而重新聚焦。这里不调用 toggleWindow，避免改变
 * workspace 窗口原有的「可见但未聚焦时先聚焦」行为。
 */
export async function toggleQuicknoteWindow(): Promise<void> {
  let win = getQuicknoteWindow();
  if (!win) {
    win = createQuicknoteWindow();
    await waitReadyToShow(win);
    if (win.isDestroyed()) return;
    raiseWindow(win);
    return;
  }
  if (win.isVisible()) {
    hideQuicknote();
    return;
  }
  raiseWindow(win);
}

export function hideQuicknote(): void {
  const win = getQuicknoteWindow();
  if (win && !win.isDestroyed()) {
    win.hide();
    setHiddenThrottle(win, true);
  }
}

export function broadcast(channel: string, payload: unknown): void {
  for (const record of registry.all()) {
    const win = record.win;
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

/** 全局搜索热键：显示并聚焦最近活动 workspace 窗，不 toggle 隐藏。已在前台则跳过 raise，避免 steal focus 卡顿。 */
export function showAndFocusMainWindow(): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (
    !shouldRaiseMainWindow({
      visible: win.isVisible(),
      minimized: win.isMinimized(),
      focused: win.isFocused(),
    })
  ) {
    return;
  }
  raiseWindow(win);
}
