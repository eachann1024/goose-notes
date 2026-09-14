import "./styles/index.css";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useWorkspaceEvents } from "./hooks/useWorkspaceEvents";
import { useLocalFolderWatch } from "./hooks/useLocalFolderWatch";
import { useFileDrop } from "./hooks/useFileDrop";
import { useHistoryRecorder } from "@/hooks/useHistoryRecorder";
import { getContentSignature } from "@/components/editor/utils/blocknote-content";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { isElectronRuntime } from "@/lib/electron/runtime";
import { bindOptionWindowDrag } from "@/lib/electron/windowDrag";
import {
  EditorPaneRegistryProvider,
  createEditorPaneRegistry,
} from "./components/editor-split/editorPaneRegistry";

function PageHistoryBinder() {
  const activePageId = usePages((s) => s.activePageId);
  const page = usePages((s) =>
    activePageId ? s.pages[activePageId] : undefined,
  );
  const historyContentSig = useMemo(
    () => (page ? getContentSignature(page.content) : ""),
    [page],
  );
  useHistoryRecorder({
    pageId: activePageId ?? null,
    workspaceId: page?.workspaceId ?? null,
    content: page?.content,
    signature: historyContentSig,
  });
  return null;
}

export function WorkspacePage() {
  const { activePageId, getPage } = usePages(useShallow((s) => ({ activePageId: s.activePageId, getPage: s.getPage })));
  const { activeNotebookId, notebooks } = useNotebooks(useShallow((s) => ({ activeNotebookId: s.activeNotebookId, notebooks: s.notebooks })));

  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = activeNotebookId ? notebooks[activeNotebookId] : undefined;

  const paneRegistry = useMemo(() => createEditorPaneRegistry(), []);
  const editorRef = paneRegistry.focusedEditorRef;
  const scrollContainerRef = paneRegistry.focusedScrollRef;
  useEffect(() => {
    // Electron 顶栏在文档流里，安全区为 0。
    const root = document.documentElement;
    root.classList.add("is-electron");
    if (isElectronRuntime() && /Win/i.test(navigator.platform)) {
      root.classList.add("is-win");
    }
    if (isElectronRuntime() && /Mac/i.test(navigator.platform)) {
      return bindOptionWindowDrag();
    }
  }, []);

  // Hooks
  useWorkspaceEvents({ activePageId, page });
  useLocalFolderWatch({ notebook, activePageId, page });

  const {
    isDragging,
    dragIntent,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useFileDrop();

  return (
    <>
      <PageHistoryBinder />
      <EditorPaneRegistryProvider value={paneRegistry}>
        <WorkspaceLayout
          isDragging={isDragging}
          dragIntent={dragIntent}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          editorRef={editorRef}
          scrollContainerRef={scrollContainerRef}
        />
      </EditorPaneRegistryProvider>
    </>
  );
}
