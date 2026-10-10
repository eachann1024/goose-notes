import type { BrowserWindow } from "electron";
import { screen } from "electron";
import {
  resolveTabDrag,
  tearOffWindowBounds,
  type ScreenPoint,
  type TabDragResolution,
} from "../../src/lib/electron/tabTearOff";
import { clampBoundsToWorkArea, parseTabSnapshot } from "./windowLayout";
import {
  createWorkspaceWindow,
  currentTitleBarHeight,
  listWorkspaceDockSurfaces,
  lookupWindowContext,
  sendToWorkspace,
  workspaceOuterBounds,
} from "./windows";

export const ACCEPT_TAB_CHANNEL = "desktop:accept-tab";
export const TAB_DOCK_PREVIEW_CHANNEL = "desktop:tab-dock-preview";

export type FinishTabDragPayload = {
  tab?: unknown;
  cursor?: unknown;
  sourceTabCount?: unknown;
  grabOffsetX?: unknown;
};

export type FinishTabDragResult =
  | { action: "none" }
  | { action: "tearOff"; windowId: string }
  | { action: "docked"; windowId: string };

type DockPreviewPayload = { contentX: number | null };

const previewTargetBySource = new Map<string, string>();

function parseCursor(value: unknown): ScreenPoint | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.x !== "number" || !Number.isFinite(rec.x)) return null;
  if (typeof rec.y !== "number" || !Number.isFinite(rec.y)) return null;
  return { x: rec.x, y: rec.y };
}

function parseSourceTabCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function parseGrabOffsetX(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function workAreaNear(point: ScreenPoint) {
  const area = screen.getDisplayNearestPoint(point).workArea;
  return { x: area.x, y: area.y, width: area.width, height: area.height };
}

function resolveFromSource(
  source: BrowserWindow,
  cursor: ScreenPoint,
  sourceTabCount: number,
): { sourceWindowId: string; resolution: TabDragResolution } | null {
  const context = lookupWindowContext(source);
  if (!context || context.kind !== "workspace") return null;
  const resolution = resolveTabDrag({
    sourceWindowId: context.windowId,
    sourceTabCount,
    cursor,
    surfaces: listWorkspaceDockSurfaces(),
    titleBarHeight: currentTitleBarHeight(),
  });
  return { sourceWindowId: context.windowId, resolution };
}

function clearPreview(sourceWindowId: string): void {
  const previous = previewTargetBySource.get(sourceWindowId);
  previewTargetBySource.delete(sourceWindowId);
  if (!previous) return;
  sendToWorkspace(previous, TAB_DOCK_PREVIEW_CHANNEL, {
    contentX: null,
  } satisfies DockPreviewPayload);
}

function setPreview(
  sourceWindowId: string,
  targetWindowId: string | null,
  contentX: number | null,
): void {
  const previous = previewTargetBySource.get(sourceWindowId);
  if (previous && previous !== targetWindowId) {
    sendToWorkspace(previous, TAB_DOCK_PREVIEW_CHANNEL, {
      contentX: null,
    } satisfies DockPreviewPayload);
  }
  if (targetWindowId && contentX != null) {
    previewTargetBySource.set(sourceWindowId, targetWindowId);
    sendToWorkspace(targetWindowId, TAB_DOCK_PREVIEW_CHANNEL, {
      contentX,
    } satisfies DockPreviewPayload);
    return;
  }
  previewTargetBySource.delete(sourceWindowId);
}

export function previewTabDrag(
  source: BrowserWindow | null,
  cursorValue: unknown,
): void {
  if (!source || source.isDestroyed()) return;
  const cursor = parseCursor(cursorValue);
  if (!cursor) return;
  const resolved = resolveFromSource(source, cursor, 2);
  if (!resolved) return;
  if (resolved.resolution.action === "dock") {
    setPreview(
      resolved.sourceWindowId,
      resolved.resolution.targetWindowId,
      resolved.resolution.contentX,
    );
    return;
  }
  setPreview(resolved.sourceWindowId, null, null);
}

export function cancelTabDrag(source: BrowserWindow | null): void {
  if (!source || source.isDestroyed()) return;
  const context = lookupWindowContext(source);
  if (!context || context.kind !== "workspace") return;
  clearPreview(context.windowId);
}

export function finishTabDrag(
  source: BrowserWindow | null,
  payload: FinishTabDragPayload,
): FinishTabDragResult {
  if (!source || source.isDestroyed()) return { action: "none" };
  const tab = parseTabSnapshot(payload.tab);
  const cursor = parseCursor(payload.cursor);
  if (!tab || !cursor) return { action: "none" };
  const sourceTabCount = parseSourceTabCount(payload.sourceTabCount);
  const resolved = resolveFromSource(source, cursor, sourceTabCount);
  if (!resolved) return { action: "none" };
  clearPreview(resolved.sourceWindowId);

  if (resolved.resolution.action === "dock") {
    const ok = sendToWorkspace(
      resolved.resolution.targetWindowId,
      ACCEPT_TAB_CHANNEL,
      { tab, contentX: resolved.resolution.contentX },
    );
    if (!ok) return { action: "none" };
    return { action: "docked", windowId: resolved.resolution.targetWindowId };
  }

  if (resolved.resolution.action !== "tearOff") return { action: "none" };

  const sourceBounds = workspaceOuterBounds(resolved.sourceWindowId);
  if (!sourceBounds) return { action: "none" };
  const raw = tearOffWindowBounds({
    cursor,
    source: sourceBounds,
    grabOffsetX: parseGrabOffsetX(payload.grabOffsetX),
    titleBarHeight: currentTitleBarHeight(),
  });
  const bounds = clampBoundsToWorkArea(raw, workAreaNear(cursor));
  const win = createWorkspaceWindow({
    mode: "currentTab",
    tab,
    bounds,
    sourceWindow: source,
  });
  const created = lookupWindowContext(win);
  return { action: "tearOff", windowId: created?.windowId ?? "" };
}
