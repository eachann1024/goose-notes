import {
  readWindowContextFromArgv,
  getWindowId,
  tabsPersistKey,
  FALLBACK_WINDOW_ID,
  resolveWindowContext,
} from "@/lib/electron/windowContext";
import { isElectronRuntime } from "@/lib/electron/runtime";
import type { TabItem, TabsState } from "./types";
import type {
  GooseWindowTabSnapshot,
  GooseWindowInitPayload,
} from "@/lib/electron/windowContext";
import {
  ensureSplitForWorkspaceTab,
  syncEditorSplitsToOpenTabs,
} from "./helpers";
import { usePages } from "../usePages";
import { applyPersistedTabSplit } from "../useEditorSplit";

export const LEGACY_TABS_PERSIST_KEY = "goose-note:open-tabs:v1";

export const argvWindowContext = readWindowContextFromArgv();

export let tabsWindowId = argvWindowContext?.windowId ?? getWindowId();

/** Electron 在 IPC 给出真实 windowId 前不要读写无后缀 / `:main` 键，避免多窗抢同一份 persist。 */
export let persistReady = Boolean(argvWindowContext) || !isElectronRuntime();

export interface PersistedTabs {
  openTabs: TabItem[];
  activeTabId: string | null;
  recentlyClosedPageIds: string[];
}

export const readPersistedTabsRaw = (key: string): PersistedTabs | null => {
  if (typeof window === "undefined") return null;
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedTabs>;
    if (!Array.isArray(parsed.openTabs)) return null;
    return {
      openTabs: parsed.openTabs
        .filter(
          (t) => t && typeof t.id === "string" && typeof t.pageId === "string",
        )
        .map((t) => ({
          ...t,
          lastAccessedAt:
            typeof t.lastAccessedAt === "number" &&
            Number.isFinite(t.lastAccessedAt)
              ? t.lastAccessedAt
              : now,
        })),
      activeTabId:
        typeof parsed.activeTabId === "string" ? parsed.activeTabId : null,
      recentlyClosedPageIds: Array.isArray(parsed.recentlyClosedPageIds)
        ? parsed.recentlyClosedPageIds.filter((id) => typeof id === "string")
        : [],
    };
  } catch {
    return null;
  }
};

export const loadPersistedTabs = (): PersistedTabs | null => {
  if (!persistReady) return null;
  const keyed = readPersistedTabsRaw(tabsPersistKey(tabsWindowId));
  if (keyed) return keyed;
  if (tabsWindowId !== FALLBACK_WINDOW_ID) return null;
  const legacy = readPersistedTabsRaw(LEGACY_TABS_PERSIST_KEY);
  if (!legacy || typeof window === "undefined") return legacy;
  try {
    window.localStorage.setItem(
      tabsPersistKey(FALLBACK_WINDOW_ID),
      JSON.stringify(legacy),
    );
    window.localStorage.removeItem(LEGACY_TABS_PERSIST_KEY);
  } catch {
    // 忽略存储异常（隐私模式 / 配额）
  }
  return legacy;
};

export let persistScheduled = false;

export let pendingPersistState: TabsState | null = null;

export const persistTabs = (state: TabsState) => {
  if (typeof window === "undefined") return;
  if (!persistReady) return;
  pendingPersistState = state;
  if (persistScheduled) return;
  persistScheduled = true;
  queueMicrotask(() => {
    persistScheduled = false;
    const latestState = pendingPersistState;
    pendingPersistState = null;
    if (!latestState) return;
    try {
      const persistableTabs = latestState.openTabs.map((tab) =>
        tab.preview ? { ...tab, preview: false } : tab,
      );
      const activeStillValid = persistableTabs.some(
        (tab) => tab.id === latestState.activeTabId,
      );
      const payload: PersistedTabs = {
        openTabs: persistableTabs,
        activeTabId: activeStillValid
          ? latestState.activeTabId
          : (persistableTabs[persistableTabs.length - 1]?.id ?? null),
        recentlyClosedPageIds: latestState.recentlyClosedPageIds.slice(0, 10),
      };
      window.localStorage.setItem(
        tabsPersistKey(tabsWindowId),
        JSON.stringify(payload),
      );
    } catch {
      // 忽略存储异常（隐私模式 / 配额）
    }
  });
};

