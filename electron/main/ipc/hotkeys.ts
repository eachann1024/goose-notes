import { ipcMain, Notification } from "electron";
import {
  registerHotkeys,
  pauseGlobalHotkeys,
  resumeGlobalHotkeys,
} from "../hotkeys";
import {
  getAccessibilityStatus,
  requestMacAccessibilityAccess,
} from "../accessibility";

export function registerHotkeysIpc(): void {
  ipcMain.handle(
    "desktop:registerHotkeys",
    async (
      _event,
      keys: { wake: string; quicknote: string; search: string },
    ) => {
      return registerHotkeys(keys);
    },
  );

  ipcMain.handle("desktop:pauseHotkeys", async () => {
    pauseGlobalHotkeys();
  });

  ipcMain.handle("desktop:resumeHotkeys", async () => {
    return resumeGlobalHotkeys();
  });

  ipcMain.handle("desktop:getAccessibilityStatus", async () => {
    return getAccessibilityStatus();
  });

  ipcMain.handle("desktop:requestAccessibility", async () => {
    return requestMacAccessibilityAccess();
  });

  ipcMain.handle(
    "desktop:notify",
    async (_event, n: { title: string; body: string }) => {
      if (!Notification.isSupported()) return;
      new Notification({ title: n.title, body: n.body }).show();
    },
  );
}
