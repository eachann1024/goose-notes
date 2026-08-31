import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Notification,
  shell,
} from "electron";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  addSessionAllowed,
  addVaultRoot,
  assertAllowed,
  attachmentsRoot,
  ensureParentDir,
  hasUnsafeSegments,
  userDataRoot,
} from "./allowlist";
import { listOpenApps, openTerminalAtPath, openWithApp } from "./apps";
import { registerHotkeys } from "./hotkeys";
import {
  broadcast,
  getMainWindow,
  hideQuicknote,
  toggleQuicknoteWindow,
  toggleWindow,
} from "./windows";

const watchers = new Map<string, FSWatcher>();

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function isNetFetchAllowed(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  if (
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]" ||
      parsed.hostname === "::1")
  ) {
    return true;
  }
  return false;
}

function isOpenUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function registerIpcHandlers(): void {
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

  ipcMain.handle("desktop:fsReadText", async (_event, p: string) => {
    const target = assertAllowed(p);
    return readFile(target, "utf8");
  });

  ipcMain.handle("desktop:fsWriteText", async (_event, p: string, data: string) => {
    const target = assertAllowed(p);
    ensureParentDir(target);
    await writeFile(target, data, "utf8");
  });

  ipcMain.handle("desktop:fsRead", async (_event, p: string) => {
    const target = assertAllowed(p);
    const buf = await readFile(target);
    return new Uint8Array(buf);
  });

  ipcMain.handle("desktop:fsWrite", async (_event, p: string, data: Uint8Array) => {
    const target = assertAllowed(p);
    ensureParentDir(target);
    await writeFile(target, Buffer.from(data));
  });

  ipcMain.handle("desktop:fsReadDir", async (_event, p: string) => {
    const target = assertAllowed(p);
    const entries = await readdir(target, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(target, entry.name),
    }));
  });

  ipcMain.handle("desktop:fsMkdir", async (_event, p: string) => {
    const target = assertAllowed(p);
    await mkdir(target, { recursive: true });
  });

  ipcMain.handle("desktop:fsExists", async (_event, p: string) => {
    if (hasUnsafeSegments(p)) return false;
    try {
      const target = assertAllowed(p);
      await stat(target);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("desktop:fsStat", async (_event, p: string) => {
    const target = assertAllowed(p);
    const info = await stat(target);
    return {
      size: info.size,
      isDirectory: info.isDirectory(),
      mtimeMs: info.mtimeMs,
    };
  });

  ipcMain.handle("desktop:fsRename", async (_event, from: string, to: string) => {
    const src = assertAllowed(from);
    const dest = assertAllowed(to);
    ensureParentDir(dest);
    await rename(src, dest);
  });

  ipcMain.handle("desktop:fsRemove", async (_event, p: string) => {
    const target = assertAllowed(p);
    await rm(target, { recursive: true, force: true });
  });

  ipcMain.handle("desktop:fsWatch", async (_event, p: string) => {
    const target = assertAllowed(p);
    const id = randomUUID();
    const watcher = watch(target, { recursive: true }, (eventType, filename) => {
      const changed = filename
        ? path.join(target, filename.toString())
        : target;
      broadcast("desktop:fs-change", { path: changed, type: eventType });
    });
    watchers.set(id, watcher);
    return id;
  });

  ipcMain.handle("desktop:fsUnwatch", async (_event, id: string) => {
    const watcher = watchers.get(id);
    watchers.delete(id);
    try {
      watcher?.close();
    } catch {
      // ignore
    }
  });

  ipcMain.handle("desktop:getUserDataPath", async () => userDataRoot());
  ipcMain.handle("desktop:getDownloadsPath", async () => app.getPath("downloads"));
  ipcMain.handle("desktop:joinPath", async (_event, parts: string[]) => {
    return path.join(...parts);
  });

  ipcMain.handle("desktop:openUrl", async (_event, url: string) => {
    if (!isOpenUrlAllowed(url)) {
      throw new Error("只允许打开 http/https 链接");
    }
    await shell.openExternal(url);
  });

  ipcMain.handle("desktop:openPath", async (_event, p: string) => {
    const target = assertAllowed(p);
    const err = await shell.openPath(target);
    if (err) throw new Error(err);
  });

  ipcMain.handle("desktop:showItemInFolder", async (_event, p: string) => {
    const target = assertAllowed(p);
    shell.showItemInFolder(target);
  });

  ipcMain.handle("desktop:listOpenApps", async () => listOpenApps());

  ipcMain.handle("desktop:openWithApp", async (_event, appName: string, p: string) => {
    const target = assertAllowed(p);
    if (!openWithApp(appName, target)) {
      throw new Error("无法用指定应用打开");
    }
  });

  ipcMain.handle("desktop:openTerminalAtPath", async (_event, p: string) => {
    const target = assertAllowed(p);
    if (!openTerminalAtPath(target)) {
      throw new Error("无法在该路径打开终端");
    }
  });

  ipcMain.handle("desktop:writeText", async (_event, t: string) => {
    clipboard.writeText(t ?? "");
  });

  ipcMain.handle("desktop:readText", async () => clipboard.readText());

  ipcMain.handle(
    "desktop:netFetch",
    async (
      _event,
      url: string,
      init?: { method?: string; headers?: Record<string, string>; body?: string },
    ) => {
      if (!isNetFetchAllowed(url)) {
        throw new Error("netFetch 仅允许 localhost/127.0.0.1 与 https");
      }
      const response = await fetch(url, {
        method: init?.method,
        headers: init?.headers,
        body: init?.body,
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const body = await response.text();
      return { status: response.status, headers, body };
    },
  );

  ipcMain.handle("desktop:setTitle", async (event, t: string) => {
    const win = senderWindow(event);
    if (win && !win.isDestroyed()) win.setTitle(t ?? "");
  });

  ipcMain.handle("desktop:toggleMainWindow", async () => {
    await toggleWindow(getMainWindow());
  });

  ipcMain.handle("desktop:toggleQuicknote", async () => {
    await toggleQuicknoteWindow();
  });

  ipcMain.handle("desktop:hideQuicknote", async () => {
    hideQuicknote();
  });

  ipcMain.handle(
    "desktop:registerHotkeys",
    async (_event, keys: { wake: string; quicknote: string }) => {
      return registerHotkeys(keys);
    },
  );

  ipcMain.handle(
    "desktop:notify",
    async (_event, n: { title: string; body: string }) => {
      if (!Notification.isSupported()) return;
      new Notification({ title: n.title, body: n.body }).show();
    },
  );

  void attachmentsRoot;
}

export function closeAllWatchers(): void {
  for (const watcher of watchers.values()) {
    try {
      watcher.close();
    } catch {
      // ignore
    }
  }
  watchers.clear();
}
