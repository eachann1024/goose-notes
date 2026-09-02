import { app, Menu } from "electron";
import { loadVaultRoots } from "./allowlist";
import { registerHotkeys, unregisterAllHotkeys } from "./hotkeys";
import { closeAllWatchers, registerIpcHandlers } from "./ipc";
import {
  createMainWindow,
  getMainWindow,
  markQuitting,
} from "./windows";

const DEFAULT_WAKE = "CmdOrCtrl+Alt+N";
const DEFAULT_QUICKNOTE = "CmdOrCtrl+Alt+Q";
const DEFAULT_SEARCH = "CmdOrCtrl+K";

app.setName("Goose Note");

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
      if (app.isReady()) createMainWindow();
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

  app.on("second-instance", () => {
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
    createMainWindow();
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
