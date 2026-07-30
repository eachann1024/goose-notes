import { getPageTitle } from "@/components/editor/utils/page-title";
import type { Page } from "@/types";

type SearchNotebook = {
  source?: "default" | "local-folder";
};

/** 搜索面板只收录可打开的笔记；local-folder 目录节点仅用于侧栏导航。 */
export function isCommandSearchablePage(
  page: Page,
  notebooks: Record<string, SearchNotebook | undefined>,
): boolean {
  if (page.trashedAt) return false;

  const title = getPageTitle(page);
  if (!title || title === "无标题") return false;

  return !(
    notebooks[page.workspaceId]?.source === "local-folder" && page.isFolder
  );
}
