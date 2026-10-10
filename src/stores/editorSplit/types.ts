import type {
  SplitState,
  SplitFocusedInput,
  SplitFocusedResult,
  CloseFocusedResult,
  SplitNeighborDirection,
} from "@/lib/editor-split/types";

export const EDITOR_SPLIT_PERSIST_KEY_PREFIX = "goose-note:editor-split:v1";

export function editorSplitPersistKey(windowId: string): string {
  return `${EDITOR_SPLIT_PERSIST_KEY_PREFIX}:${windowId}`;
}

export type PersistedSplits = {
  byTabId: Record<string, SplitState>;
};

export type EditorSplitStore = {
  byTabId: Record<string, SplitState>;
  getStateForTab: (tabId: string) => SplitState | null;
  splitFocused: (input: SplitFocusedInput) => SplitFocusedResult;
  closeFocused: (tabId: string) => CloseFocusedResult;
  closePane: (tabId: string, leafId: string) => CloseFocusedResult;
  focusPane: (tabId: string, paneId: string) => void;
  focusNeighbor: (tabId: string, dir: SplitNeighborDirection) => string | null;
  setGroupSizes: (tabId: string, groupId: string, sizes: number[]) => void;
  toggleZoom: (tabId: string) => void;
  setPanePage: (tabId: string, paneId: string, pageId: string) => void;
  ensureTab: (tabId: string, pageId: string) => void;
  clearTab: (tabId: string) => void;
  focusedPageId: (tabId: string) => string | null;
  isSplit: (tabId: string) => boolean;
};
