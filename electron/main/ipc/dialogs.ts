import { dialog, ipcMain } from "electron";
import { addSessionAllowed, addVaultRoot } from "../allowlist";
import { getMainWindow } from "../windows";
import { senderWindow } from "./common";

export function registerDialogsIpc(): void {
  ipcMain.handle("desktop:selectDirectory", async (event) => {
    const win = senderWindow(event);
    const result = await dialog.showOpenDialog(win ?? getMainWindow()!, {
      properties: ["openDirectory"],
      title: "选择 Markdown 文件夹",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return addVaultRoot(result.filePaths[0]);
  });

  ipcMain.handle(
    "desktop:showOpenDialog",
    async (
      event,
      opts: {
        filters?: { name: string; extensions: string[] }[];
        multiple?: boolean;
      } = {},
    ) => {
      const win = senderWindow(event);
      const properties: Array<"openFile" | "multiSelections"> = ["openFile"];
      if (opts.multiple) properties.push("multiSelections");
      const result = await dialog.showOpenDialog(win ?? getMainWindow()!, {
        properties,
        filters: opts.filters,
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths.map((p) => addSessionAllowed(p));
    },
  );

  ipcMain.handle(
    "desktop:showSaveDialog",
    async (
      event,
      opts: {
        defaultPath?: string;
        filters?: { name: string; extensions: string[] }[];
      } = {},
    ) => {
      const win = senderWindow(event);
      const result = await dialog.showSaveDialog(win ?? getMainWindow()!, {
        defaultPath: opts.defaultPath,
        filters: opts.filters,
      });
      if (result.canceled || !result.filePath) return null;
      return addSessionAllowed(result.filePath);
    },
  );
}
