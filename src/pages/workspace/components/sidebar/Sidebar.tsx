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
import { HistoryVersionList } from "../history/HistoryView";
import { useHistoryView } from "@/stores/useHistoryView";
import { closeNotebookAiIfFullscreen } from "../notebook-ai/useNotebookAiPanel";
import { isElectronHost } from "@/lib/local-vault";
import * as LucideIcons from "lucide-react";
import "./sidebar-layout.css";

type SidebarView = "pages" | "outline";
interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  disableResize?: boolean;
  selectedPageId?: string | null;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function Sidebar({
  className,
  disableResize = false,
  selectedPageId,
  scrollContainerRef,
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
  const sidebarCollapsed = useEffectiveSidebarCollapsed();
  const forceCollapseLeft = useWorkspaceViewport((s) => s.forceCollapseLeft);
  const leftExpandOverride = useWorkspaceViewport((s) => s.leftExpandOverride);
  const setLeftExpandOverride = useWorkspaceViewport((s) => s.setLeftExpandOverride);
  const sidebarOverlay = forceCollapseLeft && leftExpandOverride && !sidebarCollapsed;
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [sidebarObservedWidth, setSidebarObservedWidth] = useState<number | null>(null);
  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;
  const isLocalFolder = activeNotebook?.source === "local-folder";
  // Electron 仅本地模式：没有仓库时不露出「新建页面」入口与内置本语义
  const electronNoVault = isElectronHost && !activeNotebookId;

  const itemHeight = useSidebarItemHeight() + 4;
  const rowHeight = itemHeight + 2;

  const { width, minWidth, maxWidth, isResizing, handleResizeMouseDown, handleResizePointerDown, handleResizeKeyDown } =
    useSidebarResize({
      disableResize,
      maxWidth: sidebarOverlay
        ? resolveSidebarOverlayWidth(SIDEBAR_MAX_WIDTH, viewportWidth)
        : SIDEBAR_MAX_WIDTH,
    });
  const contentWidth =
    (sidebarOverlay && sidebarObservedWidth && sidebarObservedWidth > 0
      ? sidebarObservedWidth
      : width) -
    48 -
    16;

  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<SidebarView>("pages");
  const searchShortcut = useSettings((state) =>
    state.appShortcuts.openSearch
      ? formatShortcut(state.appShortcuts.openSearch)
      : "",
  );

  // 历史模式暂时隐藏窄轨和页面树，但保留当前模式与 Footer；退出后回到原侧栏状态。
  const historyActivePageId = useHistoryView((s) => s.active);
  const exitHistoryView = useHistoryView((s) => s.exit);
  const inHistoryMode =
    !!historyActivePageId && historyActivePageId === activePageId;

  const sidebarRef = useRef<HTMLDivElement>(null);
  const restoreSidebarFocusRef = useRef(false);
  const [scrollAreaNode, setScrollAreaNode] = useState<HTMLDivElement | null>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);

  const closeSidebarOverlay = useCallback(() => {
    const active = document.activeElement;
    restoreSidebarFocusRef.current = !!active && (
      !!sidebarRef.current?.contains(active) ||
      active === sidebarRef.current?.previousElementSibling
    );
    setLeftExpandOverride(false);
  }, [setLeftExpandOverride]);

  useEffect(() => {
    if (!sidebarOverlay) return;
    const onEscape = (event: KeyboardEvent) => {
      if (!shouldDismissSidebarOverlay(event, document)) return;
      event.preventDefault();
      event.stopPropagation();
      closeSidebarOverlay();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [sidebarOverlay, closeSidebarOverlay]);

  useSidebarEffects({
    activePageId,
    activeNotebookId,
    currentView,
    onOpenSettings: () => setShowSettings(true),
  });

  const previousNotebookIdRef = useRef<string | null | undefined>(undefined);
  const resetSidebarAfterNotebookChange = useCallback(
    (options: { exitHistory: boolean }) => {
      setCurrentView("pages");
      setShowSettings(false);
      if (options.exitHistory) exitHistoryView();
    },
    [exitHistoryView],
  );

  useEffect(() => {
    const previousNotebookId = previousNotebookIdRef.current;
    previousNotebookIdRef.current = activeNotebookId;
    if (previousNotebookId === activeNotebookId) return;
    if (previousNotebookId === undefined && !isLocalFolder) return;

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
    sidebarRef.current?.style.setProperty("--sidebar-configured-width", `${width}px`);
    const shell = sidebarRef.current?.closest(".workspace-shell");
    if (!(shell instanceof HTMLElement)) return;
    shell.style.setProperty(
      "--workspace-sidebar-width",
      `${sidebarCollapsed || sidebarOverlay ? 0 : width}px`,
    );
  }, [sidebarCollapsed, sidebarOverlay, width]);

  useLayoutEffect(() => {
    if (sidebarOverlay || !restoreSidebarFocusRef.current) return;
    restoreSidebarFocusRef.current = false;
    sidebarRef.current?.closest(".workspace-shell")
      ?.querySelector<HTMLButtonElement>('button[aria-label="展开侧栏"]')
      ?.focus({ preventScroll: true });
  }, [sidebarOverlay]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === sidebar) setSidebarObservedWidth(entry.contentRect.width);
        if (entry.target === document.documentElement) setViewportWidth(window.innerWidth);
      }
    });
    observer.observe(sidebar);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!scrollAreaNode) {
      setScrollAreaHeight(0);
      return;
    }
    const updateHeight = () => {
      setScrollAreaHeight(scrollAreaNode.clientHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(scrollAreaNode);
    return () => observer.disconnect();
  }, [scrollAreaNode]);

  const handleCreatePage = () => {
    if (!activeNotebookId) return;
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

  const handleSearch = () => {
    window.dispatchEvent(new CustomEvent("goose-note:open-search"));
  };

  const switchSidebarView = (view: SidebarView) => {
    if (view === "outline") closeNotebookAiIfFullscreen();
    setCurrentView(view);
  };

  const headerTitle =
    currentView === "outline"
      ? outlinePage
        ? getPageTitle(outlinePage)
        : "大纲"
      : isLocalFolder
        ? "本地"
        : electronNoVault
          ? "仓库"
          : "页面";

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
        width: sidebarCollapsed ? 0 : width,
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
          onMouseDown={handleResizeMouseDown}
          onPointerDown={handleResizePointerDown}
          onKeyDown={handleResizeKeyDown}
        />
      )}

      <div
        className="sidebar-size-container flex h-full min-h-0 flex-col"
        style={{
          width: sidebarOverlay ? "100%" : width,
          minWidth: sidebarOverlay ? 0 : width,
        }}
      >
        <div className="flex min-h-0 flex-1">
          <div className="sidebar-rail-shell">
            <TooltipProvider delayDuration={600}>
              <nav
                className="sidebar-mode-rail"
                aria-label="侧栏视图"
                hidden={inHistoryMode}
                inert={inHistoryMode}
                aria-hidden={inHistoryMode}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sidebar-mode-rail-button"
                      aria-label="本地"
                      aria-pressed={currentView === "pages"}
                      onClick={() => switchSidebarView("pages")}
                    >
                      <LucideIcons.FolderOpen aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">本地页面</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sidebar-mode-rail-button"
                      aria-label="大纲"
                      aria-pressed={currentView === "outline"}
                      onClick={() => switchSidebarView("outline")}
                    >
                      <LucideIcons.ListTree aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">当前文档大纲</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sidebar-mode-rail-button"
                      aria-label="搜索"
                      onClick={handleSearch}
                    >
                      <LucideIcons.Search aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <span>搜索</span>
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
              isSettingsOpen={showSettings}
              onOpenSettings={() => {
                if (inHistoryMode) exitHistoryView();
                setShowSettings(true);
              }}
            />
          </div>
          <div className="sidebar-content-surface flex min-h-0 min-w-0 flex-1 flex-col">
            {inHistoryMode && (
              <div className="min-h-0 flex-1 overflow-hidden rounded-[inherit]">
                <HistoryVersionList />
              </div>
            )}
            <div
              className="sidebar-design flex min-h-0 flex-1 flex-col"
              hidden={inHistoryMode}
              inert={inHistoryMode}
              aria-hidden={inHistoryMode}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="sidebar-tree-heading shrink-0">
                    <SidebarSectionHeader
                      title={headerTitle}
                      eyebrow={currentView === "outline" ? "文档大纲" : undefined}
                      onCreate={electronNoVault ? undefined : handleCreatePage}
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
                      width={contentWidth}
                      rowHeight={rowHeight}
                      itemHeight={rowHeight}
                      viewportHeight={scrollAreaHeight}
                      onCreatePage={handleCreatePage}
                    />
                  </div>
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
        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      </div>
    </div>
  </>;
}
