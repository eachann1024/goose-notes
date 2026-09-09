import {
  DEFAULT_WORKSPACE_HEIGHT,
  DEFAULT_WORKSPACE_WIDTH,
  type WindowBounds,
  type WindowLayout,
  type WindowLayoutEntry,
  type WindowTabSnapshot,
  WINDOW_LAYOUT_VERSION,
} from "./windowLayout";

export type WindowKind = "workspace" | "quicknote";

export type WindowRecord<T = unknown> = {
  id: string;
  kind: WindowKind;
  win: T;
  tabs?: WindowTabSnapshot[];
};

export function shouldHideInsteadOfClose(opts: {
  quitting: boolean;
  kind: WindowKind;
  isLastWorkspace: boolean;
}): boolean {
  if (opts.quitting) return false;
  return opts.kind === "workspace" && opts.isLastWorkspace;
}

export class WindowRegistry<T = unknown> {
  private readonly byId = new Map<string, WindowRecord<T>>();
  private lastFocusedWorkspaceId: string | null = null;

  register(record: WindowRecord<T>): WindowRecord<T> {
    this.byId.set(record.id, record);
    if (record.kind === "workspace" && !this.lastFocusedWorkspaceId) {
      this.lastFocusedWorkspaceId = record.id;
    }
    return record;
  }

  unregister(id: string): WindowRecord<T> | undefined {
    const existing = this.byId.get(id);
    if (!existing) return undefined;
    this.byId.delete(id);
    if (this.lastFocusedWorkspaceId === id) {
      this.lastFocusedWorkspaceId = this.workspaces()[0]?.id ?? null;
    }
    return existing;
  }

  get(id: string): WindowRecord<T> | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  findByWin(win: T): WindowRecord<T> | undefined {
    for (const record of this.byId.values()) {
      if (record.win === win) return record;
    }
    return undefined;
  }

  all(): WindowRecord<T>[] {
    return [...this.byId.values()];
  }

  workspaces(): WindowRecord<T>[] {
    return this.all().filter((record) => record.kind === "workspace");
  }

  workspaceCount(): number {
    return this.workspaces().length;
  }

  isLastWorkspace(id: string): boolean {
    const record = this.byId.get(id);
    return Boolean(record && record.kind === "workspace" && this.workspaceCount() === 1);
  }

  quicknote(): WindowRecord<T> | undefined {
    return this.all().find((record) => record.kind === "quicknote");
  }

  markFocused(id: string): void {
    const record = this.byId.get(id);
    if (record?.kind === "workspace") {
      this.lastFocusedWorkspaceId = id;
    }
  }

  lastFocusedWorkspace(): WindowRecord<T> | undefined {
    if (this.lastFocusedWorkspaceId) {
      const record = this.byId.get(this.lastFocusedWorkspaceId);
      if (record?.kind === "workspace") return record;
    }
    return this.workspaces()[0];
  }

  setTabs(id: string, tabs: WindowTabSnapshot[] | undefined): void {
    const record = this.byId.get(id);
    if (!record) return;
    record.tabs = tabs && tabs.length > 0 ? tabs : undefined;
  }

  snapshotLayout(
    getBounds: (win: T) => WindowBounds | null,
    getChrome?: (
      win: T,
    ) => { maximized?: boolean; fullScreen?: boolean } | null,
  ): WindowLayout {
    const windows: WindowLayoutEntry[] = [];
    for (const record of this.workspaces()) {
      const bounds = getBounds(record.win) ?? {
        x: 0,
        y: 0,
        width: DEFAULT_WORKSPACE_WIDTH,
        height: DEFAULT_WORKSPACE_HEIGHT,
      };
      const entry: WindowLayoutEntry = { id: record.id, bounds };
      if (record.tabs && record.tabs.length > 0) entry.tabs = record.tabs;
      const chrome = getChrome?.(record.win);
      if (chrome?.maximized) entry.maximized = true;
      if (chrome?.fullScreen) entry.fullScreen = true;
      windows.push(entry);
    }
    return { version: WINDOW_LAYOUT_VERSION, windows };
  }
}
