import { create } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";
import {
  FALLBACK_WINDOW_ID,
  getWindowId,
  readWindowContextFromArgv,
  resolveWindowContext,
} from "@/lib/electron/windowContext";
import { isElectronRuntime } from "@/lib/electron/runtime";
import {
  closeLeaf,
  createSingleLeafState,
  findLeaf,
  focusLeaf,
  focusedPageIdOf,
  isSplitState,
  neighborLeaf,
  replaceSizes,
  setLeafPage,
  splitLeaf,
  toggleZoom as toggleZoomTree,
} from "@/lib/editor-split/tree";
import type {
  CloseFocusedResult,
  SplitFocusedInput,
  SplitFocusedResult,
  SplitNeighborDirection,
  SplitState,
} from "@/lib/editor-split/types";

export const EDITOR_SPLIT_PERSIST_KEY_PREFIX = "goose-note:editor-split:v1";

export function editorSplitPersistKey(windowId: string): string {
  return `${EDITOR_SPLIT_PERSIST_KEY_PREFIX}:${windowId}`;
}

const argvWindowContext = readWindowContextFromArgv();
let splitWindowId = argvWindowContext?.windowId ?? getWindowId();
let persistReady = Boolean(argvWindowContext) || !isElectronRuntime();

type PersistedSplits = {
  byTabId: Record<string, SplitState>;
};

export type EditorSplitStore = {
  byTabId: Record<string, SplitState>;
  getStateForTab: (tabId: string) => SplitState | null;
  splitFocused: (input: SplitFocusedInput) => SplitFocusedResult;
  closeFocused: (tabId: string) => CloseFocusedResult;
  focusPane: (tabId: string, paneId: string) => void;
  focusNeighbor: (
    tabId: string,
    dir: SplitNeighborDirection,
  ) => string | null;
  setGroupSizes: (tabId: string, groupId: string, sizes: number[]) => void;
  toggleZoom: (tabId: string) => void;
  setPanePage: (tabId: string, paneId: string, pageId: string) => void;
  ensureTab: (tabId: string, pageId: string) => void;
  clearTab: (tabId: string) => void;
  focusedPageId: (tabId: string) => string | null;
  isSplit: (tabId: string) => boolean;
};

function parseSplitState(raw: unknown): SplitState | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    const cloned = structuredClone(raw) as SplitState;
    if (!cloned.root || typeof cloned.focusedLeafId !== "string") return null;
    const leaves = [];
    const stack = [cloned.root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;
      if (node.kind === "leaf") {
        if (typeof node.id !== "string" || typeof node.pageId !== "string") {
          return null;
        }
        leaves.push(node);
        continue;
      }
      if (node.kind !== "group") return null;
      if (
        node.orientation !== "horizontal" &&
        node.orientation !== "vertical"
      ) {
        return null;
      }
      if (!Array.isArray(node.children) || node.children.length < 2) {
        return null;
      }
      stack.push(...node.children);
    }
    if (leaves.length === 0 || leaves.length > 4) return null;
    if (!leaves.some((leaf) => leaf.id === cloned.focusedLeafId)) return null;
    if (
      cloned.zoomedLeafId &&
      !leaves.some((leaf) => leaf.id === cloned.zoomedLeafId)
    ) {
      cloned.zoomedLeafId = null;
    }
    return cloned;
  } catch {
    return null;
  }
}

function readPersisted(key: string): PersistedSplits | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSplits>;
    if (!parsed.byTabId || typeof parsed.byTabId !== "object") return null;
    const byTabId: Record<string, SplitState> = {};
    for (const [tabId, value] of Object.entries(parsed.byTabId)) {
      const state = parseSplitState(value);
      if (state) byTabId[tabId] = state;
    }
    return { byTabId };
  } catch {
    return null;
  }
}

function loadPersisted(): PersistedSplits {
  if (!persistReady) return { byTabId: {} };
  return readPersisted(editorSplitPersistKey(splitWindowId)) ?? { byTabId: {} };
}

let persistScheduled = false;
let pendingPersist: EditorSplitStore | null = null;

