/**
 * Electron 多 workspace 窗身份。
 *
 * 主进程给每个 BrowserWindow 注入 additionalArguments：
 *   --goose-window-id=<uuid>
 *   --goose-window-kind=workspace|quicknote
 *
 * 读取顺序：
 * 1. 当前进程 argv（preload / 未沙箱时可直接读 process.argv）
 * 2. gooseDesktop.getWindowContext()（沙箱渲染进程走 IPC）
 * 3. 回退 `main`，避免多窗抢无后缀的 persist key
 *
 * 新窗初始化不走 URL hash，由主进程在 did-finish-load 后发送：
 *   desktop:window-init
 *     - mode currentTab：{ takeTab }
 *     - 从 window-layout.json 恢复且带 tabs 快照：{ restoredTabs }
 *     - mode blank：不发此事件，渲染层自行 openWelcomeTab
 *
 * 请尽早订阅 gooseDesktop.onWindowInit，preload 会缓存最近一次 payload。
 */
export const FALLBACK_WINDOW_ID = "main";

export const TABS_PERSIST_KEY_PREFIX = "goose-note:open-tabs:v1";

export const GOOSE_WINDOW_ID_PREFIX = "--goose-window-id=";
export const GOOSE_WINDOW_KIND_PREFIX = "--goose-window-kind=";

export type GooseWindowKind = "workspace" | "quicknote";

export type GooseWindowContext = {
  windowId: string;
  kind: GooseWindowKind;
};

export type GooseWindowTabSnapshot = {
  id: string;
  pageId: string;
  type?: string;
  pinned?: boolean;
  workspaceId?: string;
};

export type GooseWindowInitPayload = {
  takeTab?: GooseWindowTabSnapshot;
  restoredTabs?: GooseWindowTabSnapshot[];
};

export type CreateDesktopWindowOpts = {
  mode: "blank" | "currentTab";
  tab?: GooseWindowTabSnapshot;
  bounds?: { x: number; y: number; width: number; height: number };
};

let cachedContext: GooseWindowContext | null = null;
let resolvePromise: Promise<GooseWindowContext> | null = null;
const listeners = new Set<(ctx: GooseWindowContext) => void>();

export function tabsPersistKey(windowId: string): string {
  return `${TABS_PERSIST_KEY_PREFIX}:${windowId}`;
}

export function gooseWindowAdditionalArguments(
  windowId: string,
  kind: GooseWindowKind,
): string[] {
  return [
    `${GOOSE_WINDOW_ID_PREFIX}${windowId}`,
    `${GOOSE_WINDOW_KIND_PREFIX}${kind}`,
  ];
}

export function parseGooseWindowArgs(argv: string[]): GooseWindowContext | null {
  let windowId = "";
  let kind: GooseWindowKind | "" = "";
  for (const arg of argv) {
    if (arg.startsWith(GOOSE_WINDOW_ID_PREFIX)) {
      windowId = arg.slice(GOOSE_WINDOW_ID_PREFIX.length).trim();
    } else if (arg.startsWith(GOOSE_WINDOW_KIND_PREFIX)) {
      const value = arg.slice(GOOSE_WINDOW_KIND_PREFIX.length).trim();
      if (value === "workspace" || value === "quicknote") kind = value;
    }
  }
  if (!windowId || !kind) return null;
  return { windowId, kind };
}

function readProcessArgv(): string[] {
  try {
    const argv = (globalThis as { process?: { argv?: unknown } }).process?.argv;
    return Array.isArray(argv)
      ? argv.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function readWindowContextFromArgv(
  argv: string[] = readProcessArgv(),
): GooseWindowContext | null {
  return parseGooseWindowArgs(argv);
}

export function getWindowId(): string {
  return cachedContext?.windowId ?? FALLBACK_WINDOW_ID;
}

export function getWindowContextSnapshot(): GooseWindowContext {
  return (
    cachedContext ?? {
      windowId: FALLBACK_WINDOW_ID,
      kind: "workspace",
    }
  );
}

export function subscribeWindowContext(
  listener: (ctx: GooseWindowContext) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitWindowContext(ctx: GooseWindowContext): void {
  cachedContext = ctx;
  listeners.forEach((listener) => listener(ctx));
}

function fallbackContext(): GooseWindowContext {
  return { windowId: FALLBACK_WINDOW_ID, kind: "workspace" };
}

export async function resolveWindowContext(): Promise<GooseWindowContext> {
  if (cachedContext) return cachedContext;
  if (!resolvePromise) {
    resolvePromise = (async () => {
      const fromArgv = readWindowContextFromArgv();
      if (fromArgv) {
        emitWindowContext(fromArgv);
        return fromArgv;
      }
      if (typeof window === "undefined") {
        const fallback = fallbackContext();
        emitWindowContext(fallback);
        return fallback;
      }
      try {
        const ctx = await window.gooseDesktop?.getWindowContext?.();
        const next: GooseWindowContext = ctx?.windowId
          ? {
              windowId: ctx.windowId,
              kind: ctx.kind === "quicknote" ? "quicknote" : "workspace",
            }
          : fallbackContext();
        emitWindowContext(next);
        return next;
      } catch {
        const fallback = fallbackContext();
        emitWindowContext(fallback);
        return fallback;
      }
    })();
  }
  return resolvePromise;
}

/** 契约名 getWindowContext：argv 优先，否则 IPC。 */
export async function getWindowContext(): Promise<GooseWindowContext> {
  return resolveWindowContext();
}

export async function createDesktopWindow(
  opts: CreateDesktopWindowOpts,
): Promise<{ windowId: string } | null> {
  if (typeof window === "undefined") return null;
  try {
    const result = await window.gooseDesktop?.createWindow?.(opts);
    return result ?? null;
  } catch {
    return null;
  }
}

export function tabToSnapshot(
  tab: GooseWindowTabSnapshot,
): GooseWindowTabSnapshot {
  const snapshot: GooseWindowTabSnapshot = {
    id: tab.id,
    pageId: tab.pageId,
  };
  if (tab.type) snapshot.type = tab.type;
  if (tab.pinned) snapshot.pinned = true;
  if (tab.workspaceId) snapshot.workspaceId = tab.workspaceId;
  return snapshot;
}

export type FinishTabDragResult =
  | { action: "none" }
  | { action: "tearOff"; windowId: string }
  | { action: "docked"; windowId: string };

export async function finishTabDrag(opts: {
  tab: GooseWindowTabSnapshot;
  cursor: { x: number; y: number };
  sourceTabCount: number;
  grabOffsetX?: number;
}): Promise<FinishTabDragResult> {
  if (typeof window === "undefined") return { action: "none" };
  try {
    const result = await window.gooseDesktop?.finishTabDrag?.(opts);
    return result ?? { action: "none" };
  } catch {
    return { action: "none" };
  }
}

export function previewTabDrag(cursor: { x: number; y: number }): void {
  if (typeof window === "undefined") return;
  void window.gooseDesktop?.tabDragMove?.(cursor);
}

export function cancelTabDragPreview(): void {
  if (typeof window === "undefined") return;
  void window.gooseDesktop?.tabDragCancel?.();
}

void resolveWindowContext();
