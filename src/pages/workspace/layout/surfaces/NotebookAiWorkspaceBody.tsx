import { type RefObject } from "react";
import { cn } from "@/lib/utils";
import { usePages } from "@/stores/usePages";
import { PageEmptyState } from "../../components/page/PageEmptyState";
import { FolderHomePage } from "../../components/page/FolderHomePage";
import { PageHeader } from "../../components/page/PageHeader";
import { type EditorRef } from "@/components/editor/core/Editor";
import {
  HistoryToolbar,
  HistoryReader,
} from "../../components/history/HistoryView";
import {
  permanentlyDeletePageWithCleanup,
  restorePageWithToast,
} from "@/lib/page-delete-actions";
import { NotebookAiHostScope } from "../../components/notebook-ai/NotebookAiHostScope";
import { useNotebookAiPanel } from "../../components/notebook-ai/useNotebookAiPanel";
import { isElectronChrome } from "./workspaceLayoutConfig";
import { GuardedNotebookAiPanel } from "./GuardedNotebookAiPanel";
import { NotebookEditorSplitColumn } from "./NotebookEditorSplitColumn";

export /** 主内容区 + 条件挂载的 AI 面板 UI（运行时在外层 Provider）。 */
function NotebookAiWorkspaceBody({
  showFullscreenAi,
  aiNotebookId,
  aiAvailableForNotebook,
  isWelcomeTab,
  openNewTabHandler,
  aiPanelOpen,
  aiLayoutMode,
  toggleAiPanel,
  showSideAiPanel,
  closeAiPanel,
  editorRef,
  aiPanelCapturedSelection,
  consumeAiPanelCapturedSelection,
  setAiLayoutMode,
  activePageId,
  page,
  inHistoryMode,
  isLocalFolderPage,
  isLocked: _isLocked,
  isTrashed: _isTrashed,
  scrollContainerRef: _scrollContainerRef,
}: {
  showFullscreenAi: boolean;
  aiNotebookId: string | null;
  aiAvailableForNotebook: boolean;
  isWelcomeTab: boolean;
  openNewTabHandler: () => void;
  aiPanelOpen: boolean;
  aiLayoutMode: ReturnType<typeof useNotebookAiPanel>["layoutMode"];
  toggleAiPanel: () => void;
  showSideAiPanel: boolean;
  closeAiPanel: () => void;
  editorRef: RefObject<EditorRef | null>;
  aiPanelCapturedSelection: ReturnType<
    typeof useNotebookAiPanel
  >["capturedSelection"];
  consumeAiPanelCapturedSelection: () => void;
  setAiLayoutMode: ReturnType<typeof useNotebookAiPanel>["setLayoutMode"];
  activePageId: string | null | undefined;
  page: ReturnType<typeof usePages.getState>["pages"][string] | undefined;
  inHistoryMode: boolean;
  isLocalFolderPage: boolean;
  isLocked: boolean;
  isTrashed: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const handleOpenSearch = showFullscreenAi
    ? () => {
        closeAiPanel();
        openNewTabHandler();
      }
    : openNewTabHandler;
  const handleBeforeActivateTab = showFullscreenAi ? closeAiPanel : undefined;
  const hideFolderHome =
    isElectronChrome && Boolean(page?.isFolder) && isLocalFolderPage;

  return (
    <>
      {/*
              全屏 AI 叠在页头下方，不重挂页头。正文 invisible/inert 推迟到下一帧，
              避免点击帧对 BlockNote 大树做 visibility 强制布局。
            */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isWelcomeTab ? (
          <>
            {!isElectronChrome && (
              <PageHeader
                onOpenSearch={handleOpenSearch}
                onBeforeActivateTab={handleBeforeActivateTab}
                aiPanelOpen={aiAvailableForNotebook && aiPanelOpen}
                aiLayoutMode={aiLayoutMode}
                onToggleAiPanel={
                  aiAvailableForNotebook ? toggleAiPanel : undefined
                }
              />
            )}
            <div className="workspace-content-columns relative ml-0 mt-0 flex min-h-0 flex-1 flex-row gap-2 overflow-hidden">
              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-[hsl(var(--goose-editor-bg))]",
                )}
              >
                <PageEmptyState />
              </div>
              {showSideAiPanel && aiNotebookId ? (
                <NotebookAiHostScope notebookId={aiNotebookId}>
                  <GuardedNotebookAiPanel
                    key={`welcome-${aiNotebookId}`}
                    notebookId={aiNotebookId}
                    onClose={closeAiPanel}
                    editorRef={editorRef}
                    capturedSelection={aiPanelCapturedSelection}
                    onConsumeCapturedSelection={consumeAiPanelCapturedSelection}
                    layoutMode={aiLayoutMode}
                    onLayoutModeChange={setAiLayoutMode}
                    variant="side-panel"
                  />
                </NotebookAiHostScope>
              ) : null}
            </div>
          </>
        ) : activePageId && page && inHistoryMode ? (
          <>
            {!isElectronChrome && <HistoryToolbar />}
            <div className="workspace-editor-surface relative ml-0 mt-0 flex-1 min-h-0 overflow-hidden">
              <div
                className={cn(
                  "h-full overflow-y-auto page-scroll-container bg-[hsl(var(--goose-editor-bg))]",
                )}
              >
                <div className="flex min-h-full flex-col px-14 pt-0">
                  <HistoryReader />
                </div>
              </div>
            </div>
          </>
        ) : activePageId && page && !hideFolderHome ? (
          page.isFolder && isLocalFolderPage ? (
            /* Electron 本地文件夹目录页：主区渲染 FolderHomePage，不挂编辑器 */
            <>
              <div className="workspace-editor-surface workspace-content-columns relative ml-0 mt-0 flex min-h-0 flex-1 flex-row gap-2 overflow-hidden">
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-[hsl(var(--goose-editor-bg))]">
                  {!isElectronChrome && (
                    <PageHeader
                      page={page}
                      onOpenSearch={handleOpenSearch}
                      onBeforeActivateTab={handleBeforeActivateTab}
                      onRestore={() => restorePageWithToast(activePageId)}
                      onDelete={() =>
                        void permanentlyDeletePageWithCleanup(activePageId)
                      }
                      aiPanelOpen={aiAvailableForNotebook && aiPanelOpen}
                      aiLayoutMode={aiLayoutMode}
                      onToggleAiPanel={
                        aiAvailableForNotebook ? toggleAiPanel : undefined
                      }
                    />
                  )}
                  <FolderHomePage page={page} />
                </div>
                {showSideAiPanel && aiNotebookId ? (
                  <NotebookAiHostScope notebookId={aiNotebookId}>
                    <GuardedNotebookAiPanel
                      key={`folder-${aiNotebookId}`}
                      notebookId={aiNotebookId}
                      onClose={closeAiPanel}
                      editorRef={editorRef}
                      capturedSelection={aiPanelCapturedSelection}
                      onConsumeCapturedSelection={
                        consumeAiPanelCapturedSelection
                      }
                      layoutMode={aiLayoutMode}
                      onLayoutModeChange={setAiLayoutMode}
                      variant="side-panel"
                    />
                  </NotebookAiHostScope>
                ) : null}
              </div>
            </>
          ) : (
            <NotebookEditorSplitColumn
              page={page}
              activePageId={activePageId}
              isLocalFolderPage={isLocalFolderPage}
              handleOpenSearch={handleOpenSearch}
              handleBeforeActivateTab={handleBeforeActivateTab}
              aiAvailableForNotebook={aiAvailableForNotebook}
              aiPanelOpen={aiPanelOpen}
              aiLayoutMode={aiLayoutMode}
              toggleAiPanel={toggleAiPanel}
              showSideAiPanel={showSideAiPanel}
              aiNotebookId={aiNotebookId}
              editorRef={editorRef}
              aiPanelCapturedSelection={aiPanelCapturedSelection}
              consumeAiPanelCapturedSelection={consumeAiPanelCapturedSelection}
              setAiLayoutMode={setAiLayoutMode}
              closeAiPanel={closeAiPanel}
            />
          )
        ) : (
          <PageEmptyState />
        )}
      </div>

      {showFullscreenAi && aiNotebookId && aiAvailableForNotebook ? (
        <div className="notebook-ai-fullscreen-host absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden">
          <NotebookAiHostScope notebookId={aiNotebookId}>
            <GuardedNotebookAiPanel
              key={`fullscreen-${aiNotebookId}`}
              notebookId={aiNotebookId}
              onClose={closeAiPanel}
              editorRef={editorRef}
              capturedSelection={aiPanelCapturedSelection}
              onConsumeCapturedSelection={consumeAiPanelCapturedSelection}
              layoutMode={aiLayoutMode}
              onLayoutModeChange={setAiLayoutMode}
              variant="fullscreen"
            />
          </NotebookAiHostScope>
        </div>
      ) : null}
    </>
  );
}
