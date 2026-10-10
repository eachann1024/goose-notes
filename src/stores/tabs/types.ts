export const WELCOME_TAB_PAGE_ID = "welcome";

export const NOTEBOOK_AI_TAB_PAGE_ID_PREFIX = "notebook-ai:";

export type TabType = "welcome" | "notebook-ai";

export interface TabItem {
  id: string;
  pageId: string;
  type?: TabType;
  pinned?: boolean;
  /** 预览/临时标签：侧栏单击打开，可被下一个预览替换；编辑后晋升永久 */
  preview?: boolean;
  workspaceId?: string;
  lastAccessedAt?: number;
}

export function getNotebookAiTabPageId(notebookId: string): string {
  return `${NOTEBOOK_AI_TAB_PAGE_ID_PREFIX}${notebookId}`;
}

export function isNotebookAiTab(
  tab: Pick<TabItem, "type"> | null | undefined,
): boolean {
  return tab?.type === "notebook-ai";
}

export function isSpecialTab(
  tab: Pick<TabItem, "type"> | null | undefined,
): boolean {
  return tab?.type === "welcome" || tab?.type === "notebook-ai";
}

export interface TabsState {
  openTabs: TabItem[];
  activeTabId: string | null;
  tabHistory: string[];
  tabHistoryIndex: number;
  isHistoryNavigating: boolean;
  recentlyClosedPageIds: string[];
  syncNotebookForPage: (pageId: string | null) => void;
  syncActiveTabForPage: (pageId: string | null) => void;
  openTab: (pageId: string) => void;
  openWelcomeTab: () => void;
  openNewTab: () => void;
  openNotebookAiTab: (notebookId: string) => void;
  closeNotebookAiTab: (notebookId: string) => void;
  findNotebookAiTab: (notebookId: string) => TabItem | undefined;
  openPreviewTab: (pageId: string) => void;
  openPermanentTab: (
    pageId: string,
    options?: { pin?: boolean; reuseEmpty?: boolean },
  ) => void;
  promotePreviewTab: (tabId?: string) => void;
  openInCurrentTab: (pageId: string) => void;
  /** 分屏聚焦叶变化时只改 pageId，不拆 split、不开新 Tab。 */
  syncTabPageId: (tabId: string, pageId: string) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToLeft: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  togglePinTab: (tabId: string) => void;
  goBackTabHistory: () => void;
  goForwardTabHistory: () => void;
  canGoBackTabHistory: () => boolean;
  canGoForwardTabHistory: () => boolean;
  reorderTabs: (from: number, to: number) => void;
  adoptTab: (tab: TabItem, insertIndex?: number) => void;
  releaseTab: (tabId: string) => { emptied: boolean };
  removeDeletedPage: (pageId: string) => void;
  reopenLastClosedTab: () => void;
  reconcileTabs: () => void;
  closeExpiredTabs: (now?: number) => void;
  clearAllTabs: () => void;
  collapseToActiveTab: () => void;
}

export type TabSet = import("zustand").StoreApi<TabsState>["setState"];
export type TabGet = import("zustand").StoreApi<TabsState>["getState"];
