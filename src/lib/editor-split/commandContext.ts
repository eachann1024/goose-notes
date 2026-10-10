import { isNotebookAiFullscreenOpen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import type { Page } from "@/types";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useHistoryView } from "@/stores/useHistoryView";
import { isSpecialTab, useTabs } from "@/stores/useTabs";

/**
 * 指针点进另一格时，浏览器与编辑器负责把 caret 落在实际点击处；此时只同步
 * 分屏/标签/侧栏状态，不能随后再把 selection 移到正文开头。键盘与命令导航仍
 * 使用默认值，把焦点显式交给目标编辑器。
 */
export interface FocusSplitPaneOptions {
  focusEditor?: boolean;
}

export function activeWorkspaceTab() {
  const { activeTabId, openTabs } = useTabs.getState();
  if (!activeTabId) return null;
  return openTabs.find((tab) => tab.id === activeTabId) ?? null;
}

/**
 * 分屏切换由键盘或命令面板发起时，状态已更新但新叶的 Editor 还会在本帧后重挂载。
 * 等一帧再派发，确保只由新的活动编辑器接收，避免焦点留在已切走的格或命令面板里。
 */
export function focusActiveSplitEditor() {
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
export function syncNotebookForSplitPage(pageId: string) {
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

export function isLiveEditorPage(page: Page | undefined): page is Page {
  return Boolean(page && !page.isFolder && !page.trashedAt);
}

export function isHistoryPreviewSurface(): boolean {
  const historyPageId = useHistoryView.getState().active;
  if (!historyPageId) return false;
  return historyPageId === usePages.getState().activePageId;
}

export function isNormalEditorSurface(): boolean {
  if (isNotebookAiFullscreenOpen()) return false;
  if (isHistoryPreviewSurface()) return false;
  const tab = activeWorkspaceTab();
  if (!tab || isSpecialTab(tab)) return false;
  const page = usePages.getState().getPage(tab.pageId);
  if (page?.isFolder) return false;
  return true;
}

export function canSplitCurrentView(): string | null {
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
