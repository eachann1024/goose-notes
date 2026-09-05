/**
 * 常规笔记本分屏命令。快捷键代理只应调用这里，不要改 WorkspaceLayout。
 *
 * - splitRight() / splitDown()
 * - closePaneOrTab() → "closed-pane" | "close-tab"
 * - focusNeighbor("left" | "right" | "up" | "down")
 * - toggleZoom()
 */
import { toast } from "@/components/ui/sonner";
import { isNotebookAiFullscreenOpen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { isUnsavedLocalPage, localPageHasPersistableContent } from "@/lib/unsavedLocalPage";
import { walkLeaves } from "@/lib/editor-split/tree";
import type { SplitDirection, SplitNeighborDirection } from "@/lib/editor-split/types";
import { useEditorSplit } from "@/stores/useEditorSplit";
import { useHistoryView } from "@/stores/useHistoryView";
import { flushEditorContent, usePages } from "@/stores/usePages";
import { isSpecialTab, useTabs } from "@/stores/useTabs";
import { createSplitBlankPage } from "./createBlankPage";

export type ClosePaneOrTabResult = "close-tab" | "closed-pane";

function activeWorkspaceTab() {
  const { activeTabId, openTabs } = useTabs.getState();
  if (!activeTabId) return null;
  return openTabs.find((tab) => tab.id === activeTabId) ?? null;
}

function isHistoryPreviewSurface(): boolean {
  const historyPageId = useHistoryView.getState().active;
  if (!historyPageId) return false;
  return historyPageId === usePages.getState().activePageId;
}

function isNormalEditorSurface(): boolean {
  if (isNotebookAiFullscreenOpen()) return false;
  if (isHistoryPreviewSurface()) return false;
  const tab = activeWorkspaceTab();
  if (!tab || isSpecialTab(tab)) return false;
  const page = usePages.getState().getPage(tab.pageId);
  if (page?.isFolder) return false;
  return true;
}

function canSplitCurrentView(): string | null {
  if (isNotebookAiFullscreenOpen()) return "全屏 AI 下不能分屏";
  const tab = activeWorkspaceTab();
  if (!tab || isSpecialTab(tab)) return "当前视图不能分屏";
  const page = usePages.getState().getPage(tab.pageId);
  if (page?.isFolder) return "当前视图不能分屏";
  if (isHistoryPreviewSurface()) {
    return "历史预览下不能分屏";
  }
  return null;
}

function discardFailedSplitPage(pageId: string) {
  const pages = usePages.getState();
  const page = pages.getPage(pageId);
  if (isUnsavedLocalPage(page) && !localPageHasPersistableContent(page.content)) {
    pages.discardUnsavedLocalPage(pageId);
  }
}

async function splitInDirection(direction: SplitDirection): Promise<boolean> {
  const blocked = canSplitCurrentView();
  if (blocked) {
    toast.error(blocked);
    return false;
  }
  const tab = activeWorkspaceTab();
  if (!tab || isSpecialTab(tab)) {
    toast.error("当前没有可分屏的笔记");
    return false;
  }

  const split = useEditorSplit.getState();
  split.ensureTab(tab.id, tab.pageId);
  const previousFocused = split.focusedPageId(tab.id);
  const sourcePageId = previousFocused ?? tab.pageId;

  const newPageId = await createSplitBlankPage();
  if (!newPageId) return false;

  // createPage 会把 activePage 切到新页；未分屏时 ensureTab 会跟着改左叶。
  // 分屏前把源叶钉回原页，保证左边不变、右边才是新空页。
  if (!split.isSplit(tab.id)) {
    split.ensureTab(tab.id, sourcePageId);
  }

  const result = split.splitFocused({
    tabId: tab.id,
    direction,
    newPageId,
  });
  if (!result.ok) {
    discardFailedSplitPage(newPageId);
    if (previousFocused) {
      void usePages.getState().setActivePage(previousFocused);
    }
    toast.error(result.error);
    return false;
  }

  void usePages.getState().setActivePage(newPageId);
  return true;
}

export function splitRight(): Promise<boolean> {
  return splitInDirection("right");
}

export function splitDown(): Promise<boolean> {
  return splitInDirection("down");
}

export function closePaneOrTab(): ClosePaneOrTabResult {
  if (isHistoryPreviewSurface()) return "close-tab";
  const tab = activeWorkspaceTab();
  if (!tab || isSpecialTab(tab)) return "close-tab";

  const split = useEditorSplit.getState();
  const state = split.getStateForTab(tab.id);
  if (!state) return "close-tab";

  const closedPageId = split.focusedPageId(tab.id);
  flushEditorContent(true);
  if (closedPageId) {
    const page = usePages.getState().getPage(closedPageId);
    const emptyUnsaved =
      isUnsavedLocalPage(page) &&
      !localPageHasPersistableContent(page.content);
    if (!emptyUnsaved) {
      void usePages.getState().flushPendingLocalSaveByPageId(closedPageId);
    }
  }

  const result = split.closeFocused(tab.id);
  if (result.kind === "last-pane") return "close-tab";

  if (closedPageId) {
    const remaining = split.getStateForTab(tab.id);
    const stillShown =
      remaining &&
      walkLeaves(remaining.root).some((leaf) => leaf.pageId === closedPageId);
    if (!stillShown) discardFailedSplitPage(closedPageId);
  }

  if (result.focusedPageId) {
    void usePages.getState().setActivePage(result.focusedPageId);
  }
  return "closed-pane";
}

export function focusNeighbor(dir: SplitNeighborDirection): string | null {
  if (!isNormalEditorSurface()) return null;
  const tab = activeWorkspaceTab();
  if (!tab) return null;
  const paneId = useEditorSplit.getState().focusNeighbor(tab.id, dir);
  if (!paneId) return null;
  const pageId = useEditorSplit.getState().focusedPageId(tab.id);
  if (pageId) void usePages.getState().setActivePage(pageId);
  return paneId;
}

export function toggleZoom(): void {
  if (!isNormalEditorSurface()) return;
  const tab = activeWorkspaceTab();
  if (!tab) return;
  useEditorSplit.getState().toggleZoom(tab.id);
}

export function closeFocusedSplitPane(): boolean {
  return closePaneOrTab() === "closed-pane";
}

export function splitFocusedRight(): Promise<boolean> {
  return splitRight();
}

export function splitFocusedDown(): Promise<boolean> {
  return splitDown();
}

export function focusSplitNeighbor(
  dir: SplitNeighborDirection,
): string | null {
  return focusNeighbor(dir);
}

export function toggleSplitZoom(): void {
  toggleZoom();
}

/**
 * 当前 tab 已分屏时，把页面放到聚焦格（或聚焦已展示该页的格）。
 * 返回 true 表示已处理，调用方不要再开/切 tab。
 *
 * 均分：store 只有 setGroupSizes，没有 equalize API（分隔条双击才均分当前组），
 * 命令面板 / 热键不暴露「均分」。
 */
export function tryShowPageInFocusedSplit(pageId: string): boolean {
  if (isHistoryPreviewSurface()) return false;

  const page = usePages.getState().getPage(pageId);
  if (!page || page.isFolder || page.trashedAt) return false;

  const split = useEditorSplit.getState();
  const { openTabs, activeTabId } = useTabs.getState();

  // 已在当前窗口某分屏叶：切到该 tab 并 focus 该叶，不要开新 tab / 不要换格。
  for (const tab of openTabs) {
    if (isSpecialTab(tab)) continue;
    if (!split.isSplit(tab.id)) continue;
    const state = split.getStateForTab(tab.id);
    if (!state) continue;
    const existing = walkLeaves(state.root).find(
      (leaf) => leaf.pageId === pageId,
    );
    if (!existing) continue;
    split.focusPane(tab.id, existing.id);
    if (tab.id !== activeTabId) {
      useTabs.getState().setActiveTab(tab.id);
    }
    void usePages.getState().setActivePage(pageId);
    return true;
  }

  const tab = activeWorkspaceTab();
  if (!tab || isSpecialTab(tab)) return false;
  if (!split.isSplit(tab.id)) return false;

  const state = split.getStateForTab(tab.id);
  if (!state) return false;

  const existing = walkLeaves(state.root).find((leaf) => leaf.pageId === pageId);
  if (existing) {
    split.focusPane(tab.id, existing.id);
  } else {
    split.setPanePage(tab.id, state.focusedLeafId, pageId);
  }
  void usePages.getState().setActivePage(pageId);
  return true;
}
