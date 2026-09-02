import { app, Menu } from "electron";
import { loadVaultRoots } from "./allowlist";
import { registerHotkeys, unregisterAllHotkeys } from "./hotkeys";
import { closeAllWatchers, registerIpcHandlers } from "./ipc";
import {
  bindOpenMarkdownWindow,
  enqueueMarkdownPathsFromArgv,
  flushQueuedMarkdownOpenPaths,
  markOpenMarkdownRendererUnavailable,
  registerOpenFileEvent,
} from "./openMarkdownFiles";
import {
  createMainWindow,
  getMainWindow,
  markQuitting,
} from "./windows";

const DEFAULT_WAKE = "CmdOrCtrl+Alt+N";
const DEFAULT_QUICKNOTE = "CmdOrCtrl+Alt+Q";
const DEFAULT_SEARCH = "CmdOrCtrl+K";

app.setName("Goose Note");

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

  function focusMainWindow(): void {
    const win = getMainWindow();
    if (!win) {
      pendingFocus = true;
      if (app.isReady()) {
        markOpenMarkdownRendererUnavailable();
        bindOpenMarkdownWindow(createMainWindow());
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
    focusMainWindow();
  });

  registerIpcHandlers();

  function installMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
      { role: "fileMenu" },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  app.whenReady().then(() => {
    installMenu();
    loadVaultRoots();
    enqueueMarkdownPathsFromArgv(process.argv);
    const win = createMainWindow();
    bindOpenMarkdownWindow(win);
    flushQueuedMarkdownOpenPaths();
    registerHotkeys({
      wake: DEFAULT_WAKE,
      quicknote: DEFAULT_QUICKNOTE,
      search: DEFAULT_SEARCH,
    });
    if (pendingFocus) {
      pendingFocus = false;
      focusMainWindow();
    }
  });

  app.on("activate", () => {
    focusMainWindow();
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
  });
}
