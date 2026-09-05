import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  Notification,
  shell,
} from "electron";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { watch, type FSWatcher, type WatchEventType } from "node:fs";
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
import { registerOpenMarkdownIpc } from "./openMarkdownFiles";
import { listOpenApps, openTerminalAtPath, openWithApp } from "./apps";
import { registerHotkeys, pauseGlobalHotkeys, resumeGlobalHotkeys } from "./hotkeys";
import {
  getAccessibilityStatus,
  requestMacAccessibilityAccess,
} from "./accessibility";
import { printHtmlToPdf } from "./printPdf";
import { restoreFileFromTrash } from "./trashRestore";
import { saveToDownloads } from "./saveToDownloads";
import {
  cancelTabDrag,
  finishTabDrag,
  previewTabDrag,
} from "./tabDock";
import {
  broadcast,
  closeQuicknote,
  closeWorkspaceWindow,
  createWorkspaceWindow,
  getMainWindow,
  hasVisibleWindow,
  lookupWindowContext,
  onWindowVisibilityChange,
  setMainWindowTitleBarHeight,
  toggleQuicknoteWindow,
  toggleWindow,
  type CreateWorkspaceWindowOpts,
} from "./windows";

const watchers = new Map<string, FSWatcher>();
const recentWrites = new Map<string, number>();
const SELF_WRITE_SUPPRESS_MS = 1500;
const RECENT_WRITE_SWEEP_MS = 5000;
const WATCH_DEBOUNCE_MS = 150;
const IGNORED_WATCH_BASENAMES = new Set(["thumbs.db", "desktop.ini"]);
const IGNORED_WATCH_SUFFIXES = [".swp", ".swx", ".tmp", ".crswap", ".part"];

type FsChangePayload = { path: string; type: string };
type QueuedWatch = FsChangePayload & { lastAt: number; root: string };
type PendingWatch = FsChangePayload & { root: string };

const PENDING_WHILE_HIDDEN_LIMIT = 200;
const debounceQueue = new Map<string, QueuedWatch>();
const pendingWhileHidden = new Map<string, PendingWatch>();
const overflowRoots = new Set<string>();
let debounceTimer: NodeJS.Timeout | null = null;
let visibilityHooked = false;

function normalizeWatchPath(p: string): string {
  const resolved = path.resolve(p);
  if (process.platform === "win32" || process.platform === "darwin") {
    return resolved.toLowerCase();
  }
  return resolved;
}

function markRecentWrite(p: string): void {
  const now = Date.now();
  for (const [key, time] of recentWrites) {
    if (now - time > RECENT_WRITE_SWEEP_MS) recentWrites.delete(key);
  }
  recentWrites.set(normalizeWatchPath(p), now);
}

async function withSelfWriteMark(paths: string[], op: () => Promise<void>): Promise<void> {
  for (const p of paths) markRecentWrite(p);
  try {
    await op();
  } finally {
    for (const p of paths) markRecentWrite(p);
  }
}

function isRecentSelfWrite(p: string): boolean {
  const stamped = recentWrites.get(normalizeWatchPath(p));
  if (stamped == null) return false;
  return Date.now() - stamped < SELF_WRITE_SUPPRESS_MS;
}

