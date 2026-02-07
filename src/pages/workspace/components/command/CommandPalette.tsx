import { useId, useRef, useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import type { Page } from "@/types";
import { useCommandSearch, type SearchResultPage } from "./useCommandSearch";
import { getPageTitle } from "@/lib/page-title";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";

const UTOOLS_INPUT_EVENT = "goose-note:utools-search";
const UTOOLS_SYNC_EVENT = "goose-note:utools-search-sync";

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="rounded-[4px] bg-[hsl(var(--goose-selected-bg))] px-0.5 text-foreground"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function CommandPalette() {
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const {
    pages,
    setActivePage,
    setPendingNavigatePageId,
    setExpandPageId,
    setSearchHighlightQuery,
    setSearchHighlightPageId,
    setSearchHighlightNonce,
  } = usePages();
  const { activeNotebookId, setActiveNotebook } = useNotebooks();
  const { searchAllNotebooks, setSearchAllNotebooks } = useSettings();
  const [removedRecentIds, setRemovedRecentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("goose-recent-excludes");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const { searchResults, getPageBreadcrumb } = useCommandSearch({
    pages,
    activeNotebookId,
    searchAllNotebooks,
    searchQuery,
    removedRecentIds,
  });

  const handleRemoveRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newIds = [...removedRecentIds, id];
    setRemovedRecentIds(newIds);
    localStorage.setItem("goose-recent-excludes", JSON.stringify(newIds));
  };

  useEffect(() => {
    const handleUToolsInput = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string }>).detail;
      const text = detail?.text ?? "";
      setSearchQuery(text);
      setOpen(true);
    };

    window.addEventListener(UTOOLS_INPUT_EVENT, handleUToolsInput);
    return () => {
      window.removeEventListener(UTOOLS_INPUT_EVENT, handleUToolsInput);
    };
  }, []);

  useEffect(() => {
    // 只有在 uTools 环境下才同步搜索词
    if (typeof window !== "undefined" && (window as any).utools) {
      if (document.activeElement === inputRef.current) return;
      window.dispatchEvent(
        new CustomEvent(UTOOLS_SYNC_EVENT, { detail: { text: searchQuery } }),
      );
    }
  }, [searchQuery]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          setOpen(true);
        } else {
          setOpen((open) => !open);
        }
      }
      if (open && e.key === "Tab") {
        e.preventDefault();
        setSearchAllNotebooks(!searchAllNotebooks);
      }
    };

    document.addEventListener("keydown", down);
    const handleOpenSearch = () => setOpen(true);
    window.addEventListener("goose-note:open-search", handleOpenSearch);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("goose-note:open-search", handleOpenSearch);
    };
  }, [open, searchAllNotebooks, setSearchAllNotebooks]);

  const runCommand = async (command: () => void) => {
    command();
    await new Promise((resolve) => setTimeout(resolve, 0));
    setOpen(false);
  };

  const currentNotebookName = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]?.name || "当前记事本"
    : "当前记事本";

  // 手动聚焦输入框，绕过 cmdk 的焦点管理
  const focusInput = useCallback(() => {
    // 使用 requestAnimationFrame 确保在 Dialog 渲染后再聚焦
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    });
  }, []);

  useEffect(() => {
    if (open) {
      focusInput();
    }
  }, [open, focusInput]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, searchQuery]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Search"
      filter={() => 1}
      className="workspace-shell fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[640px] rounded-[18px] border-0 p-0 overflow-hidden z-[51] text-popover-foreground outline-none ring-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 backdrop-blur-[1px] bg-[hsl(var(--goose-shell-bg))] shadow-none"
      aria-describedby={descriptionId}
    >
      <DialogTitle className="sr-only">搜索</DialogTitle>
      <DialogDescription id={descriptionId} className="sr-only">
        搜索和快速访问页面
      </DialogDescription>
      <div className="flex items-center px-4 shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.08)]" cmdk-input-wrapper="">
        <LucideIcons.Search className="mr-2 h-5 w-5 shrink-0 opacity-50" />
        <Command.Input
          ref={inputRef}
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder={
            searchAllNotebooks
              ? "搜索所有记事本..."
              : `搜索 "${currentNotebookName}"...`
          }
          className="flex h-12 w-full rounded-md bg-transparent py-3 text-lg outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div
          className="flex items-center gap-2 ml-3 shrink-0"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Switch
            id="search-all"
            checked={searchAllNotebooks}
            onCheckedChange={setSearchAllNotebooks}
            className="scale-75"
          />
          <Label
            htmlFor="search-all"
            className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
          >
            {searchAllNotebooks ? "所有记事本" : "当前记事本"}
          </Label>
        </div>
        <div className="w-px h-4 bg-border mx-2" />
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-[10px] border border-transparent bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--input)/0.7)]">
          <span className="text-xs">Tab</span>
        </kbd>
      </div>

      <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden bg-[hsl(var(--goose-editor-bg))] px-2 py-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-foreground/90">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
          {searchQuery.trim() ? "未找到匹配的页面" : "输入关键词开始搜索"}
        </Command.Empty>

        {!searchQuery.trim() && searchResults.recent.length > 0 && (
          <Command.Group heading="最近访问">
            {searchResults.recent.map((page: Page) => {
              const breadcrumb = getPageBreadcrumb(page);
              return (
                <Command.Item
                  key={`recent-${page.id}`}
                  value={`recent-${page.id}-${getPageTitle(page)}`}
                  onSelect={() => {
                    const targetNotebookId = page.workspaceId;
                    if (
                      targetNotebookId &&
                      targetNotebookId !== activeNotebookId
                    ) {
                      // 跨笔记本：先暂存目标页面，再切换笔记本
                      setPendingNavigatePageId(page.id);
                      setActiveNotebook(targetNotebookId);
                      setOpen(false);
                    } else {
                      // 同笔记本：直接激活并触发展开
                      runCommand(() => {
                        setActivePage(page.id);
                        setExpandPageId(page.id);
                      });
                    }
                  }}
                  className="group relative flex cursor-pointer select-none items-center rounded-[8px] px-2 py-1.5 text-sm text-foreground/92 outline-none transition-colors hover:bg-[var(--goose-interactive-hover)] aria-selected:bg-[var(--goose-interactive-selected)] aria-selected:shadow-[inset_0_0_0_1px_var(--goose-interactive-selected-border)] aria-selected:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                >
                  <div className="mr-2 h-4 w-4 shrink-0 flex items-center justify-center relative group/icon">
                    <LucideIcons.Clock className="h-4 w-4 text-muted-foreground/70 transition-opacity duration-200 group-hover/icon:opacity-0" />
                    <div
                      role="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveRecent(e, page.id);
                      }}
                      className="absolute inset-0 h-4 w-4 cursor-pointer rounded flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover/icon:opacity-100 hover:bg-[var(--goose-interactive-selected)]"
                    >
                      <LucideIcons.X className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                  <span className="truncate flex-1">
                    <HighlightText
                      text={getPageTitle(page)}
                      query={searchQuery}
                    />
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground/50">
                    {breadcrumb.length > 0
                      ? breadcrumb.join(" > ")
                      : new Date(page.updatedAt).toLocaleDateString()}
                  </span>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}

        {searchResults.all.length > 0 && (
          <Command.Group
            heading={searchResults.hasQuery ? "搜索结果" : "所有页面"}
          >
            {searchResults.all.map((page: SearchResultPage) => {
              const breadcrumb = getPageBreadcrumb(page);
              return (
                <Command.Item
                  key={`all-${page.id}`}
                  value={`all-${page.id}-${getPageTitle(page)}`}
                  onSelect={() => {
                    const targetNotebookId = page.workspaceId;
                    // 有搜索词时设置高亮
                    const highlightQuery = searchQuery.trim() || null;
                    if (
                      targetNotebookId &&
                      targetNotebookId !== activeNotebookId
                    ) {
                      // 跨笔记本：先暂存目标页面，再切换笔记本
                      setPendingNavigatePageId(page.id);
                      setSearchHighlightQuery(highlightQuery);
                      if (highlightQuery) {
                        setSearchHighlightPageId(page.id);
                        setSearchHighlightNonce(Date.now());
                      }
                      setActiveNotebook(targetNotebookId);
                      setOpen(false);
                    } else {
                      // 同笔记本：直接激活并触发展开
                      runCommand(() => {
                        setActivePage(page.id);
                        setExpandPageId(page.id);
                        setSearchHighlightQuery(highlightQuery);
                        if (highlightQuery) {
                          setSearchHighlightPageId(page.id);
                          setSearchHighlightNonce(Date.now());
                        }
                      });
                    }
                  }}
                  className="relative flex cursor-pointer select-none items-start rounded-[8px] px-2 py-1.5 text-sm text-foreground/92 outline-none transition-colors hover:bg-[var(--goose-interactive-hover)] aria-selected:bg-[var(--goose-interactive-selected)] aria-selected:shadow-[inset_0_0_0_1px_var(--goose-interactive-selected-border)] aria-selected:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                >
                  <LucideIcons.FileText className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        <HighlightText
                          text={getPageTitle(page)}
                          query={searchQuery}
                        />
                      </span>
                      <span className="text-xs text-muted-foreground/50 truncate shrink-0">
                        {breadcrumb.length > 0 ? breadcrumb.join(" / ") : ""}
                      </span>
                    </div>
                    {searchResults.hasQuery && page.contentSnippet && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        <HighlightText
                          text={page.contentSnippet}
                          query={searchQuery}
                        />
                      </div>
                    )}
                  </div>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
