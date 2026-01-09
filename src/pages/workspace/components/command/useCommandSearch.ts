import type { Page } from "@/types";
import { getPageTitle } from "@/lib/page-title";

interface CommandSearchState {
  pages: Record<string, Page>;
  activeNotebookId: string | null;
  searchAllNotebooks: boolean;
  searchQuery: string;
  removedRecentIds: string[];
}

export function useCommandSearch({
  pages,
  activeNotebookId,
  searchAllNotebooks,
  searchQuery,
  removedRecentIds,
}: CommandSearchState) {
  const filteredPages = useMemo(() => {
    const allPagesArray = Object.values(pages).filter((p) => {
      if (p.trashedAt) return false;
      const title = getPageTitle(p);
      return title && title !== "无标题";
    });
    if (searchAllNotebooks) {
      return allPagesArray;
    }
    const currentNotebookId = activeNotebookId || DEFAULT_NOTEBOOK;
    return allPagesArray.filter((p) => p.workspaceId === currentNotebookId);
  }, [pages, searchAllNotebooks, activeNotebookId]);

  const getPageBreadcrumb = useCallback(
    (page: Page): string[] => {
      const breadcrumb: string[] = [];
      let currentPage = page;

      while (currentPage) {
      const title = getPageTitle(currentPage);
        if (title && title !== "无标题") {
          breadcrumb.unshift(title);
        }
        if (!currentPage.parentId) {
          break;
        }
        currentPage = pages[currentPage.parentId];
      }

      const notebookId = page.workspaceId || "default";
      const notebook = useNotebooks.getState().notebooks[notebookId];
      if (notebook) {
        breadcrumb.unshift(notebook.name);
      }

      return breadcrumb;
    },
    [pages],
  );

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      const recent = filteredPages
        .filter((p) => !removedRecentIds.includes(p.id))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5);

      const all = filteredPages.sort((a, b) => {
        const titleA = getPageTitle(a);
        const titleB = getPageTitle(b);
        return titleA.localeCompare(titleB, "zh-CN");
      });

      return { recent, all, hasQuery: false };
    }

    const matched = filteredPages.filter((page) => {
      const title = getPageTitle(page);
      const titleMatch = title.toLowerCase().includes(query);
      const contentText = extractTextFromContent(page.content);
      const contentMatch = contentText.toLowerCase().includes(query);
      return titleMatch || contentMatch;
    });

    const recent = matched
      .filter((p) => !removedRecentIds.includes(p.id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5);

    const all = matched.sort((a, b) => {
      const titleA = getPageTitle(a);
      const titleB = getPageTitle(b);
      return titleA.localeCompare(titleB, "zh-CN");
    });

    return { recent, all, hasQuery: true };
  }, [filteredPages, searchQuery, removedRecentIds]);

  return { filteredPages, searchResults, getPageBreadcrumb };
}
