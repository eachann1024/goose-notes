import * as GooseIcons from "@/components/ui/icons";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarMainTree } from "./main-tree/SidebarMainTree";
import { SettingsDialog } from "./SettingsDialog";
import { useTabs } from "@/stores/useTabs";
import { useSidebarView } from "@/stores/useSidebarView";
import { useEditorSplitSelector } from "@/stores/useEditorSplit";
import { focusedPageIdOf } from "@/lib/editor-split/tree";
import { useEffectiveSidebarCollapsed } from "@/hooks/useWorkspaceViewportCollapse";
import { useWorkspaceViewport } from "@/stores/useWorkspaceViewport";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { resolveSidebarOverlayWidth, SIDEBAR_MAX_WIDTH, useSidebarResize } from "./hooks/useSidebarResize";
import { useSidebarItemHeight } from "./hooks/useSidebarItemHeight";
import { useSidebarEffects } from "./hooks/useSidebarEffects";
import { SidebarResizeEdge } from "./SidebarResizeEdge";
import { SidebarSectionHeader } from "./SidebarSectionHeader";
import { SidebarOutline } from "./SidebarOutline";
import { shouldDismissSidebarOverlay } from "./sidebarOverlayEscape";
import { SidebarSearch } from "./SidebarSearch";
import { useSearchSession } from "./useSearchSession";
import { HistoryVersionList } from "../history/HistoryView";
import { useHistoryView } from "@/stores/useHistoryView";
import { closeNotebookAiIfFullscreen } from "../notebook-ai/useNotebookAiPanel";
import { isElectronHost } from "@/lib/local-vault";
import type { SettingsTab } from "./settings/types";
import { activateWorkspace } from "@/lib/settings-navigation";
import "./sidebar-layout.css";

type SidebarView = "pages" | "outline" | "search";
interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  disableResize?: boolean;
  selectedPageId?: string | null;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  settingsOpen: boolean;
  settingsSidebarExpanded: boolean;
  onSettingsSidebarExpandedChange: (expanded: boolean) => void;
  onSettingsOpenChange: (open: boolean) => void;
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
  settingsMainHost: HTMLElement | null;
}

