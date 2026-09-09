import path from "node:path";

export const WINDOW_LAYOUT_FILE = "window-layout.json";
export const WINDOW_LAYOUT_VERSION = 1 as const;

export const DEFAULT_WORKSPACE_WIDTH = 1250;
export const DEFAULT_WORKSPACE_HEIGHT = 800;
export const NEW_WINDOW_OFFSET_PX = 32;
export const MIN_WORKSPACE_WIDTH = 800;
export const MIN_WORKSPACE_HEIGHT = 560;
export const MIN_QUICKNOTE_WIDTH = 320;
export const MIN_QUICKNOTE_HEIGHT = 240;

export type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowTabSnapshot = {
  id: string;
  pageId: string;
  type?: string;
  pinned?: boolean;
  workspaceId?: string;
};

export type WindowLayoutEntry = {
  id: string;
  bounds: WindowBounds;
  tabs?: WindowTabSnapshot[];
  maximized?: boolean;
  fullScreen?: boolean;
};

export type QuicknoteLayout = {
  bounds: WindowBounds;
};

export type WindowLayout = {
  version: typeof WINDOW_LAYOUT_VERSION;
  windows: WindowLayoutEntry[];
  quicknote?: QuicknoteLayout;
};

export function windowLayoutFilePath(userDataPath: string): string {
  return path.join(userDataPath, WINDOW_LAYOUT_FILE);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidBounds(value: unknown): value is WindowBounds {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return (
    isFiniteNumber(rec.x) &&
    isFiniteNumber(rec.y) &&
    isFiniteNumber(rec.width) &&
    rec.width > 0 &&
    isFiniteNumber(rec.height) &&
    rec.height > 0
  );
}

export function parseTabSnapshot(value: unknown): WindowTabSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.id !== "string" || !rec.id.trim()) return null;
  if (typeof rec.pageId !== "string" || !rec.pageId.trim()) return null;
  const tab: WindowTabSnapshot = { id: rec.id, pageId: rec.pageId };
  if (typeof rec.type === "string") tab.type = rec.type;
  if (typeof rec.pinned === "boolean") tab.pinned = rec.pinned;
  if (typeof rec.workspaceId === "string") tab.workspaceId = rec.workspaceId;
  return tab;
}

function parseLayoutEntry(value: unknown): WindowLayoutEntry | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.id !== "string" || !rec.id.trim()) return null;
  if (!isValidBounds(rec.bounds)) return null;
  const entry: WindowLayoutEntry = {
    id: rec.id,
    bounds: {
      x: rec.bounds.x,
      y: rec.bounds.y,
      width: rec.bounds.width,
      height: rec.bounds.height,
    },
  };
  if (Array.isArray(rec.tabs)) {
    const tabs = rec.tabs
      .map(parseTabSnapshot)
      .filter((tab): tab is WindowTabSnapshot => Boolean(tab));
    if (tabs.length > 0) entry.tabs = tabs;
  }
  if (rec.maximized === true) entry.maximized = true;
  if (rec.fullScreen === true) entry.fullScreen = true;
  return entry;
}

export function parseQuicknoteLayout(value: unknown): QuicknoteLayout | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (!isValidBounds(rec.bounds)) return null;
  return {
    bounds: {
      x: rec.bounds.x,
      y: rec.bounds.y,
      width: rec.bounds.width,
      height: rec.bounds.height,
    },
  };
}

export function parseWindowLayout(raw: string): WindowLayout | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const rec = parsed as Record<string, unknown>;
  if (rec.version !== WINDOW_LAYOUT_VERSION) return null;
  if (!Array.isArray(rec.windows)) return null;
  const windows = rec.windows
    .map(parseLayoutEntry)
    .filter((entry): entry is WindowLayoutEntry => Boolean(entry));
  const layout: WindowLayout = { version: WINDOW_LAYOUT_VERSION, windows };
  const quicknote = parseQuicknoteLayout(rec.quicknote);
  if (quicknote) layout.quicknote = quicknote;
  return layout;
}

export function serializeWindowLayout(layout: WindowLayout): string {
  return `${JSON.stringify(layout, null, 2)}\n`;
}

export function clampBoundsToWorkArea(
  bounds: WindowBounds,
  workArea: WindowBounds,
  minSize: { width: number; height: number } = {
    width: MIN_WORKSPACE_WIDTH,
    height: MIN_WORKSPACE_HEIGHT,
  },
): WindowBounds {
  const width = Math.min(
    Math.max(minSize.width, bounds.width),
    Math.max(1, workArea.width),
  );
  const height = Math.min(
    Math.max(minSize.height, bounds.height),
    Math.max(1, workArea.height),
  );
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  const x = Math.min(Math.max(bounds.x, workArea.x), Math.max(workArea.x, maxX));
  const y = Math.min(Math.max(bounds.y, workArea.y), Math.max(workArea.y, maxY));
  return { x, y, width, height };
}

export function computeOffsetBounds(
  source: WindowBounds | null,
  workArea: WindowBounds,
  size: { width: number; height: number } = {
    width: DEFAULT_WORKSPACE_WIDTH,
    height: DEFAULT_WORKSPACE_HEIGHT,
  },
  offset = NEW_WINDOW_OFFSET_PX,
): WindowBounds {
  if (!source) {
    return clampBoundsToWorkArea(
      {
        x: workArea.x + Math.round((workArea.width - size.width) / 2),
        y: workArea.y + Math.round((workArea.height - size.height) / 2),
        width: size.width,
        height: size.height,
      },
      workArea,
    );
  }
  return clampBoundsToWorkArea(
    {
      x: source.x + offset,
      y: source.y + offset,
      width: size.width,
      height: size.height,
    },
    workArea,
  );
}
