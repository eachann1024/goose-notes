import { useId, useRef, useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import * as LucideIcons from "lucide-react";
import type { Page } from "@/types";
import { trackEvent } from "@/lib/analytics";
import { UToolsAdapter } from "@/lib/utools";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCommandSearch, type SearchResultPage } from "./useCommandSearch";
import { PaletteResultGroup } from "./PaletteResultGroup";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { useTabs } from "@/stores/useTabs";
import { Kbd } from "@/components/ui/kbd";
import { matchShortcut } from "@/lib/shortcut-match";
import { toast } from "sonner";

const UTOOLS_INPUT_EVENT = "goose-note:utools-search";
const UTOOLS_SYNC_EVENT = "goose-note:utools-search-sync";

export function CommandPalette() {
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const openInNewTabRef = useRef(false);
  const [open, setOpen] = useState(false);
  const { openTab, openInCurrentTab } = useTabs();
  const {
    pages,
    setExpandPageId,
    setSearchHighlightQuery,
    setSearchHighlightPageId,
    setSearchHighlightNonce,
  } = usePages();
  const { activeNotebookId, setActiveNotebook } = useNotebooks();
  const {
    searchAllNotebooks,
    setSearchAllNotebooks,
    showRecentInSearch,
    setShowRecentInSearch,
    searchPanelCloseShortcut,
  } = useSettings();
  const {
    searchResults,
    getPageBreadcrumb,
    searchQuery,
    setSearchQuery,
    removeRecent,
  } = useCommandSearch({
    pages,
    activeNotebookId,
    searchAllNotebooks,
  });
  const trackSearchOpened = useCallback((openSource: "utools_input" | "shortcut" | "programmatic") => {
    trackEvent("search_opened", {
      feature: "search",
      action: "open",
      source: openSource,
      open_source: openSource,
      search_scope: searchAllNotebooks ? "all_notebooks" : "current_notebook",
      search_all_notebooks: searchAllNotebooks,
      open_in_new_tab: openInNewTabRef.current,
    });
  }, [searchAllNotebooks]);
  const lastTrackedQueryRef = useRef("");

  const handleHideRecent = useCallback(() => {
    setShowRecentInSearch(false);
    toast("已关闭「最近访问」，可在设置中重新开启", { duration: 3000 });
  }, [setShowRecentInSearch]);

  useEffect(() => {
    const handleUToolsInput = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string }>).detail;
      const text = detail?.text ?? "";
      openInNewTabRef.current = false;
      setSearchQuery(text);
      trackSearchOpened("utools_input");
      setOpen(true);
    };

    window.addEventListener(UTOOLS_INPUT_EVENT, handleUToolsInput);
    return () => {
      window.removeEventListener(UTOOLS_INPUT_EVENT, handleUToolsInput);
    };
  }, []);

  useEffect(() => {
    // 只有在 uTools 环境下才同步搜索词
    if (UToolsAdapter.isUTools) {
      if (document.activeElement === inputRef.current) return;
      window.dispatchEvent(
        new CustomEvent(UTOOLS_SYNC_EVENT, { detail: { text: searchQuery } }),
      );
    }
  }, [searchQuery]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (open && matchShortcut(e, searchPanelCloseShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      }

      const key = e.key.toLowerCase();
      if ((key === "k" || key === "p") && (e.metaKey || e.ctrlKey) && !e.repeat) {
        e.preventDefault();
        openInNewTabRef.current = false;
        trackSearchOpened("shortcut");
        setOpen(true);
      }
      if (open && e.key === "Tab") {
        e.preventDefault();
        setSearchAllNotebooks(!searchAllNotebooks);
      }
    };

    document.addEventListener("keydown", down, true);
    const handleOpenSearch = (event: Event) => {
      const detail = (
        event as CustomEvent<{ resetQuery?: boolean; openInNewTab?: boolean }>
      ).detail;
      if (detail?.resetQuery) {
        setSearchQuery("");
      }
      openInNewTabRef.current = detail?.openInNewTab === true;
      trackSearchOpened("programmatic");
      setOpen(true);
    };
    window.addEventListener("goose-note:open-search", handleOpenSearch);
    return () => {
      document.removeEventListener("keydown", down, true);
      window.removeEventListener("goose-note:open-search", handleOpenSearch);
    };
  }, [open, searchAllNotebooks, searchPanelCloseShortcut, setSearchAllNotebooks]);

  const runCommand = useCallback(async (command: () => void) => {
    command();
    await new Promise((resolve) => setTimeout(resolve, 0));
    setOpen(false);
  }, []);

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

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (!open || !trimmedQuery) {
      lastTrackedQueryRef.current = "";
      return;
    }
    if (lastTrackedQueryRef.current === trimmedQuery) return;

    lastTrackedQueryRef.current = trimmedQuery;
    trackEvent("search_submit", {
      feature: "search",
      action: "submit",
      source: "command_palette",
      search_scope: searchAllNotebooks ? "all_notebooks" : "current_notebook",
      query_length: trimmedQuery.length,
      result_count: searchResults.all.length,
    });
  }, [open, searchAllNotebooks, searchQuery, searchResults.all.length]);

  const openPageInTab = useCallback(
    (page: SearchResultPage | Page, query: string | null) => {
      const targetNotebookId = page.workspaceId;

      runCommand(() => {
        trackEvent("search_result_opened", {
          feature: "search",
          action: "open_result",
          result: "success",
          source: "command_palette",
          open_mode: openInNewTabRef.current ? "new_tab" : "current_tab",
          search_scope: searchAllNotebooks ? "all_notebooks" : "current_notebook",
          search_all_notebooks: searchAllNotebooks,
          has_query: Boolean(query?.trim()),
          query_length: query?.trim().length ?? 0,
          result_count: searchResults.all.length,
          cross_notebook: Boolean(targetNotebookId && targetNotebookId !== activeNotebookId),
        });
        if (targetNotebookId && targetNotebookId !== activeNotebookId) {
          setActiveNotebook(targetNotebookId);
        }

        if (openInNewTabRef.current) {
          openTab(page.id);
        } else {
          openInCurrentTab(page.id);
        }
        setExpandPageId(page.id);
        setSearchHighlightQuery(query);

        if (query) {
          setSearchHighlightPageId(page.id);
          setSearchHighlightNonce(Date.now());
        } else {
          setSearchHighlightPageId(null);
        }
      });
    },
    [
      activeNotebookId,
      openInCurrentTab,
      openTab,
      setActiveNotebook,
      setExpandPageId,
      setSearchHighlightNonce,
      setSearchHighlightPageId,
      setSearchHighlightQuery,
      runCommand,
    ],
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Search"
      filter={() => 1}
      className="workspace-shell fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[640px] rounded-[18px] border-0 p-0 overflow-hidden z-[101] text-popover-foreground outline-none ring-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-top-3 data-[state=open]:duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=closed]:slide-out-to-top-3 data-[state=closed]:duration-150 bg-[hsl(var(--goose-shell-bg))] shadow-none"
      aria-describedby={descriptionId}
    >
      <DialogTitle className="sr-only">搜索</DialogTitle>
      <DialogDescription id={descriptionId} className="sr-only">
        搜索和快速访问页面
      </DialogDescription>
      <div className="flex items-center h-14 px-4 shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.07)]" cmdk-input-wrapper="">
        <LucideIcons.Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground/60" />
        <Command.Input
          ref={inputRef}
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder={
            searchAllNotebooks
              ? "搜索所有记事本..."
              : `搜索 "${currentNotebookName}"...`
          }
          className="flex h-14 w-full rounded-md bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div
          className="flex items-center gap-2 ml-3 shrink-0"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => setSearchAllNotebooks(!searchAllNotebooks)}
            className={`px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              searchAllNotebooks
                ? "bg-foreground/8 text-foreground/80"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/5"
            }`}
          >
            {searchAllNotebooks ? "所有记事本" : currentNotebookName}
          </button>
        </div>
        <Kbd shortcut="Tab" className="ml-1 rounded-[8px] border-transparent shadow-[inset_0_0_0_1px_hsl(var(--input)/0.6)] text-muted-foreground/50" />
      </div>

      <Command.List className="max-h-[440px] overflow-y-auto overflow-x-hidden bg-[hsl(var(--goose-editor-bg))] px-2 py-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
          {searchQuery.trim() ? "未找到匹配的页面" : "输入关键词开始搜索"}
        </Command.Empty>

        <PaletteResultGroup
          searchQuery={searchQuery}
          showRecentInSearch={showRecentInSearch}
          searchResults={searchResults}
          getPageBreadcrumb={getPageBreadcrumb}
          onOpenPage={openPageInTab}
          onRemoveRecent={removeRecent}
          onHideRecent={handleHideRecent}
        />
      </Command.List>
    </Command.Dialog>
  );
}
