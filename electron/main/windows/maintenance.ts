import { BrowserWindow } from "electron";
import path from "node:path";
import {
  __dirname,
  rendererDevUrl,
  framelessWindowIcon,
  sharedWebPrefs,
} from "./configuration";
import { bindCloseTabAccelerator } from "./close";

// 工具窗口不加入 workspace registry：不恢复标签、不同步工作区状态，关闭即销毁。
export let assetMaintenanceWindow: BrowserWindow | null = null;

export function getAssetMaintenanceWindow(): BrowserWindow | null {
  return assetMaintenanceWindow && !assetMaintenanceWindow.isDestroyed()
    ? assetMaintenanceWindow
    : null;
}

export function createAssetMaintenanceWindow(): BrowserWindow {
  const existing = getAssetMaintenanceWindow();
  if (existing) {
    existing.show();
    existing.focus();
    return existing;
  }
  const win = new BrowserWindow({
    title: "资源清理 · Goose Note",
    width: 1000,
    height: 720,
    minWidth: 760,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    ...(framelessWindowIcon() ? { icon: framelessWindowIcon() } : {}),
    webPreferences: { ...sharedWebPrefs(), partition: "asset-maintenance" },
  });

  assetMaintenanceWindow = win;
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.on("will-redirect", (event) => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  win.webContents.session.setPermissionCheckHandler(() => false);
  bindCloseTabAccelerator(win);
  win.once("ready-to-show", () => win.show());
  win.once("closed", () => {
    assetMaintenanceWindow = null;
  });
  const devUrl = rendererDevUrl();
  if (devUrl) void win.loadURL(`${devUrl}/asset-maintenance.html`);
  else
    void win.loadFile(
      path.join(__dirname, "../renderer/asset-maintenance.html"),
    );
  return win;
}
