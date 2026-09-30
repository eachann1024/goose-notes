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
import { findLeaf, walkLeaves } from "@/lib/editor-split/tree";
import type { SplitDirection, SplitNeighborDirection } from "@/lib/editor-split/types";
import type { Page } from "@/types";
import { useEditorSplit } from "@/stores/useEditorSplit";
import { useHistoryView } from "@/stores/useHistoryView";
import { useNotebooks } from "@/stores/useNotebooks";
import { flushEditorContent, usePages } from "@/stores/usePages";
import { isSpecialTab, useTabs } from "@/stores/useTabs";
import { createSplitBlankPage } from "./createBlankPage";

export type ClosePaneOrTabResult = "close-tab" | "closed-pane";

/**
 * 指针点进另一格时，浏览器与编辑器负责把 caret 落在实际点击处；此时只同步
 * 分屏/标签/侧栏状态，不能随后再把 selection 移到正文开头。键盘与命令导航仍
 * 使用默认值，把焦点显式交给目标编辑器。
 */
export interface FocusSplitPaneOptions {
  focusEditor?: boolean;
}

function activeWorkspaceTab() {
  const { activeTabId, openTabs } = useTabs.getState();
  if (!activeTabId) return null;
  return openTabs.find((tab) => tab.id === activeTabId) ?? null;
}

/**
 * 分屏切换由键盘或命令面板发起时，状态已更新但新叶的 Editor 还会在本帧后重挂载。
 * 等一帧再派发，确保只由新的活动编辑器接收，避免焦点留在已切走的格或命令面板里。
 */
function focusActiveSplitEditor() {
  if (typeof window === "undefined") return;
  const dispatch = () => {
    window.dispatchEvent(new CustomEvent("goose-note:focus-editor-body"));
  };
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(dispatch);
  } else {
    queueMicrotask(dispatch);
  }
}

/**
 * 本地文件夹切换会同步置空 activePage 并异步重扫。先登记目标，重扫完成后才不会
 * 把刚替换到分屏叶的目标又清回空白。常规记事本同样通过这一路径更新侧栏。
 */
function syncNotebookForSplitPage(pageId: string) {
  const page = usePages.getState().getPage(pageId);
  if (!page?.workspaceId) return;
  const notebooks = useNotebooks.getState();
  const pages = usePages.getState();
  const notebook = notebooks.notebooks[page.workspaceId];
  const isLocalFolder = notebook?.source === "local-folder";
  const isCurrentNotebook = notebooks.activeNotebookId === page.workspaceId;
  const isLoadingCurrentLocal =
    isCurrentNotebook &&
    isLocalFolder &&
    notebooks.getLocalFolderLoadState(page.workspaceId).status === "loading";

  // 只为跨本地库切换或正在扫描的本地库保留 pending；同本已 ready 的普通
  // 导航必须清掉旧值，否则 watcher/后续扫描会把活动页反向抢回。
  if (!isCurrentNotebook && isLocalFolder) {
    pages.setPendingNavigatePageId(page.id);
  } else if (isLoadingCurrentLocal) {
    pages.setPendingNavigatePageId(page.id);
  } else if (pages.pendingNavigatePageId) {
    pages.setPendingNavigatePageId(null);
  }
  if (isCurrentNotebook) return;

  notebooks.setActiveNotebook(page.workspaceId);
}

function isLiveEditorPage(page: Page | undefined): page is Page {
  return Boolean(page && !page.isFolder && !page.trashedAt);
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

  useTabs.getState().syncTabPageId(tab.id, newPageId);
  void usePages.getState().setActivePage(newPageId);
  return true;
}

export function splitRight(): Promise<boolean> {
  return splitInDirection("right");
}

export function splitDown(): Promise<boolean> {
  return splitInDirection("down");
}

export function closeSplitPaneById(
  tabId: string,
  leafId: string,
): ClosePaneOrTabResult {
  const tabs = useTabs.getState();
  const tab = tabs.openTabs.find((item) => item.id === tabId);
  if (!tab || isSpecialTab(tab)) return "close-tab";

  const split = useEditorSplit.getState();
  const state = split.getStateForTab(tabId);
  if (!state) return "close-tab";

  const closedPageId = findLeaf(state.root, leafId)?.pageId ?? null;
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

  const result = split.closePane(tabId, leafId);
  if (result.kind === "last-pane") return "close-tab";

  if (closedPageId) {
    const remaining = split.getStateForTab(tabId);
    const stillShown =
      remaining &&
      walkLeaves(remaining.root).some((leaf) => leaf.pageId === closedPageId);
    if (!stillShown) discardFailedSplitPage(closedPageId);
  }

  if (result.focusedPageId) {
    const nextPage = usePages.getState().getPage(result.focusedPageId);
    if (isLiveEditorPage(nextPage)) {
      tabs.syncTabPageId(tabId, result.focusedPageId);
      void usePages.getState().setActivePage(result.focusedPageId);
    }
  }
  return "closed-pane";
}