function persistSplits(state: EditorSplitStore) {
  if (typeof window === "undefined") return;
  if (!persistReady) return;
  pendingPersist = state;
  if (persistScheduled) return;
  persistScheduled = true;
  queueMicrotask(() => {
    persistScheduled = false;
    const latest = pendingPersist;
    pendingPersist = null;
    if (!latest) return;
    try {
      window.localStorage.setItem(
        editorSplitPersistKey(splitWindowId),
        JSON.stringify({ byTabId: latest.byTabId }),
      );
    } catch {
      // 隐私模式 / 配额
    }
  });
}

function patchTab(
  byTabId: Record<string, SplitState>,
  tabId: string,
  next: SplitState | null,
): Record<string, SplitState> {
  if (!next) {
    if (!(tabId in byTabId)) return byTabId;
    const rest = { ...byTabId };
    delete rest[tabId];
    return rest;
  }
  return { ...byTabId, [tabId]: next };
}

const persisted = loadPersisted();

export const useEditorSplit = create<EditorSplitStore>()((set, get) => ({
  byTabId: persisted.byTabId,

  getStateForTab: (tabId) => get().byTabId[tabId] ?? null,

  splitFocused: (input) => {
    const current = get().byTabId[input.tabId];
    if (!current) {
      return { ok: false, error: "找不到当前分屏格子" };
    }
    const result = splitLeaf(current, {
      direction: input.direction,
      newPageId: input.newPageId,
      editorWidthPx: input.editorWidthPx,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    set({ byTabId: patchTab(get().byTabId, input.tabId, result.state) });
    return {
      ok: true,
      didFallbackToDown: result.didFallbackToDown,
      newLeafId: result.newLeafId,
      newPageId: input.newPageId,
    };
  },

  closeFocused: (tabId) => {
    const current = get().byTabId[tabId];
    if (!current) return { kind: "last-pane" };
    const result = closeLeaf(current);
    if (result.kind === "last-pane") return { kind: "last-pane" };
    set({ byTabId: patchTab(get().byTabId, tabId, result.state) });
    return {
      kind: "updated",
      focusedPageId: focusedPageIdOf(result.state),
    };
  },

  focusPane: (tabId, paneId) => {
    const current = get().byTabId[tabId];
    if (!current) return;
    const next = focusLeaf(current, paneId);
    if (next === current) return;
    set({ byTabId: patchTab(get().byTabId, tabId, next) });
  },

  focusNeighbor: (tabId, dir) => {
    const current = get().byTabId[tabId];
    if (!current) return null;
    const neighbor = neighborLeaf(current, current.focusedLeafId, dir);
    if (!neighbor) return null;
    set({
      byTabId: patchTab(get().byTabId, tabId, focusLeaf(current, neighbor.id)),
    });
    return neighbor.id;
  },

  setGroupSizes: (tabId, groupId, sizes) => {
    const current = get().byTabId[tabId];
    if (!current) return;
    const next = replaceSizes(current, groupId, sizes);
    if (next === current) return;
    set({ byTabId: patchTab(get().byTabId, tabId, next) });
  },

  toggleZoom: (tabId) => {
    const current = get().byTabId[tabId];
    if (!current) return;
    set({ byTabId: patchTab(get().byTabId, tabId, toggleZoomTree(current)) });
  },

  setPanePage: (tabId, paneId, pageId) => {
    const current = get().byTabId[tabId];
    if (!current) return;
    const next = setLeafPage(current, paneId, pageId);
    if (next === current) return;
    set({ byTabId: patchTab(get().byTabId, tabId, next) });
  },

  ensureTab: (tabId, pageId) => {
    const current = get().byTabId[tabId];
    if (!current) {
      set({
        byTabId: patchTab(get().byTabId, tabId, createSingleLeafState(pageId)),
      });
      return;
    }
    // 未分屏：侧栏切页会改 tab.pageId 但复用同一 tabId。叶子必须跟着换，
    // 否则 WorkspaceLayout 会把 focusedPageId 写回活动页，多窗单标签切页被吃掉。
    // 已分屏不改树，由 tryShowPageInFocusedSplit 换格。
    if (isSplitState(current)) return;
    if (focusedPageIdOf(current) === pageId) return;
    const next = setLeafPage(current, current.focusedLeafId, pageId);
    if (next === current) return;
    set({ byTabId: patchTab(get().byTabId, tabId, next) });
  },

  clearTab: (tabId) => {
    if (!(tabId in get().byTabId)) return;
    set({ byTabId: patchTab(get().byTabId, tabId, null) });
  },

  focusedPageId: (tabId) => {
    const current = get().byTabId[tabId];
    return current ? focusedPageIdOf(current) : null;
  },

  isSplit: (tabId) => {
    const current = get().byTabId[tabId];
    return current ? isSplitState(current) : false;
  },
}));

/**
 * zustand v5 会静默丢掉 hook 第二个 equalityFn。要比较引用请走这里。
 */
export function useEditorSplitSelector<T>(
  selector: (state: EditorSplitStore) => T,
  equalityFn: (a: T, b: T) => boolean,
): T {
  return useStoreWithEqualityFn(useEditorSplit, selector, equalityFn);
}

export function findTabLeaf(tabId: string, paneId: string) {
  const state = useEditorSplit.getState().getStateForTab(tabId);
  return state ? findLeaf(state.root, paneId) : null;
}

/** 把某 tab 的分屏树写入目标窗 persist（同源 localStorage，按 windowId 隔离）。 */
export function writeTabSplitForWindow(
  windowId: string,
  tabId: string,
  tree: SplitState,
): void {
  if (typeof window === "undefined") return;
  if (!windowId || !tabId) return;
  const key = editorSplitPersistKey(windowId);
  const existing = readPersisted(key) ?? { byTabId: {} };
  existing.byTabId[tabId] = tree;
  try {
    window.localStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // 隐私模式 / 配额
  }
}

/**
 * 目标窗从 persist 接回该 tab 的树。已有分屏则不覆盖；单叶占位可被完整树替换。
 */
export function applyPersistedTabSplit(
  tabId: string,
  windowId: string = splitWindowId,
): boolean {
  if (!tabId) return false;
  const persisted = readPersisted(editorSplitPersistKey(windowId));
  const tree = persisted?.byTabId[tabId];
  if (!tree) return false;
  const current = useEditorSplit.getState().byTabId[tabId];
  if (current && isSplitState(current)) return false;
  if (current && !isSplitState(tree)) return false;
  useEditorSplit.setState({
    byTabId: { ...useEditorSplit.getState().byTabId, [tabId]: tree },
  });
  return true;
}

function mergePersistedSplitsFromStorage(): void {
  const persisted = readPersisted(editorSplitPersistKey(splitWindowId));
  if (!persisted) return;
  const current = useEditorSplit.getState().byTabId;
  let next: Record<string, SplitState> | null = null;
  for (const [tabId, tree] of Object.entries(persisted.byTabId)) {
    if (!(tabId in current)) continue;
    const existing = current[tabId];
    if (existing && isSplitState(existing)) continue;
    if (!isSplitState(tree) && existing) continue;
    if (!next) next = { ...current };
    next[tabId] = tree;
  }
  if (next) useEditorSplit.setState({ byTabId: next });
}

if (typeof window !== "undefined") {
  useEditorSplit.subscribe((state) => persistSplits(state));
  window.addEventListener("storage", (event) => {
    if (event.key !== editorSplitPersistKey(splitWindowId)) return;
    mergePersistedSplitsFromStorage();
  });
  void resolveWindowContext().then((ctx) => {
    persistReady = true;
    const prevId = splitWindowId;
    splitWindowId = ctx.windowId;
    const dest = readPersisted(editorSplitPersistKey(ctx.windowId));
    if (dest) {
      useEditorSplit.setState({ byTabId: dest.byTabId });
      return;
    }
    persistSplits(useEditorSplit.getState());
    if (prevId === FALLBACK_WINDOW_ID && ctx.windowId !== FALLBACK_WINDOW_ID) {
      try {
        window.localStorage.removeItem(editorSplitPersistKey(prevId));
      } catch {
        // 忽略
      }
    }
  });
}
