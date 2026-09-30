import { app, BrowserWindow, ipcMain } from "electron";
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalLocalPath } from "../../src/lib/canonicalLocalPath";
import {
  allowAssociatedMarkdownFile,
  hasUnsafeSegments,
} from "./allowlist";
import {
  collectMarkdownPathsFromArgv,
  isMarkdownDocumentPath,
} from "./markdownOpenPaths";
import { getMainWindow } from "./windows";

const OPEN_CHANNEL = "desktop:open-markdown-files";
const TAKE_PENDING_CHANNEL = "desktop:takePendingOpenMarkdownFiles";

const queuedRaw: string[] = [];
const pendingForRenderer: string[] = [];
let rendererHasTakenPending = false;
let ipcRegistered = false;

function uniqueKeepOrder(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of paths) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function toFilesystemPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("file:")) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      return null;
    }
  }
  return trimmed;
}

function resolveOpenMarkdownPath(filesystemPath: string): string {
  let resolved: string;
  try {
    resolved = path.resolve(filesystemPath);
  } catch (error) {
    console.warn("[open-md] path.resolve 失败", filesystemPath, error);
    return canonicalLocalPath(filesystemPath);
  }

  try {
    resolved = realpathSync.native(resolved);
  } catch (error) {
    console.warn("[open-md] realpath 失败，使用 resolve 结果", resolved, error);
  }

  return canonicalLocalPath(resolved);
}

function markdownFileExists(resolved: string): boolean {
  try {
    if (existsSync(resolved) && statSync(resolved).isFile()) {
      return true;
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    try {
      const info = statSync(resolved);
      return info.isFile();
    } catch (statError) {
      const statCode = (statError as NodeJS.ErrnoException).code;
      if (statCode === "ENOENT") return false;
      try {
        readdirSync(path.dirname(resolved));
        return true;
      } catch (readError) {
        return (readError as NodeJS.ErrnoException).code !== "ENOENT";
      }
    }
  }
  return false;
}

function acceptMarkdownFile(raw: string): string | null {
  const filesystemPath = toFilesystemPath(raw);
  if (!filesystemPath) {
    console.warn("[open-md] 无法解析路径", raw);
    return null;
  }

  const resolved = resolveOpenMarkdownPath(filesystemPath);
  if (hasUnsafeSegments(resolved)) {
    console.warn("[open-md] 路径含不安全片段", resolved);
    return null;
  }
  if (!isMarkdownDocumentPath(resolved)) {
    console.warn("[open-md] 不是 Markdown 文件", resolved);
    return null;
  }
  if (!markdownFileExists(resolved)) {
    console.warn("[open-md] 文件不存在或不可读", resolved);
    return null;
  }

  return allowAssociatedMarkdownFile(resolved);
}

/** 默认把 md 投到最近活动的已有 workspace 窗，不另开新窗。 */
function deliveryWindow(): BrowserWindow | null {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return null;
  return win;
}

function deliverQueuedToRenderer(): void {
  if (!rendererHasTakenPending) return;
  const win = deliveryWindow();
  if (!win) return;
  if (pendingForRenderer.length === 0) return;
  const files = uniqueKeepOrder(pendingForRenderer);
  pendingForRenderer.length = 0;
  win.webContents.send(OPEN_CHANNEL, files);
}

function processQueuedRaw(): void {
  if (queuedRaw.length === 0) return;
  const raw = queuedRaw.splice(0, queuedRaw.length);
  for (const entry of raw) {
    const accepted = acceptMarkdownFile(entry);
    if (accepted) pendingForRenderer.push(accepted);
  }
  deliverQueuedToRenderer();
}

export function enqueueMarkdownOpenPaths(paths: string[]): void {
  if (paths.length === 0) return;
  queuedRaw.push(...paths);
  if (app.isReady()) processQueuedRaw();
}

export function enqueueMarkdownPathsFromArgv(argv: string[]): void {
  enqueueMarkdownOpenPaths(
    collectMarkdownPathsFromArgv(argv, {
      packaged: app.isPackaged,
      execPath: process.execPath,
    }),
  );
}

export function flushQueuedMarkdownOpenPaths(): void {
  processQueuedRaw();
}

export function markOpenMarkdownRendererUnavailable(): void {
  rendererHasTakenPending = false;
}

export function bindOpenMarkdownWindow(win: BrowserWindow): void {
  win.webContents.on("did-start-loading", () => {
    if (deliveryWindow() === win) {
      markOpenMarkdownRendererUnavailable();
    }
  });
  win.webContents.on("did-finish-load", () => {
    if (deliveryWindow() !== win) return;
    processQueuedRaw();
  });
}

export function registerOpenMarkdownIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;
  ipcMain.handle(TAKE_PENDING_CHANNEL, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const target = deliveryWindow();
    if (!win || !target || win !== target) return [];
    rendererHasTakenPending = true;
    processQueuedRaw();
    const files = uniqueKeepOrder(pendingForRenderer);
    pendingForRenderer.length = 0;
    return files;
  });
}

export function registerOpenFileEvent(): void {
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    enqueueMarkdownOpenPaths([filePath]);
  });
}
