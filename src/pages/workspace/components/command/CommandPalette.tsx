import {
  useId,
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
} from "react";
import { Command } from "cmdk";
import { Search, Columns2, Rows2, Maximize2, X, ChevronDown } from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { HistoryReadOnlyEditor } from "../history/HistoryReadOnlyEditor";
import { EditorHostBridge } from "../editor-host/EditorHostBridge";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./command-palette.css";
import {
  matchingSplitPaletteActions,
  splitPaletteItemValue,
} from "./splitPaletteActions";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { extractTitleFromContent } from "@/components/editor/utils/content-text-extractor";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { useTabs } from "@/stores/useTabs";
import { FIXED_SPLIT_SHORTCUTS } from "@/lib/fixed-app-shortcuts";
import { shouldSkipAppHotkeyEvent } from "@/hooks/useImeInput";
import { toast } from "@/components/ui/sonner";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { tryShowPageInFocusedSplit } from "@/lib/editor-split/commands";
import { formatShortcut } from "@/lib/utils";

const IDLE_PAGES: Record<string, Page> = {};

export function CommandPalette() {
  const searchLayout = useDefaultLayout({ id: "goose-search", panelIds: ["search-results-panel", "search-preview-panel"], onlySaveAfterUserInteractions: true });
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
  const { activeNotebookId, notebooks } = useNotebooks();
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const scopedNotebookId = selectedNotebookId && notebooks[selectedNotebookId]
    ? selectedNotebookId : null;
  const {
    searchAllNotebooks,
    setSearchAllNotebooks,
    showRecentInSearch,
    setShowRecentInSearch,
    singleTabMode: singleTabModeSetting,
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
    activeNotebookId: scopedNotebookId || activeNotebookId,
    searchAllNotebooks: !scopedNotebookId && searchAllNotebooks,
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
  const previewPage = [...searchResults.recent, ...searchResults.allDisplay].find(
    (page) => commandValue === `recent-${page.id}-${getPageTitle(page)}` ||
      commandValue === `all-${page.id}-${getPageTitle(page)}`,
  );
  const previewHasMatchingHeading = previewPage && Array.isArray(previewPage.content) &&
    previewPage.content[0]?.type === "heading" &&
    extractTitleFromContent(previewPage.content) === getPageTitle(previewPage);
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
    if (open && searchAllNotebooks && !scopedNotebookId) {
      void loadAllLocalFolderPages();
    }
  }, [open, searchAllNotebooks, scopedNotebookId, loadAllLocalFolderPages]);

  useEffect(() => {
    if (!open || !scopedNotebookId) return;
    const notebook = notebooks[scopedNotebookId];
    if (notebook.source === "local-folder" && notebook.localPath && !notebook.localPathMissing) {
      void usePages.getState().loadLocalFolderPages(notebook.id, notebook.localPath)
        .catch(() => toast.error("无法读取该笔记本，请检查文件夹是否可用"));
    }
  }, [open, scopedNotebookId, notebooks]);

  const handleHideRecent = useCallback(() => {
    setShowRecentInSearch(false);
    toast.info("已关闭「最近访问」，可在设置中重新开启", { duration: 3000 });
  }, [setShowRecentInSearch]);

  useEffect(() => {
    // Escape is handled by the dialog after its child controls, never a configurable capture key.
    const down = (e: KeyboardEvent) => {
      if (e.defaultPrevented || shouldSkipAppHotkeyEvent(e)) return;
      if (open && e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setSelectedNotebookId(null);
        setSearchAllNotebooks(scopedNotebookId ? false : !searchAllNotebooks);
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", down, true);
    const handleOpenSearch = (event: Event) => {
      const detail = (event as CustomEvent<{ resetQuery?: boolean; openInNewTab?: boolean }>).detail;
      if (detail?.resetQuery) setSearchQuery("");
      openInNewTabRef.current = !singleTabMode && detail?.openInNewTab === true;
      trackSearchOpened("programmatic");
      setOpen(false);
    };
    window.addEventListener("goose-note:open-search", handleOpenSearch);
    return () => {
      document.removeEventListener("keydown", down, true);
      window.removeEventListener("goose-note:open-search", handleOpenSearch);
    };
  }, [
    open,
    searchAllNotebooks,
    scopedNotebookId,
    setSearchAllNotebooks,
    singleTabMode,
  ]);

  const runCommand = useCallback(async (command: () => void) => {
    command();
    await new Promise((resolve) => setTimeout(resolve, 0));
    setOpen(false);
  }, []);

  const currentNotebookName = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]?.name || "当前笔记本"
    : "当前笔记本";

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
        className="workspace-shell goose-search-panel fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1080px] rounded-lg border-0 p-0 overflow-hidden z-[101] outline-none ring-0 shadow-lg"
        overlayClassName="goose-search-backdrop"
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
            className="flex items-center h-16 px-4"
            cmdk-input-wrapper=""
          >
            <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              ref={inputRef}
              data-goose-inline-input=""
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder={
                !scopedNotebookId && searchAllNotebooks
                  ? "搜索所有笔记本…"
                  : `搜索「${scopedNotebookId ? notebooks[scopedNotebookId].name : currentNotebookName}」…`
              }
              className="flex h-16 min-w-0 w-full rounded-md bg-transparent text-[17px] outline-none placeholder:text-placeholder disabled:cursor-not-allowed disabled:text-disabled"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="搜索范围" className="goose-search-scope flex items-center gap-2 rounded-lg text-sm">
                  <span className="min-w-0 truncate">{scopedNotebookId ? notebooks[scopedNotebookId].name : searchAllNotebooks ? "所有笔记本" : `当前笔记本 · ${currentNotebookName}`}</span>
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuRadioGroup
                  value={scopedNotebookId ? `notebook:${scopedNotebookId}` : searchAllNotebooks ? "all" : "current"}
                  onValueChange={(value) => {
                    if (value === "all" || value === "current") {
                      setSelectedNotebookId(null);
                      setSearchAllNotebooks(value === "all");
                    } else {
                      const id = value.slice("notebook:".length);
                      if (notebooks[id]) setSelectedNotebookId(id);
                    }
                    inputRef.current?.focus();
                  }}
                >
                  <DropdownMenuRadioItem value="current">当前笔记本 · {currentNotebookName}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="all">所有笔记本</DropdownMenuRadioItem>
                  {Object.values(notebooks).map((notebook) => (
                    <DropdownMenuRadioItem key={notebook.id} value={`notebook:${notebook.id}`}>
                      <span className="truncate">{notebook.name}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Group className="goose-search-body" orientation="horizontal" {...searchLayout}>
          <Panel id="search-results-panel" className="goose-search-results-panel" defaultSize="26%" minSize="20%" maxSize="65%">
          <Command.List
            ref={listRef}
            onScroll={handleListScroll}
            className="max-h-[440px] overflow-y-auto overflow-x-hidden bg-[hsl(var(--goose-editor-bg))] px-2 py-2 [&_[cmdk-group-items]]:space-y-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
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
                  const shortcut = FIXED_SPLIT_SHORTCUTS[action.shortcutId];
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
                      className="group relative flex cursor-pointer select-none items-center rounded-[8px] px-2.5 py-2 text-sm text-foreground outline-none transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] aria-selected:bg-[var(--goose-interactive-selected)] aria-selected:text-[var(--goose-interactive-selected-fg)] data-[disabled=true]:pointer-events-none data-[disabled=true]:text-disabled"
                    >
                      <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-[var(--goose-interactive-hover-fg)] group-aria-selected:text-[var(--goose-interactive-selected-fg)]" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {action.label}
                      </span>
                      {shortcut ? (
                        <span className="ml-3 shrink-0 text-xs text-muted-foreground group-hover:text-[var(--goose-interactive-hover-fg)] group-aria-selected:text-[var(--goose-interactive-selected-fg)]">
                          {formatShortcut(shortcut)}
                        </span>
                      ) : null}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
          </Panel>
          <Separator className="goose-search-separator" aria-label="调整搜索结果与预览宽度" onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onKeyDown={(event) => event.stopPropagation()} />
          <Panel id="search-preview-panel" className="goose-search-preview-panel" minSize="35%">
          <section className="goose-search-preview" aria-label="笔记内容预览" onKeyDown={(event) => event.stopPropagation()}>
            {previewPage ? (
              <>
                <header className="goose-search-preview-heading">
                  <span>页面预览</span>
                  {!previewHasMatchingHeading && <h1>{getPageTitle(previewPage)}</h1>}
                  <p className="goose-search-path" title={getPageBreadcrumb(previewPage).slice(0, -1).join(" / ")}>{getPageBreadcrumb(previewPage).slice(0, -1).join(" / ")}</p>
                </header>
                <ErrorBoundary resetKey={previewPage.id} fallback={() => <p role="status">此笔记暂时无法预览，可从左侧打开。</p>}>
                <EditorHostBridge page={previewPage} isEditorFullWidth onContentChangeOverride={() => {}}>
                <HistoryReadOnlyEditor
                  content={previewPage.content}
                  versionKey={`${previewPage.id}:${previewPage.updatedAt}`}
                  sourcePage={previewPage}
                />
                </EditorHostBridge>
                </ErrorBoundary>
              </>
            ) : <p className="goose-search-path">{splitActions.length ? "选择命令并按回车执行" : "选择笔记查看内容"}</p>}
          </section>
          </Panel>
          </Group>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
