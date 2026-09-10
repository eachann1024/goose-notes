import {
  useId,
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
} from "react";
import { Command } from "cmdk";
import { Search, Columns2, Rows2, Maximize2, X } from "lucide-react";
import type { Page } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCommandSearch, type SearchResultPage } from "./useCommandSearch";
import { useCommandSearchIndexWarmup } from "./useCommandSearchIndexWarmup";
import { PaletteResultGroup } from "./PaletteResultGroup";
import {
  matchingSplitPaletteActions,
  splitPaletteItemValue,
} from "./splitPaletteActions";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { useTabs } from "@/stores/useTabs";
import { Kbd } from "@/components/ui/kbd";
import {
  getModifierOnlyShortcut,
  matchMouseShortcut,
  matchModifierOnlyShortcutKey,
  matchModifierOnlyShortcutKeyDown,
  matchShortcut,
} from "@/lib/shortcut-match";
import { toast } from "@/components/ui/sonner";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { tryShowPageInFocusedSplit } from "@/lib/editor-split/commands";
import { formatShortcut } from "@/lib/utils";

const IDLE_PAGES: Record<string, Page> = {};

export function CommandPalette() {
  useCommandSearchIndexWarmup();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openInNewTabRef = useRef(false);
  const [open, setOpen] = useState(false);
  // cmdk 根的「当前选中项」受控值。cmdk 不会在结果列表变化时自动重选第一项，
  // 不受控就会出现「输完词没有任何项高亮、方向键/回车第一下没反应」。见下方 effect。
  const [commandValue, setCommandValue] = useState("");
  const { openPreviewTab, openPermanentTab } = useTabs();
  const pages = usePages((s) => (open ? s.pages : IDLE_PAGES));
  const setExpandPageId = usePages((s) => s.setExpandPageId);
  const setSearchHighlightQuery = usePages((s) => s.setSearchHighlightQuery);
  const setSearchHighlightPageId = usePages((s) => s.setSearchHighlightPageId);
  const setSearchHighlightNonce = usePages((s) => s.setSearchHighlightNonce);
  const loadAllLocalFolderPages = usePages((s) => s.loadAllLocalFolderPages);
  const { activeNotebookId } = useNotebooks();
  const {
    searchAllNotebooks,
    setSearchAllNotebooks,
    showRecentInSearch,
    setShowRecentInSearch,
    searchPanelCloseShortcut,
    singleTabMode: singleTabModeSetting,
    appShortcuts,
  } = useSettings();
  const singleTabMode = effectiveSingleTabMode(singleTabModeSetting);
  const {
    searchResults,
    getPageBreadcrumb,
    pageIdsWithChildren,
    searchQuery,
    setSearchQuery,
    removeRecent,
    loadMoreResults,
  } = useCommandSearch({
    pages,
    activeNotebookId,
    searchAllNotebooks,
  });
  const trackSearchOpened = useCallback(
    (_openSource: "shortcut" | "programmatic") => {},
    [],
  );

  /**
   * 滚到当前内容约一半就加载更多（不必贴底）。
   * scrollHeight 很短时（结果未撑满列表）也在 layout 后补载，避免永远触发不了。
   */
  const tryLoadMoreFromScroll = useCallback(
    (el: HTMLElement) => {
      if (!searchResults.hasMore) return;
      const midLine = el.scrollHeight * 0.5;
      if (el.scrollTop + el.clientHeight >= midLine) {
        loadMoreResults();
      }
    },
    [loadMoreResults, searchResults.hasMore],
  );

  const handleListScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      tryLoadMoreFromScroll(event.currentTarget);
    },
    [tryLoadMoreFromScroll],
  );

  useLayoutEffect(() => {
    if (!open || !searchResults.hasMore) return;
    const el = listRef.current;
    if (!el) return;
    // 内容不足以滚动时，scroll 事件不会来，主动补到能滚或耗尽
    if (el.scrollHeight <= el.clientHeight + 4) {
      loadMoreResults();
      return;
    }
    tryLoadMoreFromScroll(el);
  }, [
    open,
    loadMoreResults,
    searchResults.hasMore,
    searchResults.allDisplay.length,
    tryLoadMoreFromScroll,
  ]);

  // 键盘下移选中到「当前已渲染列表」中后半段时也加载，避免只能靠鼠标滚到中间
  useEffect(() => {
    if (!open || !searchResults.hasMore || !commandValue) return;
    const items = searchResults.allDisplay;
    if (items.length < 2) return;
    const midIndex = Math.floor(items.length * 0.5);
    const selectedIndex = items.findIndex(
      (page) => `all-${page.id}-${getPageTitle(page)}` === commandValue,
    );
    if (selectedIndex >= midIndex) {
      loadMoreResults();
    }
  }, [
    open,
    commandValue,
    loadMoreResults,
    searchResults.hasMore,
    searchResults.allDisplay,
  ]);

  // 计算「渲染顺序里第一个可见结果项」的 value，必须与 PaletteResultGroup 的 value 完全一致：
  //   无 query 且显示最近访问 → recent[0] 用 `recent-...`，否则 all[0] 用 `all-...`
  //   有 query → allDisplay[0] 用 `all-...`
  //   仅分屏动作命中（无页面）→ `split-action-...`；空查询不渲染动作，避免盖住搜索空态。
  const splitActions = matchingSplitPaletteActions(searchQuery);
  const firstItemValue = (() => {
    const hasQuery = searchQuery.trim().length > 0;
    if (!hasQuery && showRecentInSearch && searchResults.recent.length > 0) {
      const p = searchResults.recent[0];
      return `recent-${p.id}-${getPageTitle(p)}`;
    }
    const first = searchResults.allDisplay[0];
    if (first) return `all-${first.id}-${getPageTitle(first)}`;
    return splitActions[0] ? splitPaletteItemValue(splitActions[0]) : "";
  })();

  // 结果变化时把选中项重置到第一项（cmdk 不会自动做），保证打字后即可直接上下键 + 回车跳转。
  useEffect(() => {
    setCommandValue(firstItemValue);
  }, [firstItemValue]);

  // 切到「所有记事本」时兜底预加载未加载的 local-folder 记事本页面（启动预热的补充）。
  // action 内部对已加载 / 加载中的记事本去重，重复调用安全。
  useEffect(() => {
    if (open && searchAllNotebooks) {
      void loadAllLocalFolderPages();
    }
  }, [open, searchAllNotebooks, loadAllLocalFolderPages]);

  const handleHideRecent = useCallback(() => {
    setShowRecentInSearch(false);
    toast.info("已关闭「最近访问」，可在设置中重新开启", { duration: 3000 });
  }, [setShowRecentInSearch]);

  useEffect(() => {
    let pendingModifierOnlyClose = false;

    const down = (e: KeyboardEvent) => {
      if (
        open &&
        getModifierOnlyShortcut(searchPanelCloseShortcut) &&
        matchModifierOnlyShortcutKeyDown(e, searchPanelCloseShortcut)
      ) {
        pendingModifierOnlyClose = true;
        return;
      }
      if (pendingModifierOnlyClose) {
        pendingModifierOnlyClose = false;
      }

      const eventForMatching =
        e.key === " "
          ? ({
              key: "Space",
              code: e.code,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              altKey: e.altKey,
              shiftKey: e.shiftKey,
            } as KeyboardEvent)
          : e;
      if (open && matchShortcut(eventForMatching, searchPanelCloseShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      }

      if (open && e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setSearchAllNotebooks(!searchAllNotebooks);
        inputRef.current?.focus();
      }
    };

    const up = (e: KeyboardEvent) => {
      const shouldClose =
        open &&
        pendingModifierOnlyClose &&
        matchModifierOnlyShortcutKey(e, searchPanelCloseShortcut);
      pendingModifierOnlyClose = false;
      if (!shouldClose) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };

    const handleMouseShortcut = (event: MouseEvent) => {
      pendingModifierOnlyClose = false;
      if (!open || !matchMouseShortcut(event, searchPanelCloseShortcut)) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };

    document.addEventListener("keydown", down, true);
    document.addEventListener("keyup", up, true);
    document.addEventListener("mousedown", handleMouseShortcut, true);
    const handleOpenSearch = (event: Event) => {
      const detail = (
        event as CustomEvent<{ resetQuery?: boolean; openInNewTab?: boolean }>
      ).detail;
      if (detail?.resetQuery) {
        setSearchQuery("");
      }
      openInNewTabRef.current = !singleTabMode && detail?.openInNewTab === true;
      trackSearchOpened("programmatic");
      setOpen(true);
    };
    window.addEventListener("goose-note:open-search", handleOpenSearch);
    return () => {
      document.removeEventListener("keydown", down, true);
      document.removeEventListener("keyup", up, true);
      document.removeEventListener("mousedown", handleMouseShortcut, true);
      window.removeEventListener("goose-note:open-search", handleOpenSearch);
    };
  }, [
    open,
    searchAllNotebooks,
    searchPanelCloseShortcut,
    setSearchAllNotebooks,
    singleTabMode,
  ]);

  const runCommand = useCallback(async (command: () => void) => {
    command();
    await new Promise((resolve) => setTimeout(resolve, 0));
    setOpen(false);
  }, []);

  const currentNotebookName = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]?.name || "当前记事本"
    : "当前记事本";

  // 手动聚焦输入框，绕过 cmdk 的焦点管理。快捷键面板不能等双 rAF。
  useLayoutEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, searchQuery, searchAllNotebooks]);

  const openPageInTab = useCallback(
    (page: SearchResultPage | Page, query: string | null) => {
      runCommand(() => {
        closeNotebookAiIfFullscreen();
        if (!singleTabMode && openInNewTabRef.current) {
          openPermanentTab(page.id);
        } else if (!tryShowPageInFocusedSplit(page.id)) {
          openPreviewTab(page.id);
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
      singleTabMode,
      openPreviewTab,
      openPermanentTab,
      setExpandPageId,
      setSearchHighlightNonce,
      setSearchHighlightPageId,
      setSearchHighlightQuery,
      runCommand,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        hideClose
        className="workspace-shell fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[640px] rounded-[18px] border-0 p-0 overflow-hidden z-[101] text-popover-foreground outline-none ring-0 bg-[hsl(var(--goose-shell-bg))] shadow-none"
        aria-describedby={descriptionId}
      >
        <Command
          label="Global Search"
          value={commandValue}
          onValueChange={setCommandValue}
          shouldFilter={false}
        >
          <DialogTitle className="sr-only">搜索</DialogTitle>
          <DialogDescription id={descriptionId} className="sr-only">
            搜索和快速访问页面
          </DialogDescription>
          <div
            className="flex items-center h-14 px-4 shadow-[inset_0_-1px_0_hsl(var(--foreground)/0.07)]"
            cmdk-input-wrapper=""
          >
            <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground/60" />
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
                tabIndex={-1}
                onClick={() => setSearchAllNotebooks(!searchAllNotebooks)}
                className={`px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  // 用实色交互变量而非 bg-foreground/8：Electron 旧内核解析不了 Tailwind 的
                  // color-mix(... var(--color-foreground) 8% ...) 透明度，会回退成纯黑实色（黑块吞字）。
                  searchAllNotebooks
                    ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                    : "text-muted-foreground/60 hover:text-[var(--goose-interactive-selected-fg)] hover:bg-[var(--goose-interactive-hover)]"
                }`}
              >
                {searchAllNotebooks ? "所有记事本" : currentNotebookName}
              </button>
            </div>
            <Kbd
              shortcut="Tab"
              className="ml-1 rounded-[8px] border-transparent shadow-[inset_0_0_0_1px_hsl(var(--input)/0.6)] text-muted-foreground/50"
            />
          </div>

          <Command.List
            ref={listRef}
            onScroll={handleListScroll}
            className="max-h-[440px] overflow-y-auto overflow-x-hidden bg-[hsl(var(--goose-editor-bg))] px-2 py-2 [&_[cmdk-group-items]]:space-y-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50"
          >
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {searchQuery.trim() ? "未找到匹配的页面" : "输入关键词开始搜索"}
            </Command.Empty>

            <PaletteResultGroup
              searchQuery={searchQuery}
              showRecentInSearch={showRecentInSearch}
              searchResults={searchResults}
              getPageBreadcrumb={getPageBreadcrumb}
              pageIdsWithChildren={pageIdsWithChildren}
              onOpenPage={openPageInTab}
              onRemoveRecent={removeRecent}
              onHideRecent={handleHideRecent}
            />

            {splitActions.length > 0 && (
              <Command.Group heading="分屏">
                {splitActions.map((action) => {
                  const shortcut = appShortcuts[action.shortcutId];
                  const Icon =
                    action.id === "split-right"
                      ? Columns2
                      : action.id === "split-down"
                        ? Rows2
                        : action.id === "split-close"
                          ? X
                          : Maximize2;
                  return (
                    <Command.Item
                      key={action.id}
                      value={splitPaletteItemValue(action)}
                      onSelect={() => {
                        runCommand(() => {
                          action.run();
                        });
                      }}
                      className="group relative flex cursor-pointer select-none items-center rounded-[8px] px-2.5 py-2 text-sm text-foreground/90 outline-none transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)] aria-selected:bg-[var(--goose-interactive-selected)] aria-selected:text-[var(--goose-interactive-selected-fg)] data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                    >
                      <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-[var(--goose-interactive-selected-fg)] group-aria-selected:text-[var(--goose-interactive-selected-fg)]" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {action.label}
                      </span>
                      {shortcut ? (
                        <span className="ml-3 shrink-0 text-xs text-muted-foreground group-hover:text-[var(--goose-interactive-selected-fg)] group-aria-selected:text-[var(--goose-interactive-selected-fg)]">
                          {formatShortcut(shortcut)}
                        </span>
                      ) : null}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