export function closePaneOrTab(): ClosePaneOrTabResult {
  if (isHistoryPreviewSurface()) return "close-tab";
  const tab = activeWorkspaceTab();
  if (!tab || isSpecialTab(tab)) return "close-tab";

  const split = useEditorSplit.getState();
  const state = split.getStateForTab(tab.id);
  if (!state) return "close-tab";
  return closeSplitPaneById(tab.id, state.focusedLeafId);
}

export function focusNeighbor(dir: SplitNeighborDirection): string | null {
  if (!isNormalEditorSurface()) return null;
  const tab = activeWorkspaceTab();
  if (!tab) return null;
  const paneId = useEditorSplit.getState().focusNeighbor(tab.id, dir);
  if (!paneId) return null;
  focusSplitPane(tab.id, paneId);
  return paneId;
}

function focusSplitByVisualOrder(step: -1 | 1): string | null {
  if (!isNormalEditorSurface()) return null;
  const tab = activeWorkspaceTab();
  if (!tab) return null;

  const split = useEditorSplit.getState();
  const state = split.getStateForTab(tab.id);
  if (!state || !split.isSplit(tab.id)) return null;
  const leaves = walkLeaves(state.root);
  if (leaves.length < 2) return null;
  const currentIndex = leaves.findIndex(
    (leaf) => leaf.id === state.focusedLeafId,
  );
  if (currentIndex < 0) return null;
  const nextIndex = (currentIndex + step + leaves.length) % leaves.length;
  const next = leaves[nextIndex];
  return next ? focusSplitPane(tab.id, next.id) : null;
}

/** 按视觉顺序循环到前一个分屏格。 */
export function focusPreviousSplitPane(): string | null {
  return focusSplitByVisualOrder(-1);
}

/** 按视觉顺序循环到下一个分屏格。 */
export function focusNextSplitPane(): string | null {
  return focusSplitByVisualOrder(1);
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

/** 分屏格标题栏 / 空态关闭：最后一格则关标签。 */
export function closeSplitPaneFromUi(tabId: string, leafId: string): void {
  if (closeSplitPaneById(tabId, leafId) === "close-tab") {
    useTabs.getState().closeTab(tabId);
  }
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
 * 将分屏焦点、活动页和当前标签标题一起切到同一篇笔记。
 *
 * 分屏焦点本身会触发 React 的后续 effect；若只写 split store，标签标题和
 * 侧栏高亮会短暂仍指向旧页。这里把三份状态在同一轮同步，编辑器仍由
 * SplitEditorPane 的 page key 安静地重新初始化，不额外创建标签或显示加载状态。
 */
export function focusSplitPane(
  tabId: string,
  paneId: string,
  options: FocusSplitPaneOptions = {},
): string | null {
  const split = useEditorSplit.getState();
  const state = split.getStateForTab(tabId);
  const leaf = state
    ? walkLeaves(state.root).find((item) => item.id === paneId)
    : undefined;
  if (!leaf) return null;

  split.focusPane(tabId, paneId);

  const tabs = useTabs.getState();
  const tab = tabs.openTabs.find((item) => item.id === tabId);
  if (!tab || isSpecialTab(tab)) return leaf.pageId || null;

  const page = usePages.getState().getPage(leaf.pageId);
  // 笔记已不在 store 时仍允许聚焦该格，才能关掉它；不能把活动页切到失踪 id，
  // 否则 WorkspaceLayout 会卸掉整列分屏。
  if (!isLiveEditorPage(page)) return leaf.pageId;

  // 先更新 tab 的 pageId，再激活 tab；setActiveTab 会据此同步笔记本与历史。
  tabs.syncTabPageId(tabId, page.id);
  if (tabs.activeTabId !== tabId) {
    useTabs.getState().setActiveTab(tabId);
  }
  syncNotebookForSplitPage(page.id);
  usePages.getState().setActivePage(page.id);
  if (options.focusEditor !== false) {
    focusActiveSplitEditor();
  }
  return page.id;
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
  if (!isLiveEditorPage(page)) return false;

  const split = useEditorSplit.getState();
  const tab = activeWorkspaceTab();
  if (!tab || isSpecialTab(tab)) return false;
  if (!split.isSplit(tab.id)) return false;

  const state = split.getStateForTab(tab.id);
  if (!state) return false;

  // 只替换“发起时当前 tab 的聚焦叶”。不能因目标已在另一标签页出现就切走，
  // 否则 Cmd+K 看起来会随机新增/跳转顶层标签，也会失去用户刚刚选中的分栏。
  flushEditorContent(true);
  split.setPanePage(tab.id, state.focusedLeafId, pageId);
  return focusSplitPane(tab.id, state.focusedLeafId) !== null;
}