function shouldIgnoreWatchFilename(filename: string | Buffer | null): boolean {
  if (filename == null) return false;
  const relative = filename.toString();
  if (!relative) return false;
  const segments = relative.split(/[/\\]/).filter(Boolean);
  for (const segment of segments) {
    if (segment.startsWith(".")) return true;
    if (segment === "node_modules") return true;
    if (segment.startsWith("~$")) return true;
    const lower = segment.toLowerCase();
    if (IGNORED_WATCH_BASENAMES.has(lower)) return true;
    if (IGNORED_WATCH_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;
  }
  return false;
}

function scheduleWatchFlush(delayMs: number): void {
  if (debounceTimer) return;
  debounceTimer = setTimeout(flushDebouncedWatchEvents, delayMs);
  debounceTimer.unref();
}

function enqueueWatchEvent(payload: FsChangePayload, root: string): void {
  debounceQueue.set(normalizeWatchPath(payload.path), {
    ...payload,
    root,
    lastAt: Date.now(),
  });
  scheduleWatchFlush(WATCH_DEBOUNCE_MS);
}

function overflowPendingHidden(root: string): void {
  for (const pending of pendingWhileHidden.values()) {
    overflowRoots.add(pending.root);
  }
  overflowRoots.add(root);
  pendingWhileHidden.clear();
}

function dispatchWatchEvents(events: PendingWatch[]): void {
  if (events.length === 0) return;
  if (!hasVisibleWindow()) {
    for (const event of events) {
      if (pendingWhileHidden.size >= PENDING_WHILE_HIDDEN_LIMIT) {
        overflowPendingHidden(event.root);
        continue;
      }
      pendingWhileHidden.set(normalizeWatchPath(event.path), {
        path: event.path,
        type: event.type,
        root: event.root,
      });
    }
    return;
  }
  for (const event of events) {
    broadcast("desktop:fs-change", { path: event.path, type: event.type });
  }
}

function flushDebouncedWatchEvents(): void {
  debounceTimer = null;
  const now = Date.now();
  const ready: PendingWatch[] = [];
  let nextDelay = Number.POSITIVE_INFINITY;
  for (const [key, item] of debounceQueue) {
    const wait = WATCH_DEBOUNCE_MS - (now - item.lastAt);
    if (wait <= 0) {
      debounceQueue.delete(key);
      ready.push({ path: item.path, type: item.type, root: item.root });
    } else {
      nextDelay = Math.min(nextDelay, wait);
    }
  }
  dispatchWatchEvents(ready);
  if (debounceQueue.size > 0) {
    scheduleWatchFlush(Math.max(1, nextDelay));
  }
}

function flushPendingHiddenWatchEvents(): void {
  if (!hasVisibleWindow()) return;
  if (overflowRoots.size === 0 && pendingWhileHidden.size === 0) return;
  const overflowEvents: FsChangePayload[] = [...overflowRoots].map((root) => ({
    path: root,
    type: "rename",
  }));
  overflowRoots.clear();
  const events: FsChangePayload[] = [...pendingWhileHidden.values()].map(
    ({ path: eventPath, type }) => ({ path: eventPath, type }),
  );
  pendingWhileHidden.clear();
  for (const event of overflowEvents) {
    broadcast("desktop:fs-change", event);
  }
  for (const event of events) {
    broadcast("desktop:fs-change", event);
  }
}

function createFsWatcher(
  target: string,
  listener: (eventType: WatchEventType, filename: string | Buffer | null) => void,
): FSWatcher {
  try {
    return watch(target, { recursive: true }, listener);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM") {
      console.warn(
        "[desktop:fsWatch] recursive watch unavailable on this platform, falling back to non-recursive root watch",
        target,
      );
      return watch(target, { recursive: false }, listener);
    }
    throw err;
  }
}

