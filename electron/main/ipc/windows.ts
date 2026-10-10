import { ipcMain } from "electron";
import { cancelTabDrag, finishTabDrag, previewTabDrag } from "../tabDock";
import { endWindowMove, startWindowMove } from "../windowMove";
import {
  closeQuicknote,
  closeWorkspaceWindow,
  createWorkspaceWindow,
  getMainWindow,
  lookupWindowContext,
  setMainWindowTitleBarHeight,
  showOrCreateMainWindow,
  toggleQuicknoteWindow,
  toggleWindow,
  type CreateWorkspaceWindowOpts,
} from "../windows";
import { senderWindow } from "./common";

export function registerWindowsIpc(): void {
  ipcMain.handle("desktop:setTitle", async (event, t: string) => {
    const win = senderWindow(event);
    if (win && !win.isDestroyed()) win.setTitle(t ?? "");
  });

  ipcMain.handle("desktop:getAlwaysOnTop", async (event) => {
    const win = senderWindow(event);
    if (!win || win.isDestroyed()) return false;
    return win.isAlwaysOnTop();
  });

  ipcMain.handle("desktop:setAlwaysOnTop", async (event, on: boolean) => {
    const win = senderWindow(event);
    if (!win || win.isDestroyed()) return false;
    win.setAlwaysOnTop(Boolean(on));
    return win.isAlwaysOnTop();
  });

  ipcMain.handle(
    "desktop:syncTitleBarHeight",
    async (event, height: number) => {
      const win = senderWindow(event);
      if (!win || win.isDestroyed()) return;
      const context = lookupWindowContext(win);
      if (context?.kind === "quicknote") return;
      setMainWindowTitleBarHeight(win, height);
    },
  );

  ipcMain.handle("desktop:getWindowContext", async (event) => {
    const win = senderWindow(event);
    const context = lookupWindowContext(win);
    if (context) return context;
    return { windowId: "", kind: "workspace" as const };
  });

  ipcMain.handle(
    "desktop:createWindow",
    async (
      event,
      opts: {
        mode: "blank" | "currentTab";
        tab?: CreateWorkspaceWindowOpts["tab"];
        bounds?: CreateWorkspaceWindowOpts["bounds"];
      } = { mode: "currentTab" },
    ) => {
      const source = senderWindow(event);
      const mode = opts.mode === "blank" ? "blank" : "currentTab";
      const win = createWorkspaceWindow({
        mode,
        tab: mode === "currentTab" ? opts.tab : undefined,
        bounds: opts.bounds,
        sourceWindow: source,
      });
      const context = lookupWindowContext(win);
      return { windowId: context?.windowId ?? "" };
    },
  );

  ipcMain.handle("desktop:closeWindow", async (event, windowId?: string) => {
    closeWorkspaceWindow(
      typeof windowId === "string" && windowId.trim() ? windowId : undefined,
      senderWindow(event),
    );
  });

  ipcMain.handle("desktop:minimizeWindow", async (event) => {
    const win = senderWindow(event);
    if (win && !win.isDestroyed()) win.minimize();
  });

  ipcMain.handle("desktop:maximizeWindow", async (event) => {
    const win = senderWindow(event);
    if (win && !win.isDestroyed() && !win.isMaximized()) win.maximize();
  });

  ipcMain.handle("desktop:toggleMaximizeWindow", async (event) => {
    const win = senderWindow(event);
    if (!win || win.isDestroyed()) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });

  ipcMain.handle("desktop:isWindowMaximized", async (event) => {
    const win = senderWindow(event);
    return Boolean(win && !win.isDestroyed() && win.isMaximized());
  });

  ipcMain.handle("desktop:finishTabDrag", async (event, payload) => {
    return finishTabDrag(senderWindow(event), payload ?? {});
  });

  ipcMain.handle("desktop:tabDragMove", async (event, cursor) => {
    previewTabDrag(senderWindow(event), cursor);
  });

  ipcMain.handle("desktop:tabDragCancel", async (event) => {
    cancelTabDrag(senderWindow(event));
  });

  ipcMain.handle("desktop:startWindowDrag", async (event) => {
    startWindowMove(senderWindow(event));
  });

  ipcMain.handle("desktop:endWindowDrag", async (event) => {
    endWindowMove(senderWindow(event));
  });

  ipcMain.handle("desktop:toggleMainWindow", async () => {
    await toggleWindow(getMainWindow());
  });

  ipcMain.handle(
    "desktop:showMainWindow",
    async (
      _event,
      action?: "none" | "search" | "settings" | "ai-panel" | "new-note",
    ) => {
      const win = showOrCreateMainWindow();
      if (!action || action === "none" || win.isDestroyed()) return;
      win.webContents.send("desktop:workspace-action", action);
    },
  );

  ipcMain.handle("desktop:toggleQuicknote", async () => {
    await toggleQuicknoteWindow();
  });

  ipcMain.handle("desktop:closeQuicknote", async () => {
    closeQuicknote();
  });
}
