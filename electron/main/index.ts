import { registerGitSyncIpc, startGitSync, stopGitSync } from "./gitSync";
import { app, Menu, protocol } from "electron";
import { loadVaultRoots } from "./allowlist";
import { registerHotkeys, unregisterAllHotkeys } from "./hotkeys";
import { closeAllWatchers, registerIpcHandlers } from "./ipc";
import { startAutomaticUpdates } from "./appUpdate";
import {
  enqueueMarkdownPathsFromArgv,
  flushQueuedMarkdownOpenPaths,
  markOpenMarkdownRendererUnavailable,
  registerOpenFileEvent,
} from "./openMarkdownFiles";
import {
  CLOSE_TAB_ACCELERATOR,
  CLOSE_WINDOW_ACCELERATOR,
} from "./closeTabAccelerator";
import { lockWebContentsPageZoom } from "./pageZoom";
import {
  createWorkspaceWindow,
  getMainWindow,
  markQuitting,
  lookupWindowContext,
  requestCloseActiveTab,
  restoreWorkspaceWindows,
  shouldSuppressWorkspaceActivate,
} from "./windows";

const DEFAULT_WAKE = "CmdOrCtrl+Alt+N";
const DEFAULT_QUICKNOTE = "Alt+N";

app.setName("Goose Note");
// 禁止触控板捏合缩放整页；键盘 Cmd/Ctrl+/- 由渲染进程改编辑器字号。
app.commandLine.appendSwitch("disable-pinch");

if (process.platform === "linux") {
  // ponytail: Omarchy/Hyprland sets ELECTRON_OZONE_PLATFORM_HINT=wayland.
  // At scale=2 BlockNote maps mouseup onto the heading above. X11 ozone is the
  // working path; drop when Electron Wayland click/IME is reliable.
  process.env.ELECTRON_OZONE_PLATFORM_HINT = "x11";
  process.env.OZONE_PLATFORM = "x11";
  app.commandLine.appendSwitch("ozone-platform-hint", "x11");
  app.commandLine.appendSwitch("ozone-platform", "x11");
}

// macOS 双击 md 会在 ready 前发 open-file，必须尽早监听。
registerOpenFileEvent();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // quit() 异步，后续 whenReady 仍会建窗，Dock 会冒出第二个图标。
  app.exit(0);
} else {
  startApp();
}

function startApp(): void {
  let pendingFocus = false;

  app.on("web-contents-created", (_event, contents) => {
    lockWebContentsPageZoom(contents);
  });

  function focusExistingWorkspace(): void {
    const win = getMainWindow();
    if (!win) {
      pendingFocus = true;
      if (app.isReady()) {
        markOpenMarkdownRendererUnavailable();
        createWorkspaceWindow({ mode: "blank" });
      }
      return;
    }
    if (win.isMinimized()) win.restore();
    win.show();
    win.moveTop();
    win.focus();
    if (process.platform === "darwin") {
      app.focus({ steal: true });
    }
  }

  app.on("second-instance", (_event, argv) => {
    enqueueMarkdownPathsFromArgv(argv);
    focusExistingWorkspace();
  });

  registerIpcHandlers();
  registerGitSyncIpc();

  function installMenu(): void {
    // Windows/Linux：不挂应用菜单，避免按 Alt 弹出 File/Edit/View/Window。
    if (process.platform !== "darwin") {
      Menu.setApplicationMenu(null);
      return;
    }
    const template: Electron.MenuItemConstructorOptions[] = [
      ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
      {
        role: "fileMenu",
        submenu: [
          {
            label: "新建窗口",
            accelerator: "CommandOrControl+Shift+N",
            click: () => {
              createWorkspaceWindow({
                mode: "blank",
                sourceWindow: getMainWindow(),
              });
            },
          },
          { type: "separator" },
          {
            label: "关闭标签",
            accelerator: CLOSE_TAB_ACCELERATOR,
            click: (_item, win) => {
              requestCloseActiveTab(win ?? getMainWindow());
            },
          },
          {
            label: "关闭窗口",
            accelerator: CLOSE_WINDOW_ACCELERATOR,
            click: (_item, win) => {
              (win ?? getMainWindow())?.close();
            },
          },
        ],
      },
      { role: "editMenu" },
      {
        // 默认 viewMenu 带 zoomIn/zoomOut/resetZoom，会缩放整个 webContents。
        role: "viewMenu",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      {
        role: "window",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          ...(process.platform === "darwin"
            ? ([{ type: "separator" as const }, { role: "front" as const }] as const)
            : []),
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  app.whenReady().then(() => {
    installMenu();
    loadVaultRoots();
    enqueueMarkdownPathsFromArgv(process.argv);
    restoreWorkspaceWindows();
    flushQueuedMarkdownOpenPaths();
    registerHotkeys({
      wake: DEFAULT_WAKE,
      quicknote: DEFAULT_QUICKNOTE,
      // 等待渲染进程设置水合，避免启动时抢占用户已关闭或改过的搜索键。
      search: "",
    });
    startAutomaticUpdates();
    startGitSync();
    if (pendingFocus) {
      pendingFocus = false;
      focusExistingWorkspace();
    }
  });

  app.on("activate", () => {
    // Dock / Cmd+Tab 才拉 workspace。速记窗自己的唤出或关闭会补发
    // activate，两边没有关联，不能因此把大窗带到前台。
    if (shouldSuppressWorkspaceActivate()) return;
    focusExistingWorkspace();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    markQuitting();
    unregisterAllHotkeys();
    closeAllWatchers();
    stopGitSync();
  });
}
