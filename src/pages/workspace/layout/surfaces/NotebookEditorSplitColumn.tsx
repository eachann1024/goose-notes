import { type RefObject, useLayoutEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { PageHeader } from "../../components/page/PageHeader";
import { type EditorRef } from "@/components/editor/core/Editor";
import { SplitEditorPane } from "../../components/editor-split/SplitEditorPane";
import { EditorSplitSurface } from "../../components/editor-split/EditorSplitSurface";
import { focusedPageIdOf, isSplitState } from "@/lib/editor-split/tree";
import {
  useEditorSplit,
  useEditorSplitSelector,
} from "@/stores/useEditorSplit";
import {
  permanentlyDeletePageWithCleanup,
  restorePageWithToast,
} from "@/lib/page-delete-actions";
import { NotebookAiHostScope } from "../../components/notebook-ai/NotebookAiHostScope";
import { useNotebookAiPanel } from "../../components/notebook-ai/useNotebookAiPanel";
import { isElectronChrome } from "./workspaceLayoutConfig";
import { GuardedNotebookAiPanel } from "./GuardedNotebookAiPanel";

export function NotebookEditorSplitColumn({
  page,
  activePageId,
  isLocalFolderPage,
  handleOpenSearch,
  handleBeforeActivateTab,
  aiAvailableForNotebook,
  aiPanelOpen,
  aiLayoutMode,
  toggleAiPanel,
  showSideAiPanel,
  aiNotebookId,
  editorRef,
  aiPanelCapturedSelection,
  consumeAiPanelCapturedSelection,
  setAiLayoutMode,
  closeAiPanel,
}: {
  page: NonNullable<ReturnType<typeof usePages.getState>["pages"][string]>;
  activePageId: string;
  isLocalFolderPage: boolean;
  handleOpenSearch: () => void;
  handleBeforeActivateTab?: () => void;
  aiAvailableForNotebook: boolean;
  aiPanelOpen: boolean;
  aiLayoutMode: ReturnType<typeof useNotebookAiPanel>["layoutMode"];
  toggleAiPanel: () => void;
  showSideAiPanel: boolean;
  aiNotebookId: string | null;
  editorRef: RefObject<EditorRef | null>;
  aiPanelCapturedSelection: ReturnType<
    typeof useNotebookAiPanel
  >["capturedSelection"];
  consumeAiPanelCapturedSelection: () => void;
  setAiLayoutMode: ReturnType<typeof useNotebookAiPanel>["setLayoutMode"];
  closeAiPanel: () => void;
}) {
  const { activeTabId } = useTabs(
    useShallow((s) => ({ activeTabId: s.activeTabId })),
  );
  const splitState = useEditorSplitSelector(
    (state) => (activeTabId ? (state.byTabId[activeTabId] ?? null) : null),
    Object.is,
  );
  const isSplit = splitState ? isSplitState(splitState) : false;
  const focusedPageId = splitState ? focusedPageIdOf(splitState) : null;

  useLayoutEffect(() => {
    if (!activeTabId || !activePageId) return;
    const activeTab = useTabs
      .getState()
      .openTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab || activeTab.type || activeTab.pageId !== activePageId)
      return;
    useEditorSplit.getState().ensureTab(activeTabId, activePageId);
  }, [activeTabId, activePageId]);

  useLayoutEffect(() => {
    if (!activeTabId || !focusedPageId) return;
    const activeTab = useTabs
      .getState()
      .openTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab || activeTab.type) return;
    const focusedPage = usePages.getState().getPage(focusedPageId);
    if (!focusedPage || focusedPage.isFolder || focusedPage.trashedAt) return;
    if (focusedPageId !== usePages.getState().activePageId) {
      void usePages.getState().setActivePage(focusedPageId);
    }
    useTabs.getState().syncTabPageId(activeTabId, focusedPageId);
  }, [activeTabId, focusedPageId]);

  if (!activeTabId) return null;

  return (
    <div
      className="workspace-editor-surface workspace-content-columns relative ml-0 mt-0 flex min-h-0 flex-1 flex-row gap-2 overflow-hidden"
      data-local-file-page={isLocalFolderPage ? "true" : undefined}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          !isSplit && "rounded-[12px] bg-[hsl(var(--goose-editor-bg))]",
        )}
        data-editor-split-column=""
        data-editor-split={isSplit ? "true" : undefined}
      >
        {!isElectronChrome && (
          <PageHeader
            page={page}
            onOpenSearch={handleOpenSearch}
            onBeforeActivateTab={handleBeforeActivateTab}
            onRestore={() => restorePageWithToast(activePageId)}
            onDelete={() => void permanentlyDeletePageWithCleanup(activePageId)}
            aiPanelOpen={aiAvailableForNotebook && aiPanelOpen}
            aiLayoutMode={aiLayoutMode}
            onToggleAiPanel={aiAvailableForNotebook ? toggleAiPanel : undefined}
            hideDocumentTitle={isSplit}
          />
        )}
        <div className="min-h-0 flex-1">
          <EditorSplitSurface
            tabId={activeTabId}
            renderPane={(leaf, { focused }) => (
              <SplitEditorPane
                tabId={activeTabId}
                leaf={leaf}
                focused={focused}
                showChrome={isSplit}
              />
            )}
          />
        </div>
      </div>
      {showSideAiPanel && aiNotebookId ? (
        <NotebookAiHostScope notebookId={aiNotebookId}>
          <GuardedNotebookAiPanel
            key={aiNotebookId}
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
  );
}