function hookWindowVisibilityForWatch(): void {
  if (visibilityHooked) return;
  visibilityHooked = true;
  onWindowVisibilityChange(() => {
    if (hasVisibleWindow()) flushPendingHiddenWatchEvents();
  });
}

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
  hookWindowVisibilityForWatch();
  registerOpenMarkdownIpc();
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
    await withSelfWriteMark([target], () => writeFile(target, data, "utf8"));
  });

  ipcMain.handle("desktop:fsRead", async (_event, p: string) => {
    const target = assertAllowed(p);
    const buf = await readFile(target);
    return new Uint8Array(buf);
  });

  ipcMain.handle("desktop:fsWrite", async (_event, p: string, data: Uint8Array) => {
    const target = assertAllowed(p);
    ensureParentDir(target);
    await withSelfWriteMark([target], () => writeFile(target, Buffer.from(data)));
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
    await withSelfWriteMark([target], () => mkdir(target, { recursive: true }));
  });

  ipcMain.handle("desktop:fsExists", async (_event, p: string) => {
    if (hasUnsafeSegments(p)) return false;
    let target: string;
    try {
      target = assertAllowed(p);
    } catch {
      return false;
    }
    try {
      await stat(target);
      return true;
    } catch (statError) {
      // 只有真正的「不存在」(ENOENT) 才该被当作路径失效。
      // iCloud Drive 等云盘目录可能尚未完全物化，stat 会瞬时抛
      // EPERM/EACCES/EBUSY，此时目录其实仍存在 —— 不应把真实存在的
      // 仓库误报成「路径失效」。用 readdir 复核一次再下结论。
      if ((statError as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      try {
        await readdir(target);
        return true;
      } catch (readError) {
        return (readError as NodeJS.ErrnoException).code !== "ENOENT";
      }
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
    await withSelfWriteMark([src, dest], () => rename(src, dest));
  });

  ipcMain.handle("desktop:fsRemove", async (_event, p: string) => {
    const target = assertAllowed(p);
    await withSelfWriteMark([target], async () => {
      try {
        await shell.trashItem(target);
      } catch {
        await rm(target, { recursive: true, force: true });
      }
    });
  });

  ipcMain.handle("desktop:restoreFromTrash", async (_event, p: string) => {
    const dest = assertAllowed(p);
    ensureParentDir(dest);
    return restoreFileFromTrash(dest);
  });

  ipcMain.handle("desktop:fsWatch", async (_event, p: string) => {
    const target = assertAllowed(p);
    const id = randomUUID();
    const listener = (eventType: WatchEventType, filename: string | Buffer | null) => {
      if (shouldIgnoreWatchFilename(filename)) return;
      const changed = filename
        ? path.join(target, filename.toString())
        : target;
      const resolved = path.resolve(changed);
      if (isRecentSelfWrite(resolved)) return;
      enqueueWatchEvent({ path: resolved, type: eventType }, target);
    };
    try {
      const watcher = createFsWatcher(target, listener);
      watcher.on("error", (err) => {
        console.warn("[desktop:fsWatch] watcher error", target, err);
      });
      watchers.set(id, watcher);
    } catch (err) {
      console.warn("[desktop:fsWatch] failed to start watcher", target, err);
      const detail = err instanceof Error && err.message ? err.message : String(err);
      throw new Error(`无法监视目录: ${detail}`, { cause: err });
    }
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
  ipcMain.handle(
    "desktop:saveToDownloads",
    async (_event, filename: string, data: Uint8Array) => {
      return saveToDownloads(filename, data);
    },
  );
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

  ipcMain.handle("desktop:writeImage", async (_event, dataUrl: string) => {
    const trimmed = String(dataUrl ?? "").trim();
    const match = /^data:image\/[^;]+;base64,(.+)$/i.exec(trimmed);
    if (!match) {
      throw new Error("无效 PNG data URL");
    }
    const pngBuffer = Buffer.from(match[1], "base64");
    if (!pngBuffer.length) {
      throw new Error("无效 PNG data URL");
    }
    const image = nativeImage.createFromBuffer(pngBuffer);
    if (process.platform === "darwin") {
      clipboard.writeBuffer("public.png", pngBuffer);
      clipboard.writeImage(image);
    } else {
      clipboard.writeImage(image);
    }
  });

  ipcMain.handle("desktop:readText", async () => clipboard.readText());

  ipcMain.handle("desktop:printHtmlToPdf", async (_event, html: string) => {
    return printHtmlToPdf(html);
  });

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

  ipcMain.handle("desktop:syncTitleBarHeight", async (event, height: number) => {
    const win = senderWindow(event);
    if (!win || win.isDestroyed()) return;
    const context = lookupWindowContext(win);
    if (context?.kind === "quicknote") return;
    setMainWindowTitleBarHeight(win, height);
  });

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

  ipcMain.handle("desktop:finishTabDrag", async (event, payload) => {
    return finishTabDrag(senderWindow(event), payload ?? {});
  });

  ipcMain.handle("desktop:tabDragMove", async (event, cursor) => {
    previewTabDrag(senderWindow(event), cursor);
  });

  ipcMain.handle("desktop:tabDragCancel", async (event) => {
    cancelTabDrag(senderWindow(event));
  });

  ipcMain.handle("desktop:toggleMainWindow", async () => {
    await toggleWindow(getMainWindow());
  });

  ipcMain.handle("desktop:toggleQuicknote", async () => {
    await toggleQuicknoteWindow();
  });

  ipcMain.handle("desktop:closeQuicknote", async () => {
    closeQuicknote();
  });

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

  void attachmentsRoot;
}

export function closeAllWatchers(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  debounceQueue.clear();
  pendingWhileHidden.clear();
  overflowRoots.clear();
  recentWrites.clear();
  for (const watcher of watchers.values()) {
    try {
      watcher.close();
    } catch {
      // ignore
    }
  }
  watchers.clear();
}
