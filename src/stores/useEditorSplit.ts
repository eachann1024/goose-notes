import type { SplitState } from "@/lib/editor-split/types";
import {
  loadPersisted,
  startEditorSplitPersistence,
} from "./editorSplit/persistence";
import { create } from "zustand";
import type { EditorSplitStore } from "./editorSplit/types";
import {
  splitLeaf,
  closeLeaf,
  focusedPageIdOf,
  focusLeaf,
  neighborLeaf,
  replaceSizes,
  toggleZoom as toggleZoomTree,
  setLeafPage,
  createSingleLeafState,
  isSplitState,
  findLeaf,
} from "@/lib/editor-split/tree";
import { useStoreWithEqualityFn } from "zustand/traditional";

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
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    set({ byTabId: patchTab(get().byTabId, input.tabId, result.state) });
    return {
      ok: true,
      newLeafId: result.newLeafId,
      newPageId: input.newPageId,
    };
  },

  closePane: (tabId, leafId) => {
    const current = get().byTabId[tabId];
    if (!current) return { kind: "last-pane" };
    const result = closeLeaf(current, leafId);
    if (result.kind === "last-pane") return { kind: "last-pane" };
    if (result.state === current) {
      return {
        kind: "updated",
        focusedPageId: focusedPageIdOf(current),
      };
    }
    set({ byTabId: patchTab(get().byTabId, tabId, result.state) });
    return {
      kind: "updated",
      focusedPageId: focusedPageIdOf(result.state),
    };
  },

  closeFocused: (tabId) => {
    const current = get().byTabId[tabId];
    if (!current) return { kind: "last-pane" };
    return get().closePane(tabId, current.focusedLeafId);
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

export {
  EDITOR_SPLIT_PERSIST_KEY_PREFIX,
  editorSplitPersistKey,
  type EditorSplitStore,
} from "./editorSplit/types";
export {
  writeTabSplitForWindow,
  applyPersistedTabSplit,
} from "./editorSplit/persistence";

startEditorSplitPersistence();
