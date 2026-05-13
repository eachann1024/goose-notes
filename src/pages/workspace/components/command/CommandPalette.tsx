import { useId, useRef, useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import type { Page } from "@/types";
import { trackEvent } from "@/lib/analytics";
import { useCommandSearch, type SearchResultPage } from "./useCommandSearch";
import { getPageTitle } from "@/lib/page-title";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { useTabs } from "@/stores/useTabs";
import { Kbd } from "@/components/ui/kbd";

const UTOOLS_INPUT_EVENT = "goose-note:utools-search";
const UTOOLS_SYNC_EVENT = "goose-note:utools-search-sync";

function normalizeShortcutToken(raw: string) {
  const token = raw.trim().toLowerCase();
  if (!token) return "";
  if (
    token === "mod" ||
    token === "cmdorctrl" ||
    token === "cmdorcontrol" ||
    token === "commandorcontrol"
  ) {
    return isMacPlatform() ? "meta" : "ctrl";
  }
  if (token === "control" || token === "ctrl") return "ctrl";
  if (token === "meta" || token === "command" || token === "cmd") return "meta";
  if (token === "alt" || token === "option") return "alt";
  if (token === "shift") return "shift";
  if (token === "escape" || token === "esc") return "escape";
  if (token.length === 1) return token;
  return token;
}

function isModifierToken(token: string) {
  return token === "ctrl" || token === "meta" || token === "alt" || token === "shift";
}

function matchShortcut(event: KeyboardEvent, shortcut: string) {
  const trimmed = shortcut.trim();
  if (!trimmed) return false;

  const parts = trimmed
    .split("+")
    .map(normalizeShortcutToken)
    .filter(Boolean);
  if (parts.length === 0) return false;

  const expectedModifiers = {
    ctrl: parts.includes("ctrl"),
    meta: parts.includes("meta"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
  };

  if (
    event.ctrlKey !== expectedModifiers.ctrl ||
    event.metaKey !== expectedModifiers.meta ||
    event.altKey !== expectedModifiers.alt ||
    event.shiftKey !== expectedModifiers.shift
  ) {
    return false;
  }

  const keyToken = parts.find((part) => !isModifierToken(part));
  const eventKey = normalizeShortcutToken(event.key);
  if (!keyToken) {
    return isModifierToken(eventKey) && expectedModifiers[eventKey as keyof typeof expectedModifiers];
  }
  return !isModifierToken(eventKey) && eventKey === keyToken;
}

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
  const openInNewTabRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
    searchPanelCloseShortcut,
  } = useSettings();
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
  const lastTrackedQueryRef = useRef("");

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
    if (typeof window !== "undefined" && (window as any).utools) {
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
      className="workspace-shell fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[640px] rounded-[18px] border-0 p-0 overflow-hidden z-[101] text-popover-foreground outline-none ring-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 bg-[hsl(var(--goose-shell-bg))] shadow-none"
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
        <Kbd shortcut="Tab" className="rounded-[10px] border-transparent shadow-[inset_0_0_0_1px_hsl(var(--input)/0.7)]" />
      </div>

      <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden bg-[hsl(var(--goose-editor-bg))] px-2 py-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-foreground/90">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
          {searchQuery.trim() ? "未找到匹配的页面" : "输入关键词开始搜索"}
        </Command.Empty>

        {!searchQuery.trim() &&
          showRecentInSearch &&
          searchResults.recent.length > 0 && (
          <Command.Group heading="最近访问">
            {searchResults.recent.map((page: Page) => {
              const breadcrumb = getPageBreadcrumb(page);
              return (
                <Command.Item
                  key={`recent-${page.id}`}
                  value={`recent-${page.id}-${getPageTitle(page)}`}
                  onSelect={() => {
                    openPageInTab(page, null);
                  }}
                  className="group relative flex cursor-pointer select-none items-center rounded-[8px] px-2 py-1.5 text-sm text-foreground/92 outline-none transition-colors hover:bg-[var(--goose-interactive-hover)] aria-selected:bg-[var(--goose-interactive-selected)] aria-selected:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
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
                    const highlightQuery = searchQuery.trim() || null;
                    openPageInTab(page, highlightQuery);
                  }}
                  className="relative flex cursor-pointer select-none items-start rounded-[8px] px-2 py-1.5 text-sm text-foreground/92 outline-none transition-colors hover:bg-[var(--goose-interactive-hover)] aria-selected:bg-[var(--goose-interactive-selected)] aria-selected:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
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