export function startTabsPersistence(
  useTabs: import("zustand").StoreApi<TabsState>,
) {
  // 标签状态变化时持久化（跨会话恢复上次打开的标签）。
  if (typeof window !== "undefined") {
    const applyTabSnapshots = (
      tabs: GooseWindowTabSnapshot[],
      activeId?: string,
    ) => {
      const now = Date.now();
      const openTabs: TabItem[] = tabs.map((tab) => ({
        id: tab.id,
        pageId: tab.pageId,
        type: tab.type as TabItem["type"],
        pinned: tab.pinned,
        workspaceId: tab.workspaceId,
        lastAccessedAt: now,
      }));
      const activeTabId = activeId ?? openTabs[0]?.id ?? null;
      useTabs.setState({ openTabs, activeTabId });
      const active =
        openTabs.find((tab) => tab.id === activeTabId) ?? openTabs[0];
      if (!active) return;
      ensureSplitForWorkspaceTab(active);
      if (active.type === "welcome") {
        void usePages.getState().setActivePage(null);
        return;
      }
      useTabs.getState().syncNotebookForPage(active.pageId);
      void usePages.getState().setActivePage(active.pageId);
    };

    let appliedTakeTab = false;
    let pendingRestoredTabs: GooseWindowTabSnapshot[] | null = null;

    const applyWindowInit = (payload: GooseWindowInitPayload) => {
      if (payload.takeTab) {
        appliedTakeTab = true;
        pendingRestoredTabs = null;
        applyTabSnapshots([payload.takeTab], payload.takeTab.id);
        applyPersistedTabSplit(payload.takeTab.id, tabsWindowId);
        persistTabs(useTabs.getState());
        return;
      }
      if (payload.restoredTabs && payload.restoredTabs.length > 0) {
        if (appliedTakeTab) return;
        if (!persistReady) {
          pendingRestoredTabs = payload.restoredTabs;
          return;
        }
        const dest = readPersistedTabsRaw(tabsPersistKey(tabsWindowId));
        if (dest?.openTabs.length) return;
        applyTabSnapshots(payload.restoredTabs);
        persistTabs(useTabs.getState());
      }
    };

    window.gooseDesktop?.onWindowInit?.(applyWindowInit);

    useTabs.subscribe((state) => persistTabs(state));
    useTabs.subscribe((state, prev) => {
      if (
        state.openTabs === prev.openTabs &&
        state.activeTabId === prev.activeTabId
      ) {
        return;
      }
      syncEditorSplitsToOpenTabs(state.openTabs, state.activeTabId);
    });
    syncEditorSplitsToOpenTabs(
      useTabs.getState().openTabs,
      useTabs.getState().activeTabId,
    );
    void resolveWindowContext().then((ctx) => {
      persistReady = true;
      const prevId = tabsWindowId;
      tabsWindowId = ctx.windowId;
      if (appliedTakeTab) {
        persistTabs(useTabs.getState());
        const takeId = useTabs.getState().activeTabId;
        if (takeId) applyPersistedTabSplit(takeId, ctx.windowId);
        return;
      }
      const dest = readPersistedTabsRaw(tabsPersistKey(ctx.windowId));
      if (dest) {
        useTabs.setState({
          openTabs: dest.openTabs,
          activeTabId: dest.activeTabId,
          recentlyClosedPageIds: dest.recentlyClosedPageIds,
        });
        pendingRestoredTabs = null;
        return;
      }
      if (pendingRestoredTabs && pendingRestoredTabs.length > 0) {
        applyTabSnapshots(pendingRestoredTabs);
        pendingRestoredTabs = null;
      }
      persistTabs(useTabs.getState());
      if (
        prevId === FALLBACK_WINDOW_ID &&
        ctx.windowId !== FALLBACK_WINDOW_ID
      ) {
        try {
          window.localStorage.removeItem(tabsPersistKey(prevId));
        } catch {
          // 忽略存储异常
        }
      }
    });
  }
}
