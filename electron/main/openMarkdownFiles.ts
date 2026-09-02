import { app, ipcMain, type BrowserWindow } from "electron";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

function acceptMarkdownFile(raw: string): string | null {
  const filesystemPath = toFilesystemPath(raw);
  if (!filesystemPath) return null;
  let resolved: string;
  try {
    resolved = path.resolve(filesystemPath);
  } catch {
    return null;
  }
  if (hasUnsafeSegments(resolved)) return null;
  if (!isMarkdownDocumentPath(resolved)) return null;
  try {
    if (!existsSync(resolved) || !statSync(resolved).isFile()) return null;
  } catch {
    return null;
  }
  return allowAssociatedMarkdownFile(resolved);
}

function deliverQueuedToRenderer(): void {
  if (!rendererHasTakenPending) return;
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
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
    markOpenMarkdownRendererUnavailable();
  });
}

export function registerOpenMarkdownIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;
  ipcMain.handle(TAKE_PENDING_CHANNEL, () => {
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
