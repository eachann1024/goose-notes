import { BrowserWindow } from "electron";
import { type WindowBounds } from "../windowLayout";
import { persistWindowLayout } from "./layout";
import { clearQuicknoteDestroyTimer } from "./quicknote";
import { registry, windowState } from "./state";

export function markQuitting(): void {
  persistWindowLayout({ evenIfQuitting: true });
  windowState.quitting = true;
  if (windowState.persistTimer) {
    clearTimeout(windowState.persistTimer);
    windowState.persistTimer = null;
  }
  clearQuicknoteDestroyTimer();
}

export function appQuitting(): boolean {
  return windowState.quitting;
}

export function lookupWindowContext(
  win: BrowserWindow | null,
): { windowId: string; kind: "workspace" | "quicknote" } | null {
  if (!win || win.isDestroyed()) return null;
  const record = registry.findByWin(win);
  if (!record) return null;
  return { windowId: record.id, kind: record.kind };
}

export function currentTitleBarHeight(): number {
  return windowState.lastTitleBarHeight;
}

export type WorkspaceDockSurface = {
  id: string;
  outerBounds: WindowBounds;
  contentBounds: WindowBounds;
};

export function listWorkspaceDockSurfaces(): WorkspaceDockSurface[] {
  const surfaces: WorkspaceDockSurface[] = [];
  for (const record of registry.workspaces()) {
    const win = record.win;
    if (!win || win.isDestroyed() || !win.isVisible() || win.isMinimized()) {
      continue;
    }
    try {
      const outer = win.getBounds();
      const content = win.getContentBounds();
      surfaces.push({
        id: record.id,
        outerBounds: {
          x: outer.x,
          y: outer.y,
          width: outer.width,
          height: outer.height,
        },
        contentBounds: {
          x: content.x,
          y: content.y,
          width: content.width,
          height: content.height,
        },
      });
    } catch {
      // ignore transient native bounds errors
    }
  }
  return surfaces;
}

export function sendToWorkspace(
  windowId: string,
  channel: string,
  payload: unknown,
): boolean {
  const record = registry.get(windowId);
  if (!record || record.kind !== "workspace") return false;
  const win = record.win;
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return false;
  // 拖标签时目标窗处于 blur，默认 backgroundThrottling 会推迟 accept/preview。
  win.webContents.backgroundThrottling = false;
  win.webContents.send(channel, payload);
  return true;
}

export function workspaceOuterBounds(windowId: string): WindowBounds | null {
  const record = registry.get(windowId);
  if (!record || record.kind !== "workspace") return null;
  const win = record.win;
  if (!win || win.isDestroyed()) return null;
  try {
    const bounds = win.getBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  } catch {
    return null;
  }
}

export function closeWorkspaceWindow(
  windowId: string | undefined,
  sender: BrowserWindow | null,
): void {
  const record = windowId
    ? registry.get(windowId)
    : sender
      ? registry.findByWin(sender)
      : registry.lastFocusedWorkspace();
  if (!record || record.kind !== "workspace") return;
  if (record.win.isDestroyed()) return;
  record.win.close();
}

/** 最近活动的 workspace 窗；兼容旧的单主窗调用点。 */
export function getMainWindow(): BrowserWindow | null {
  const record = registry.lastFocusedWorkspace();
  if (!record) return null;
  return record.win.isDestroyed() ? null : record.win;
}

export function getQuicknoteWindow(): BrowserWindow | null {
  for (const record of registry.all()) {
    if (record.kind !== "quicknote") continue;
    if (record.win.isDestroyed()) {
      registry.unregister(record.id);
      continue;
    }
    return record.win;
  }
  return null;
}

export function broadcast(channel: string, payload: unknown): void {
  for (const record of registry.all()) {
    const win = record.win;
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}
