import { useCallback, useMemo, useState } from "react";
import type { Page } from "@/types";
import { getPageTitle } from "@/lib/page-title";
import { extractTextFromContent } from "@/lib/content-text-extractor";
import { DEFAULT_NOTEBOOK, useNotebooks } from "@/stores/useNotebooks";

export interface SearchResultPage extends Page {
  contentSnippet?: string;
  snippetMatchIndex?: number;
}

export interface SearchResults {
  recent: SearchResultPage[];
  all: SearchResultPage[];
  hasQuery: boolean;
}

/**
 * 从内容中提取包含搜索关键词的上下文片段
 * @param contentText 完整的内容文本
 * @param query 搜索关键词
 * @param contextLength 关键词前后显示的字符数
 * @returns 包含关键词的上下文片段，或 undefined
 */
function getContentSnippet(
  contentText: string,
  query: string,
  contextLength: number = 30
): { snippet: string; matchIndex: number } | undefined {
  if (!query || !contentText) return undefined;

  const lowerContent = contentText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);

  if (matchIndex === -1) return undefined;

  // 计算片段的起始和结束位置
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(contentText.length, matchIndex + query.length + contextLength);

  let snippet = contentText.slice(start, end);

  // 如果不是从头开始，添加省略号
  if (start > 0) {
    snippet = "..." + snippet;
  }

  // 如果不是到结尾，添加省略号
  if (end < contentText.length) {
    snippet = snippet + "...";
  }

  return { snippet, matchIndex: start > 0 ? matchIndex - start + 3 : matchIndex };
}

interface CommandSearchState {
  pages: Record<string, Page>;
  activeNotebookId: string | null;
  searchAllNotebooks: boolean;
}

export function useCommandSearch({
  pages,
  activeNotebookId,
  searchAllNotebooks,
}: CommandSearchState) {
  const [searchQuery, setSearchQuery] = useState("");
  const [removedRecentIds, setRemovedRecentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("goose-recent-excludes");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const removeRecent = useCallback((id: string) => {
    const newIds = [...removedRecentIds, id];
    setRemovedRecentIds(newIds);
    localStorage.setItem("goose-recent-excludes", JSON.stringify(newIds));
  }, [removedRecentIds]);

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

  const searchResults: SearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      const recent = filteredPages
        .filter((p) => !removedRecentIds.includes(p.id))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5) as SearchResultPage[];

      const all = filteredPages.sort((a, b) => {
        const titleA = getPageTitle(a);
        const titleB = getPageTitle(b);
        return titleA.localeCompare(titleB, "zh-CN");
      }) as SearchResultPage[];

      return { recent, all, hasQuery: false };
    }

    const matched: SearchResultPage[] = [];

    const notebooks = useNotebooks.getState().notebooks;

    // #tag 过滤模式：query 以 # 开头 → 仅显示打了对应标签的页面
    // 「#」单独 → 所有有标签的页面；「#work」→ tag 以 work 开头或包含
    if (query.startsWith("#")) {
      const tagQuery = query.slice(1).trim();
      const tagMatched: SearchResultPage[] = [];
      for (const page of filteredPages) {
        if (notebooks[page.workspaceId]?.source === "local-folder" && page.isFolder) continue;
        const tags = Array.isArray(page.tags) ? page.tags : [];
        if (!tags.length) continue;
        if (!tagQuery) {
          tagMatched.push({ ...page });
          continue;
        }
        const hit = tags.some((t) => {
          const lower = t.toLowerCase();
          return lower.startsWith(tagQuery) || lower.includes("/" + tagQuery) || lower === tagQuery;
        });
        if (hit) tagMatched.push({ ...page });
      }
      const recentTag = tagMatched
        .filter((p) => !removedRecentIds.includes(p.id))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5);
      const allTag = [...tagMatched].sort((a, b) => {
        const titleA = getPageTitle(a);
        const titleB = getPageTitle(b);
        return titleA.localeCompare(titleB, "zh-CN");
      });
      return { recent: recentTag, all: allTag, hasQuery: true };
    }

    for (const page of filteredPages) {
      // 如果是本地文件夹，排除文件夹本身（isFolder=true），只搜索文件
      if (notebooks[page.workspaceId]?.source === "local-folder" && page.isFolder) {
        continue;
      }

      const title = getPageTitle(page);
      const titleMatch = title.toLowerCase().includes(query);
      const contentText = extractTextFromContent(page.content);
      const contentMatch = contentText.toLowerCase().includes(query);
      
      if (titleMatch || contentMatch) {
        const resultPage: SearchResultPage = { ...page };
        
        // 如果是内容匹配，提取上下文片段
        if (contentMatch) {
          const snippetResult = getContentSnippet(contentText, query);
          if (snippetResult) {
            resultPage.contentSnippet = snippetResult.snippet;
            resultPage.snippetMatchIndex = snippetResult.matchIndex;
          }
        }
        
        matched.push(resultPage);
      }
    }

    const recent = matched
      .filter((p) => !removedRecentIds.includes(p.id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5);

    const all = [...matched].sort((a, b) => {
      const titleA = getPageTitle(a);
      const titleB = getPageTitle(b);
      return titleA.localeCompare(titleB, "zh-CN");
    });

    return { recent, all, hasQuery: true };
  }, [filteredPages, searchQuery, removedRecentIds]);

  return {
    filteredPages,
    searchResults,
    getPageBreadcrumb,
    searchQuery,
    setSearchQuery,
    removeRecent,
  };
}
