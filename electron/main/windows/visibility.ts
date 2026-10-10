import { BrowserWindow } from "electron";
import {
  registry,
  visibilityListeners,
  windowCreatedListeners,
  type WindowCreatedListener,
  quicknoteActivateSuppression,
  windowState,
} from "./state";

export function onBrowserWindowCreated(
  listener: WindowCreatedListener,
): () => void {
  windowCreatedListeners.add(listener);
  return () => {
    windowCreatedListeners.delete(listener);
  };
}

export function notifyBrowserWindowCreated(
  win: BrowserWindow,
  kind: "workspace" | "quicknote",
): void {
  for (const listener of windowCreatedListeners) listener(win, kind);
}

export function windowIsForeground(win: BrowserWindow | null): boolean {
  if (!win || win.isDestroyed()) return false;
  return win.isVisible() && !win.isMinimized() && win.isFocused();
}

export function emitVisibilityChange(): void {
  const visible = hasVisibleWindow();
  if (visible === windowState.lastEmittedVisible) return;
  windowState.lastEmittedVisible = visible;
  for (const listener of visibilityListeners) {
    try {
      listener();
    } catch {
      // ignore
    }
  }
}

export function markQuicknoteActivateSuppressed(): void {
  quicknoteActivateSuppression.mark();
}

export function shouldSuppressWorkspaceActivate(): boolean {
  return quicknoteActivateSuppression.shouldSuppress();
}

export function hasVisibleWindow(): boolean {
  for (const record of registry.all()) {
    if (windowIsForeground(record.win)) return true;
  }
  return false;
}

export function onWindowVisibilityChange(listener: () => void): () => void {
  visibilityListeners.add(listener);
  return () => {
    visibilityListeners.delete(listener);
  };
}
