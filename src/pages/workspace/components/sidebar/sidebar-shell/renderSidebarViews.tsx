import * as GooseIcons from "@/components/ui/icons";
import { SidebarFooter } from "../SidebarFooter";
import { SidebarMainTree } from "../main-tree/SidebarMainTree";
import { SidebarSectionHeader } from "../SidebarSectionHeader";
import { SidebarOutline } from "../SidebarOutline";
import { SidebarSearch } from "../SidebarSearch";
import { HistoryVersionList } from "../../history/HistoryView";
import type { useSidebarLifecycle } from "./useSidebarLifecycle";

export function renderSidebarViews(
  context: ReturnType<typeof useSidebarLifecycle>,
) {
  const {
    className,
    selectedPageId,
    scrollContainerRef,
    settingsOpen,
    onSettingsOpenChange,
    activeNotebookId,
    outlineTarget,
    outlinePageId,
    setExpanded,
    sidebarModeRailRef,
    isLocalFolder,
    electronNoVault,
    itemHeight,
    rowHeight,
    currentView,
    setSettingsSidebarHost,
    searchShortcut,
    sidebarViewShortcut,
    exitHistoryView,
    inHistoryMode,
    setScrollAreaNode,
    scrollAreaHeight,
    handleCreatePage,
    handleOpenSearch,
    switchSidebarView,
    headerTitle,
  } = context;
  return (
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
                  <GooseIcons.FolderOpen
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  <span className="sidebar-mode-rail-label">本地</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="flex items-center gap-2">
                  <span>笔记目录</span>
                  <span className="text-[11px] text-muted-foreground">
                    {sidebarViewShortcut(1)}
                  </span>
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
                  <span>文档大纲</span>
                  <span className="text-[11px] text-muted-foreground">
                    {sidebarViewShortcut(2)}
                  </span>
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
                  <span className="text-[11px] text-muted-foreground">
                    {sidebarViewShortcut(3)}
                  </span>
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
      <div
        ref={setSettingsSidebarHost}
        className="sidebar-content-surface relative flex min-h-0 min-w-0 flex-1 flex-col"
      >
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
              <div
                className="sidebar-tree-heading shrink-0"
                hidden={currentView === "search"}
              >
                <SidebarSectionHeader
                  title={currentView === "search" ? "搜索" : headerTitle}
                  eyebrow={currentView === "outline" ? "文档大纲" : undefined}
                  onCreate={
                    currentView === "pages" && !electronNoVault
                      ? handleCreatePage
                      : undefined
                  }
                  createTitle="新建笔记"
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
  );
}