export function Sidebar({
  className,
  disableResize = false,
  selectedPageId,
  scrollContainerRef,
  settingsOpen,
  settingsSidebarExpanded,
  onSettingsSidebarExpandedChange,
  onSettingsOpenChange,
  settingsTab,
  onSettingsTabChange,
  settingsMainHost,
}: SidebarProps) {
  const activePageId = usePages((s) => s.activePageId);
  const createPage = usePages((s) => s.createPage);
  const createLocalPage = usePages((s) => s.createLocalPage);
  const getPage = usePages((s) => s.getPage);
  const setExpandPageId = usePages((s) => s.setExpandPageId);
  const { activeNotebookId, notebooks } = useNotebooks();
  const { openInCurrentTab, activeTabId, openTabs } = useTabs();
  const activeTab = openTabs.find((tab) => tab.id === activeTabId);
  const outlineTarget = useEditorSplitSelector(
    (state) => {
      const split = activeTabId ? state.byTabId[activeTabId] : null;
      const pageId = split
        ? focusedPageIdOf(split) ?? activePageId
        : activePageId;
      return {
        pageId,
        paneId: split?.focusedLeafId ?? null,
        focusKey: `${activeTabId ?? ""}:${split?.focusedLeafId ?? pageId ?? ""}`,
      };
    },
    (left, right) =>
      left.pageId === right.pageId &&
      left.paneId === right.paneId &&
      left.focusKey === right.focusKey,
  );
  const outlinePageId =
    selectedPageId === null || activeTab?.type
      ? null
      : outlineTarget.pageId;
  const outlinePage = usePages((s) =>
    outlinePageId ? s.pages[outlinePageId] : undefined,
  );
  const setExpanded = useSidebarView((s) => s.setExpanded);
  const workspaceSidebarCollapsed = useEffectiveSidebarCollapsed();
  const sidebarCollapsed = settingsOpen ? !settingsSidebarExpanded : workspaceSidebarCollapsed;
  const forceCollapseLeft = useWorkspaceViewport((s) => s.forceCollapseLeft);
  const leftExpandOverride = useWorkspaceViewport((s) => s.leftExpandOverride);
  const setLeftExpandOverride = useWorkspaceViewport((s) => s.setLeftExpandOverride);
  const sidebarOverlay = forceCollapseLeft && (settingsOpen ? settingsSidebarExpanded : leftExpandOverride) && !sidebarCollapsed;
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarModeRailRef = useRef<HTMLElement>(null);
  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;
  const isLocalFolder = activeNotebook?.source === "local-folder";
  // Electron 仅本地模式：没有仓库时不露出「新建页面」入口与内置本语义
  const electronNoVault = isElectronHost && !activeNotebookId;

  const itemHeight = useSidebarItemHeight() + 4;
  const rowHeight = itemHeight + 2;

  const previewSidebarWidth = useCallback((nextWidth: number) => {
    const sidebar = sidebarRef.current;
    sidebar?.style.setProperty("--sidebar-configured-width", `${nextWidth}px`);
    const shell = sidebar?.closest(".workspace-shell");
    if (shell instanceof HTMLElement) {
      shell.style.setProperty(
        "--workspace-sidebar-width",
        `${sidebarCollapsed || sidebarOverlay ? 0 : nextWidth}px`,
      );
    }
  }, [sidebarCollapsed, sidebarOverlay]);

  const { width, minWidth, maxWidth, isResizing, handleResizePointerDown, handleResizeKeyDown } =
    useSidebarResize({
      disableResize: disableResize || sidebarCollapsed,
      onWidthPreview: previewSidebarWidth,
      maxWidth: sidebarOverlay
        ? resolveSidebarOverlayWidth(SIDEBAR_MAX_WIDTH, viewportWidth)
        : SIDEBAR_MAX_WIDTH,
    });

  const [currentView, setCurrentView] = useState<SidebarView>("pages");
  const [settingsSidebarHost, setSettingsSidebarHost] = useState<HTMLDivElement | null>(null);
  const searchSessionOpen = useSearchSession((state) => state.open);
  useEffect(() => {
    if (searchSessionOpen) setCurrentView("search");
    else if (currentView === "search") setCurrentView("pages");
  }, [searchSessionOpen, currentView]);
  useLayoutEffect(() => {
    const rail = sidebarModeRailRef.current;
    if (!rail?.contains(document.activeElement)) return;
    // 焦点已在窄栏内时跟随当前视图，保留编辑器或搜索框里的焦点。
    rail.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.focus({ preventScroll: true });
  }, [currentView, settingsOpen]);
  const openSearchSession = useSearchSession((s) => s.openSearch);
  const searchShortcut = useSettings((state) =>
    state.appShortcuts.openSearch
      ? formatShortcut(state.appShortcuts.openSearch)
      : "",
  );
  const sidebarViewShortcut = (digit: 1 | 2 | 3) => formatShortcut(`Mod+${digit}`);

  // 历史模式暂时隐藏窄轨和页面树，但保留当前模式与 Footer；退出后回到原侧栏状态。
  const historyActivePageId = useHistoryView((s) => s.active);
  const exitHistoryView = useHistoryView((s) => s.exit);
  const inHistoryMode =
    !!historyActivePageId && historyActivePageId === activePageId;

  const restoreSidebarFocusRef = useRef(false);
  const [scrollAreaNode, setScrollAreaNode] = useState<HTMLDivElement | null>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);

  const closeSidebarOverlay = useCallback(() => {
    const active = document.activeElement;
    restoreSidebarFocusRef.current = !!active && (
      !!sidebarRef.current?.contains(active) ||
      active === sidebarRef.current?.previousElementSibling
    );
    if (settingsOpen) onSettingsSidebarExpandedChange(false);
    else setLeftExpandOverride(false);
  }, [settingsOpen, onSettingsSidebarExpandedChange, setLeftExpandOverride]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      activateWorkspace();
      const detail = (event as CustomEvent<{ resetQuery?: boolean }>).detail;
      if (detail?.resetQuery) useSearchSession.getState().setQuery("");
      setCurrentView("search");
      if (workspaceSidebarCollapsed && !forceCollapseLeft) useSidebarView.getState().setSidebarCollapsed(false);
      if (forceCollapseLeft) setLeftExpandOverride(true);
      if (inHistoryMode) exitHistoryView();
      closeNotebookAiIfFullscreen();
      openSearchSession(activeNotebookId, activePageId, scrollContainerRef?.current?.scrollTop ?? 0);
    };
    const onSwitchSidebarView = (event: Event) => {
      const view = (event as CustomEvent<{ view?: SidebarView }>).detail?.view;
      if (view === "search") onOpen(event);
      else if (view === "pages" || view === "outline") {
        activateWorkspace();
        if (useSearchSession.getState().open) useSearchSession.getState().closeSearch();
        if (view === "outline") closeNotebookAiIfFullscreen();
        setCurrentView(view);
        if (forceCollapseLeft) setLeftExpandOverride(true);
        if (inHistoryMode) exitHistoryView();
      }
    };
    const onWorkspaceActivate = () => onSettingsOpenChange(false);
    const onCloseSettings = () => onSettingsOpenChange(false);
    window.addEventListener("goose-note:open-search", onOpen);
    window.addEventListener("goose-note:switch-sidebar-view", onSwitchSidebarView);
    window.addEventListener("goose-note:workspace-activate", onWorkspaceActivate);
    window.addEventListener("goose-note:close-settings", onCloseSettings);
    return () => {
      window.removeEventListener("goose-note:open-search", onOpen);
      window.removeEventListener("goose-note:switch-sidebar-view", onSwitchSidebarView);
      window.removeEventListener("goose-note:workspace-activate", onWorkspaceActivate);
      window.removeEventListener("goose-note:close-settings", onCloseSettings);
    };
  }, [activeNotebookId, activePageId, forceCollapseLeft, inHistoryMode, scrollContainerRef, openSearchSession, setLeftExpandOverride, exitHistoryView, onSettingsOpenChange, workspaceSidebarCollapsed]);

  useEffect(() => {
    if (!sidebarOverlay) return;
    const onEscape = (event: KeyboardEvent) => {
      if (settingsOpen || useSearchSession.getState().open) return;
      if (!shouldDismissSidebarOverlay(event, document)) return;
      event.preventDefault();
      event.stopPropagation();
      closeSidebarOverlay();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [sidebarOverlay, settingsOpen, closeSidebarOverlay]);

  useSidebarEffects({
    activePageId,
    activeNotebookId,
    currentView,
    onSettingsTabChange,
    onOpenSettings: (tab) => {
      if (tab) onSettingsTabChange(tab);
      onSettingsOpenChange(true);
    },
  });

  const previousNotebookIdRef = useRef<string | null | undefined>(undefined);
  const resetSidebarAfterNotebookChange = useCallback(
    (options: { exitHistory: boolean }) => {
      setCurrentView("pages");
      if (options.exitHistory) exitHistoryView();
    },
    [exitHistoryView],
  );

  useEffect(() => {
    const previousNotebookId = previousNotebookIdRef.current;
    previousNotebookIdRef.current = activeNotebookId;
    if (previousNotebookId === activeNotebookId) return;
    if (previousNotebookId === undefined && !isLocalFolder) return;
    if (useSearchSession.getState().open) return;

    resetSidebarAfterNotebookChange({
      exitHistory: inHistoryMode,
    });
  }, [
    activeNotebookId,
    inHistoryMode,
    isLocalFolder,
    resetSidebarAfterNotebookChange,
  ]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const stage = sidebarRef.current?.closest(".workspace-stage");
    root.toggleAttribute("data-sidebar-collapsed", sidebarCollapsed);
    sidebarRef.current?.toggleAttribute("data-sidebar-overlay", sidebarOverlay);
    if (stage instanceof HTMLElement) {
      stage.toggleAttribute("data-sidebar-collapsed", sidebarCollapsed);
      stage.toggleAttribute("data-sidebar-overlay", sidebarOverlay);
    }
    return () => {
      root.removeAttribute("data-sidebar-collapsed");
      sidebarRef.current?.removeAttribute("data-sidebar-overlay");
      if (stage instanceof HTMLElement) {
        stage.removeAttribute("data-sidebar-collapsed");
        stage.removeAttribute("data-sidebar-overlay");
      }
    };
  }, [sidebarCollapsed, sidebarOverlay]);

  useLayoutEffect(() => {
    previewSidebarWidth(width);
  }, [previewSidebarWidth, width]);

  useLayoutEffect(() => {
    if (sidebarOverlay || !restoreSidebarFocusRef.current) return;
    restoreSidebarFocusRef.current = false;
    sidebarRef.current?.closest(".workspace-shell")
      ?.querySelector<HTMLButtonElement>('button[aria-label="展开侧栏"]')
      ?.focus({ preventScroll: true });
  }, [sidebarOverlay]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setViewportWidth(window.innerWidth);
    });
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!scrollAreaNode) {
      setScrollAreaHeight(0);
      return;
    }
    let lastHeight = -1;
    const updateHeight = () => {
      const height = scrollAreaNode.clientHeight;
      if (height === lastHeight) return;
      lastHeight = height;
      setScrollAreaHeight(height);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(scrollAreaNode);
    return () => observer.disconnect();
  }, [scrollAreaNode]);

  const handleCreatePage = () => {
    if (!activeNotebookId) return;
    activateWorkspace();
    closeNotebookAiIfFullscreen();
    // 在当前所处页面的同级创建：取当前页的 parentId 作为新页的父级
    const basePageId = selectedPageId ?? activePageId;
    const basePage = basePageId ? getPage(basePageId) : undefined;
    const siblingParentId =
      basePage && basePage.workspaceId === activeNotebookId
        ? basePage.parentId
        : undefined;
    if (isLocalFolder) {
      void Promise.resolve(createLocalPage(siblingParentId, activeNotebookId)).then((newPageId) => {
        if (newPageId) openInCurrentTab(newPageId);
      });
      return;
    }
    const newPageId = createPage(siblingParentId, activeNotebookId);
    openInCurrentTab(newPageId);
    // 新页若落在折叠的父级下，展开祖先并聚焦使其可见
    if (siblingParentId) setExpandPageId(newPageId);
  };

  const handleOpenSearch = () => {
    activateWorkspace();
    setCurrentView("search");
    if (workspaceSidebarCollapsed && !forceCollapseLeft) useSidebarView.getState().setSidebarCollapsed(false);
    if (forceCollapseLeft) setLeftExpandOverride(true);
    if (inHistoryMode) exitHistoryView();
    closeNotebookAiIfFullscreen();
    openSearchSession(activeNotebookId, activePageId, scrollContainerRef?.current?.scrollTop ?? 0);
  };

  const switchSidebarView = (view: SidebarView) => {
    activateWorkspace();
    if (forceCollapseLeft) setLeftExpandOverride(true);
    if (inHistoryMode) exitHistoryView();
    if (view !== "search") useSearchSession.getState().closeSearch();
    if (view === "outline") closeNotebookAiIfFullscreen();
    setCurrentView(view);
  };

  const headerTitle =
    currentView === "search"
      ? "搜索"
      : currentView === "outline"
        ? outlinePage ? getPageTitle(outlinePage) : "大纲"
        : isLocalFolder ? "本地" : electronNoVault ? "仓库" : "页面";

  return <>
    {sidebarOverlay && (
      <button
        type="button"
        className="sidebar-overlay-backdrop"
        aria-label="关闭导航面板"
        tabIndex={-1}
        onClick={closeSidebarOverlay}
      />
    )}
    <div
      ref={sidebarRef}
      className={cn(
        "pb-0 h-full flex flex-col relative group/sidebar",
        sidebarCollapsed && "pointer-events-none",
        className,
      )}
      data-sidebar-resizing={isResizing || undefined}
      style={{
        width: sidebarCollapsed ? 0 : "var(--sidebar-configured-width)",
        minWidth: 0,
        opacity: sidebarCollapsed ? 0 : 1,
        transform: sidebarCollapsed ? "translateX(-8px)" : "translateX(0)",
        overflow: sidebarCollapsed ? "hidden" : "visible",
      }}
      aria-hidden={sidebarCollapsed}
      inert={sidebarCollapsed}
    >
      {!disableResize && !sidebarCollapsed && (
        <SidebarResizeEdge
          width={width}
          minWidth={minWidth}
          maxWidth={maxWidth}
          isResizing={isResizing}
          onPointerDown={handleResizePointerDown}
          onKeyDown={handleResizeKeyDown}
        />
      )}

      <div
        className="sidebar-size-container flex h-full min-h-0 flex-col"
        style={{
          width: sidebarOverlay ? "100%" : "var(--sidebar-configured-width)",
          minWidth: sidebarOverlay ? 0 : "var(--sidebar-configured-width)",
        }}
      >
        <div className="flex min-h-0 flex-1">
          <div className="sidebar-rail-shell">
            <TooltipProvider delayDuration={600}>
              <nav
                ref={sidebarModeRailRef}
                className="sidebar-mode-rail"
                aria-label="侧栏视图"
                hidden={inHistoryMode && !settingsOpen}
                inert={inHistoryMode && !settingsOpen}
                aria-hidden={inHistoryMode && !settingsOpen}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sidebar-mode-rail-button"
                      aria-label="本地"
                      aria-pressed={!settingsOpen && currentView === "pages"}
                      onClick={() => switchSidebarView("pages")}
                    >
                      <GooseIcons.FolderOpen aria-hidden="true" className="h-4 w-4" />
                      <span className="sidebar-mode-rail-label">本地</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>本地页面</span>
                      <span className="text-[11px] text-muted-foreground">{sidebarViewShortcut(1)}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sidebar-mode-rail-button"
                      aria-label="大纲"
                      aria-pressed={!settingsOpen && currentView === "outline"}
                      onClick={() => switchSidebarView("outline")}
                    >
                      <GooseIcons.ListTree aria-hidden="true" className="h-4 w-4" />
                      <span className="sidebar-mode-rail-label">大纲</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>当前文档大纲</span>
                      <span className="text-[11px] text-muted-foreground">{sidebarViewShortcut(2)}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sidebar-mode-rail-button"
                      aria-label="搜索"
                      aria-pressed={!settingsOpen && currentView === "search"}
                      onClick={handleOpenSearch}
                    >
                      <GooseIcons.Search aria-hidden="true" className="h-4 w-4" />
                      <span className="sidebar-mode-rail-label">搜索</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>搜索</span>
                      <span className="text-[11px] text-muted-foreground">{sidebarViewShortcut(3)}</span>
                      {searchShortcut && (
                        <span className="text-[11px] text-muted-foreground">
                          {searchShortcut}
                        </span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </nav>
            </TooltipProvider>
            <SidebarFooter
              isSettingsOpen={settingsOpen}
              onOpenSettings={() => {
                if (inHistoryMode) exitHistoryView();
                onSettingsOpenChange(true);
              }}
            />
          </div>
          <div ref={setSettingsSidebarHost} className="sidebar-content-surface relative flex min-h-0 min-w-0 flex-1 flex-col">
            {inHistoryMode && !settingsOpen && (
              <div className="min-h-0 flex-1 overflow-hidden rounded-[inherit]">
                <HistoryVersionList />
              </div>
            )}
            <div
              className="sidebar-design flex min-h-0 flex-1 flex-col"
              hidden={inHistoryMode || settingsOpen}
              inert={inHistoryMode || settingsOpen}
              aria-hidden={inHistoryMode || settingsOpen}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="sidebar-tree-heading shrink-0" hidden={currentView === "search"}>
                    <SidebarSectionHeader
                      title={currentView === "search" ? "搜索" : headerTitle}
                      eyebrow={currentView === "outline" ? "文档大纲" : undefined}
                      onCreate={currentView === "pages" && !electronNoVault ? handleCreatePage : undefined}
                      createTitle={isLocalFolder ? "新建文件" : "新建页面"}
                      onCollapseAll={
                        currentView === "pages" && activeNotebookId
                          ? () => setExpanded(activeNotebookId, [])
                          : undefined
                      }
                    />
                  </div>
                  <div
                    ref={setScrollAreaNode}
                    className="sidebar-content-pane flex min-h-0 flex-1 flex-col"
                    data-sidebar-page-list=""
                    hidden={currentView !== "pages"}
                    inert={currentView !== "pages"}
                    aria-hidden={currentView !== "pages"}
                  >
                    <SidebarMainTree
                      activeNotebookId={activeNotebookId}
                      selectedPageId={selectedPageId}
                      rowHeight={rowHeight}
                      itemHeight={rowHeight}
                      viewportHeight={scrollAreaHeight}
                      onCreatePage={handleCreatePage}
                    />
                  </div>
                  <SidebarSearch />
                  {currentView === "outline" && (
                    <div className="flex min-h-0 flex-1 overflow-hidden pr-2">
                      <SidebarOutline
                        scrollContainerRef={scrollContainerRef}
                        pageId={outlinePageId}
                        focusKey={outlineTarget.focusKey}
                        paneId={outlineTarget.paneId}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={onSettingsOpenChange}
          activeTab={settingsTab}
          onTabChange={onSettingsTabChange}
          sidebarContainer={settingsSidebarHost}
          mainContainer={settingsMainHost}
        />
      </div>
    </div>
  </>;
}
