import type { Page } from "@/types";
import type { TabItem } from "@/stores/useTabs";

export function isWorkspaceTabVisible(
  tab: TabItem,
  getPage: (id: string) => Page | undefined,
  activeNotebookId: string | null | undefined,
): boolean {
  if (tab.type === "notebook-ai") return false;
  if (tab.type === "welcome") return true;
  const tabPage = getPage(tab.pageId);
  return Boolean(
    tabPage &&
      !tabPage.trashedAt &&
      (!activeNotebookId || tabPage.workspaceId === activeNotebookId),
  );
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
 * 当前笔记本只剩一个可见标签时，列表单击应切换该标签，而不是再开一个。
 * 手动唤出第二个标签之后，才走预览/新标签逻辑。
 */
export function findLoneVisibleWorkspaceTab(
  openTabs: TabItem[],
  getPage: (id: string) => Page | undefined,
  notebookId: string | null | undefined,
): TabItem | null {
  const visible = listVisibleWorkspaceTabs(openTabs, getPage, notebookId);
  return visible.length === 1 ? visible[0] : null;
}

/** 只有一个文档标签时，在标签 pill 上改名，正文不再重复文件名大标题。 */
export function shouldEditTitleInTabPill(visibleTabs: TabItem[]): boolean {
  return visibleTabs.length === 1 && visibleTabs[0]?.type !== "welcome";
}
