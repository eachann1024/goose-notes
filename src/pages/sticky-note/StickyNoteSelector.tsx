import { useState, useEffect, useRef, useCallback } from "react";
import { Command } from "cmdk";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

interface StickyNoteSelectorProps {
  onSelect: (pageId: string) => void;
}

export function StickyNoteSelector({ onSelect }: StickyNoteSelectorProps) {
  const { pages } = usePages();
  const { notebooks, activeNotebookId } = useNotebooks();
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasTrackedSearchRef = useRef(false);

  // 聚焦输入框
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 过滤页面：优先当前记事本，排除回收站和文件夹
  const allPages = Object.values(pages)
    .filter((page) => !page.trashedAt && !page.isFolder)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const filteredPages = searchQuery.trim()
    ? allPages.filter((page) => {
        const title = getPageTitle(page).toLowerCase();
        const query = searchQuery.toLowerCase();
        return title.includes(query);
      })
    : allPages;

  // 当前记事本的排前面
  const sortedPages = [...filteredPages].sort((a, b) => {
    const aInActive = a.workspaceId === activeNotebookId ? 1 : 0;
    const bInActive = b.workspaceId === activeNotebookId ? 1 : 0;
    if (aInActive !== bInActive) return bInActive - aInActive;
    return b.updatedAt - a.updatedAt;
  });

  const recentPages = sortedPages.slice(0, 8);

  // 追踪搜索提交（用户输入后停留 800ms 视为一次搜索）
  useEffect(() => {
    if (!searchQuery.trim()) {
      hasTrackedSearchRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (hasTrackedSearchRef.current) return;
      hasTrackedSearchRef.current = true;
      trackEvent("sticky_note_search_submitted", {
        feature: "sticky_note",
        action: "search_submitted",
        query_length: searchQuery.trim().length,
        result_count: recentPages.length,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery, recentPages.length]);

  const handleSelect = useCallback(
    (pageId: string) => {
      trackEvent("sticky_note_page_selected", {
        feature: "sticky_note",
        action: "select_page",
        page_id: pageId,
        has_search: Boolean(searchQuery.trim()),
        search_query_length: searchQuery.trim().length,
      });
      onSelect(pageId);
    },
    [onSelect, searchQuery],
  );

  return (
    <div className="flex flex-col h-full">
      {/* 搜索输入 */}
      <div className="px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
          <LucideIcons.Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索笔记..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <LucideIcons.X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 笔记列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {recentPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <LucideIcons.FileText className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">{searchQuery.trim() ? "未找到匹配的笔记" : "暂无笔记"}</p>
            <p className="text-xs mt-1 opacity-60">
              {searchQuery.trim() ? "尝试其他关键词" : "先创建一个笔记吧"}
            </p>
          </div>
        ) : (
          <div className="px-2 space-y-0.5">
            {recentPages.map((page) => {
              const notebook = notebooks[page.workspaceId];
              return (
                <button
                  key={page.id}
                  onClick={() => handleSelect(page.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left",
                    "transition-colors hover:bg-[var(--goose-interactive-hover)]",
                    "active:bg-[var(--goose-interactive-selected)]",
                  )}
                >
                  <div className="shrink-0 w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <span className="text-sm">{page.icon || "📝"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getPageTitle(page) || "无标题"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {notebook?.name || "未知记事本"} ·{" "}
                      {new Date(page.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <LucideIcons.ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 border-t border-border/30 text-center">
        <p className="text-xs text-muted-foreground">
          选择一个笔记以便签模式打开
        </p>
      </div>
    </div>
  );
}
