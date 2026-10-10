import { BrowserWindow } from "electron";
import { bindOpenMarkdownWindow } from "../openMarkdownFiles";
import {
  MIN_WORKSPACE_HEIGHT,
  MIN_WORKSPACE_WIDTH,
  type WindowTabSnapshot,
} from "../windowLayout";
import { shouldHideInsteadOfClose } from "../windowRegistry";
import {
  applySystemMaterial,
  workspaceWindowMaterialOptions,
} from "../systemMaterial";
import {
  MAIN_WIDTH,
  MAIN_HEIGHT,
  type CreateWorkspaceWindowOpts,
  rendererDevUrl,
  rendererFile,
  framelessWindowIcon,
  windowWebPrefs,
  trafficLightPosition,
  applyTrafficLightPosition,
  setHiddenThrottle,
  denyWindowOpenHandler,
} from "./configuration";
import { notifyBrowserWindowCreated, emitVisibilityChange } from "./visibility";
import {
  readStoredLayout,
  persistWindowLayout,
  schedulePersistLayout,
  allocWindowId,
  resolveCreateBounds,
  sendWindowInit,
} from "./layout";
import { appQuitting } from "./registry";
import { bindCloseTabAccelerator } from "./close";
import { registry, workspacesHeldHidden, windowState } from "./state";

export function attachWorkspaceChrome(
  win: BrowserWindow,
  id: string,
  restore?: { maximized?: boolean; fullScreen?: boolean },
): void {
  applyTrafficLightPosition(win);
  denyWindowOpenHandler(win);
  bindOpenMarkdownWindow(win);
  bindCloseTabAccelerator(win);
  notifyBrowserWindowCreated(win, "workspace");

  win.once("ready-to-show", () => {
    applyTrafficLightPosition(win);
    setHiddenThrottle(win, false);
    if (restore?.maximized) win.maximize();
    if (restore?.fullScreen) win.setFullScreen(true);
    win.show();
  });

  win.on("show", () => {
    if (workspacesHeldHidden.has(win)) {
      win.hide();
      return;
    }
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

  win.on("moved", schedulePersistLayout);
  win.on("resized", schedulePersistLayout);
  win.on("maximize", schedulePersistLayout);
  win.on("unmaximize", schedulePersistLayout);
  win.on("enter-full-screen", schedulePersistLayout);
  win.on("leave-full-screen", () => {
    applyTrafficLightPosition(win);
    schedulePersistLayout();
  });

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
      persistWindowLayout();
    }
  });

  win.on("closed", () => {
    registry.unregister(id);
    persistWindowLayout();
    emitVisibilityChange();
  });
}

export function loadWorkspaceUrl(win: BrowserWindow): void {
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
  const material = workspaceWindowMaterialOptions();
  const icon = framelessWindowIcon();
  const win = new BrowserWindow({
    title: "Goose Note",
    width: bounds.width ?? MAIN_WIDTH,
    height: bounds.height ?? MAIN_HEIGHT,
    ...(bounds.x != null && bounds.y != null
      ? { x: bounds.x, y: bounds.y }
      : {}),
    minWidth: MIN_WORKSPACE_WIDTH,
    minHeight: MIN_WORKSPACE_HEIGHT,
    show: false,
    backgroundColor: material.backgroundColor,
    transparent: false,
    autoHideMenuBar: true,
    // Win/Linux：去掉原生顶栏，由 DesktopTitleBar 右侧自定义 min/max/close。
    // Mac：保留 frame + hidden titleBar，红绿灯仍走系统。
    frame: isMac,
    ...(icon ? { icon } : {}),
    ...(material.backgroundMaterial
      ? { backgroundMaterial: material.backgroundMaterial }
      : {}),
    ...(isMac
      ? {
          // hidden：自定义 y 就是按钮顶部偏移。inset 样式会额外下移，对不齐 web 顶栏。
          titleBarStyle: "hidden" as const,
          trafficLightPosition: trafficLightPosition(),
          ...(material.vibrancy ? { vibrancy: material.vibrancy } : {}),
          ...(material.visualEffectState
            ? { visualEffectState: material.visualEffectState }
            : {}),
        }
      : {}),
    webPreferences: windowWebPrefs(id, "workspace"),
  });
  if (process.platform !== "darwin") {
    win.setMenuBarVisibility(false);
  }
  applySystemMaterial(win);

  const tabs =
    opts.mode === "currentTab" && opts.tab ? [opts.tab] : opts.restoredTabs;
  registry.register({ id, kind: "workspace", win, tabs });
  attachWorkspaceChrome(win, id, {
    maximized: opts.maximized,
    fullScreen: opts.fullScreen,
  });

  const initPayload: {
    takeTab?: WindowTabSnapshot;
    restoredTabs?: WindowTabSnapshot[];
  } | null =
    opts.mode === "currentTab" && opts.tab
      ? { takeTab: opts.tab }
      : opts.restoredTabs && opts.restoredTabs.length > 0
        ? { restoredTabs: opts.restoredTabs }
        : null;
  if (initPayload) {
    win.webContents.once("did-finish-load", () =>
      sendWindowInit(win, initPayload),
    );
  }

  loadWorkspaceUrl(win);
  return win;
}

export function createMainWindow(): BrowserWindow {
  return createWorkspaceWindow({ mode: "blank" });
}

export function restoreWorkspaceWindows(): BrowserWindow[] {
  const layout = readStoredLayout();
  if (windowState.rememberedQuicknote === undefined) {
    windowState.rememberedQuicknote = layout?.quicknote ?? null;
  }
  if (!layout || layout.windows.length === 0) {
    return [createWorkspaceWindow({ mode: "blank" })];
  }
  return layout.windows.map((entry) =>
    createWorkspaceWindow({
      mode: "blank",
      windowId: entry.id,
      bounds: entry.bounds,
      maximized: entry.maximized,
      fullScreen: entry.fullScreen,
      restoredTabs: entry.tabs,
    }),
  );
}
