import * as GooseIcons from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { SearchSessionController } from "../components/sidebar/SearchSessionController";
import { Sidebar } from "../components/sidebar/Sidebar";
import { DesktopTitleBar } from "../components/page/DesktopTitleBar";
import { LocalFolderTargetPicker } from "../components/sidebar/LocalFolderTargetPicker";
import { AIFeatureNotice } from "../components/AIFeatureNotice";
import {
  permanentlyDeletePageWithCleanup,
  restorePageWithToast,
} from "@/lib/page-delete-actions";
import { NotebookAiSessionProvider } from "../components/notebook-ai/NotebookAiSession";
import type { useWorkspaceScrollSync } from "./useWorkspaceScrollSync";
import { isElectronChrome, NotebookAiWorkspaceBody } from "./shared";

export function renderWorkspaceShell(
  context: ReturnType<typeof useWorkspaceScrollSync>,
) {
  const {
    isDragging,
    dragIntent,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    editorRef,
    scrollContainerRef,
    activePageId,
    isLocked,
    isTrashed,
    openNewTab,
    isWelcomeTab,
    openNewTabHandler,
    aiPanelOpen,
    aiLayoutMode,
    setAiLayoutMode,
    toggleAiPanel,
    closeAiPanel,
    aiPanelCapturedSelection,
    consumeAiPanelCapturedSelection,
    showSideAiPanel,
    showFullscreenAi,
    singleTabMode,
    inHistoryMode,
    showElectronLocalImportHint,
    page,
    isLocalFolderPage,
    aiAvailableForNotebook,
    aiNotebookId,
    settingsOpen,
    settingsSidebarExpanded,
    setSettingsSidebarExpanded,
    effectiveSidebarCollapsed,
    settingsTab,
    setSettingsTab,
    settingsHost,
    setSettingsHost,
    editorHostRef,
    closeSettings,
    handleSettingsOpenChange,
    handleToggleAiPanel,
  } = context;
  return (
    <>
      <div
        className="workspace-shell window-shell-safe-top flex overflow-hidden bg-background text-foreground"
        data-electron-chrome={isElectronChrome || undefined}
        data-settings={settingsOpen || undefined}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isElectronChrome && (
          <DesktopTitleBar
            page={settingsOpen ? undefined : page}
            isWelcomeTab={isWelcomeTab}
            inHistoryMode={!settingsOpen && inHistoryMode}
            settingsOpen={settingsOpen}
            sidebarCollapsedOverride={effectiveSidebarCollapsed}
            onToggleSidebar={
              settingsOpen
                ? () => setSettingsSidebarExpanded((expanded) => !expanded)
                : undefined
            }
            onOpenSearch={() => {
              closeSettings();
              if (showFullscreenAi) closeAiPanel();
              openNewTab();
            }}
            onBeforeActivateTab={() => {
              closeSettings();
              if (showFullscreenAi) closeAiPanel();
            }}
            onRestore={
              activePageId
                ? () => restorePageWithToast(activePageId)
                : undefined
            }
            onDelete={
              activePageId
                ? () => void permanentlyDeletePageWithCleanup(activePageId)
                : undefined
            }
            aiPanelOpen={!settingsOpen && (showFullscreenAi || showSideAiPanel)}
            aiLayoutMode={aiLayoutMode}
            onToggleAiPanel={
              aiAvailableForNotebook ? handleToggleAiPanel : undefined
            }
          />
        )}
        {isDragging && (
          <div className="fixed inset-0 z-[25000] flex items-center justify-center bg-[hsl(var(--goose-editor-bg)/0.96)] animate-in fade-in duration-150">
            <div className="flex min-h-[188px] min-w-[312px] flex-col items-center justify-center rounded-[14px] border border-border/70 bg-[hsl(var(--goose-shell-bg)/0.98)] px-10 py-8 text-center shadow-[0_18px_42px_rgba(15,23,42,0.12),0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_18px_42px_rgba(0,0,0,0.32)]">
              {dragIntent === "folder" ? (
                <GooseIcons.FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
              ) : dragIntent === "text-file" ? (
                <GooseIcons.FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              ) : (
                <GooseIcons.FileQuestion className="mb-4 h-12 w-12 text-muted-foreground" />
              )}
              <p className="text-base font-medium text-foreground">
                {dragIntent === "folder"
                  ? "松手打开文件夹"
                  : dragIntent === "text-file"
                    ? showElectronLocalImportHint
                      ? "松开以导入到当前文件夹 · 按住 ⌥ 选择位置"
                      : "松手导入文本文件"
                    : "松手后检查文件"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {dragIntent === "folder"
                  ? "会作为本地文件夹笔记本载入"
                  : "支持 .md、.markdown、.txt"}
              </p>
            </div>
          </div>
        )}
        <SearchSessionController />
        <LocalFolderTargetPicker />
        <AIFeatureNotice />
        <div className="workspace-stage">
          <div
            className="workspace-content-frame pointer-events-none rounded-lg shadow-md"
            aria-hidden="true"
          />
          <Sidebar
            className="workspace-sidebar-pane"
            disableResize={false}
            selectedPageId={showFullscreenAi ? null : activePageId}
            scrollContainerRef={scrollContainerRef}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={handleSettingsOpenChange}
            settingsSidebarExpanded={settingsSidebarExpanded}
            onSettingsSidebarExpandedChange={setSettingsSidebarExpanded}
            settingsTab={settingsTab}
            onSettingsTabChange={setSettingsTab}
            settingsMainHost={settingsHost}
          />

          <main
            ref={setSettingsHost}
            className="workspace-main-sheet relative flex-1 flex flex-col h-full overflow-hidden"
            data-single-tab-mode={singleTabMode ? "true" : undefined}
            data-local-file-page={isLocalFolderPage ? "true" : undefined}
          >
            <div
              ref={editorHostRef}
              className={cn(
                "workspace-editor-host relative flex min-h-0 flex-1 flex-col overflow-hidden",
                settingsOpen && "invisible",
              )}
            >
              {/*
                会话运行时与面板 UI 解耦：Provider 在 AI 可用时常驻，
                关面板 / 切页不卸载 useChat，顶栏动画可跟到请求真正结束。
              */}
              {aiAvailableForNotebook && aiNotebookId ? (
                <NotebookAiSessionProvider
                  notebookId={aiNotebookId}
                  editorRef={editorRef}
                >
                  <NotebookAiWorkspaceBody
                    showFullscreenAi={showFullscreenAi}
                    aiNotebookId={aiNotebookId}
                    aiAvailableForNotebook={aiAvailableForNotebook}
                    isWelcomeTab={isWelcomeTab}
                    openNewTabHandler={openNewTabHandler}
                    aiPanelOpen={showFullscreenAi || showSideAiPanel}
                    aiLayoutMode={aiLayoutMode}
                    toggleAiPanel={handleToggleAiPanel}
                    showSideAiPanel={showSideAiPanel}
                    closeAiPanel={closeAiPanel}
                    editorRef={editorRef}
                    aiPanelCapturedSelection={aiPanelCapturedSelection}
                    consumeAiPanelCapturedSelection={
                      consumeAiPanelCapturedSelection
                    }
                    setAiLayoutMode={setAiLayoutMode}
                    activePageId={activePageId}
                    page={page}
                    inHistoryMode={inHistoryMode}
                    isLocalFolderPage={isLocalFolderPage}
                    isLocked={isLocked}
                    isTrashed={isTrashed}
                    scrollContainerRef={scrollContainerRef}
                  />
                </NotebookAiSessionProvider>
              ) : (
                <NotebookAiWorkspaceBody
                  showFullscreenAi={false}
                  aiNotebookId={null}
                  aiAvailableForNotebook={false}
                  isWelcomeTab={isWelcomeTab}
                  openNewTabHandler={openNewTabHandler}
                  aiPanelOpen={false}
                  aiLayoutMode={aiLayoutMode}
                  toggleAiPanel={handleToggleAiPanel}
                  showSideAiPanel={false}
                  closeAiPanel={closeAiPanel}
                  editorRef={editorRef}
                  aiPanelCapturedSelection={null}
                  consumeAiPanelCapturedSelection={
                    consumeAiPanelCapturedSelection
                  }
                  setAiLayoutMode={setAiLayoutMode}
                  activePageId={activePageId}
                  page={page}
                  inHistoryMode={inHistoryMode}
                  isLocalFolderPage={isLocalFolderPage}
                  isLocked={isLocked}
                  isTrashed={isTrashed}
                  scrollContainerRef={scrollContainerRef}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
