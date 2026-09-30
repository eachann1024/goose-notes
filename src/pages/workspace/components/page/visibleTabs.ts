import {
  isUnsavedLocalPage,
  localPageHasPersistableContent,
} from "@/lib/unsavedLocalPage";
import type { Page } from "@/types";
import type { TabItem } from "@/stores/useTabs";

export function isWorkspaceTabVisible(
  tab: TabItem,
  getPage: (id: string) => Page | undefined,
  _activeNotebookId: string | null | undefined,
): boolean {
  if (tab.type === "notebook-ai") return false;
  if (tab.type === "welcome") return true;
  const tabPage = getPage(tab.pageId);
  return !tabPage || !tabPage.trashedAt;
}

export function listVisibleWorkspaceTabs(
  openTabs: TabItem[],
  getPage: (id: string) => Page | undefined,
  activeNotebookId: string | null | undefined,
): TabItem[] {
  return openTabs.filter((tab) =>
    isWorkspaceTabVisible(tab, getPage, activeNotebookId),
  );
}

/**
 * 仅用于判断窗口内是否只剩一个真实可见标签（例如关闭快捷键）。
 * 不得用它复用或替换已有笔记标签。
 */
export function findLoneVisibleWorkspaceTab(
  openTabs: TabItem[],
  getPage: (id: string) => Page | undefined,
  notebookId: string | null | undefined,
): TabItem | null {
  const visible = listVisibleWorkspaceTabs(openTabs, getPage, notebookId);
  return visible.length === 1 ? visible[0] : null;
}

/** 加号新建的欢迎页或空白未落盘页，打开其他文档时应填入该标签。 */
export function isReusableEmptyWorkspaceTab(
  tab: TabItem | null | undefined,
  getPage: (id: string) => Page | undefined,
): boolean {
  if (!tab || tab.pinned) return false;
  if (tab.type === "notebook-ai") return false;
  if (tab.type === "welcome") return true;
  const page = getPage(tab.pageId);
  return Boolean(
    page &&
      isUnsavedLocalPage(page) &&
      !localPageHasPersistableContent(page.content),
  );
}

/** 只有一个文档标签时，普通页面标题可直接在标签 pill 上修改。 */
export function shouldEditTitleInTabPill(visibleTabs: TabItem[]): boolean {
  return visibleTabs.length === 1 && visibleTabs[0]?.type !== "welcome";
}

export function shouldEditTitleInTab(
  page: Pick<Page, "localFilePath" | "localUnsaved"> | null | undefined,
  editTitleInTabPill: boolean,
): boolean {
  return Boolean(page?.localFilePath || page?.localUnsaved) || editTitleInTabPill;
}
