import {
  readWindowContextFromArgv,
  getWindowId,
  resolveWindowContext,
  FALLBACK_WINDOW_ID,
} from "@/lib/electron/windowContext";
import { isElectronRuntime } from "@/lib/electron/runtime";
import type { SplitState } from "@/lib/editor-split/types";
import type { PersistedSplits, EditorSplitStore } from "./types";
import { editorSplitPersistKey } from "./types";
import { useEditorSplit } from "../useEditorSplit";
import { isSplitState } from "@/lib/editor-split/tree";

export const argvWindowContext = readWindowContextFromArgv();

export let splitWindowId = argvWindowContext?.windowId ?? getWindowId();

export let persistReady = Boolean(argvWindowContext) || !isElectronRuntime();

export function parseSplitState(raw: unknown): SplitState | null {
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

export function readPersisted(key: string): PersistedSplits | null {
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

export function loadPersisted(): PersistedSplits {
  if (!persistReady) return { byTabId: {} };
  return readPersisted(editorSplitPersistKey(splitWindowId)) ?? { byTabId: {} };
}

export let persistScheduled = false;

export let pendingPersist: EditorSplitStore | null = null;

export function persistSplits(state: EditorSplitStore) {
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

export function mergePersistedSplitsFromStorage(): void {
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

export function startEditorSplitPersistence() {
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
      if (
        prevId === FALLBACK_WINDOW_ID &&
        ctx.windowId !== FALLBACK_WINDOW_ID
      ) {
        try {
          window.localStorage.removeItem(editorSplitPersistKey(prevId));
        } catch {
          // 忽略
        }
      }
    });
  }
}
