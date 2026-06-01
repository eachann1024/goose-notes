import "./styles/index.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { type EditorRef } from "./components/editor/Editor";
import { useWorkspaceEvents } from "./hooks/useWorkspaceEvents";
import { useLocalFolderWatch } from "./hooks/useLocalFolderWatch";
import { useScrollRestoration } from "./hooks/useScrollRestoration";
import { useFileDrop } from "./hooks/useFileDrop";
import { useHistoryRecorder } from "@/hooks/useHistoryRecorder";
import { getContentSignature } from "@/components/editor/utils/blocknote-content";
import { WorkspaceLayout } from "./WorkspaceLayout";

export function WorkspacePage() {
  const { activePageId, getPage } = usePages();
  const { activeNotebookId, notebooks } = useNotebooks();

  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = activeNotebookId ? notebooks[activeNotebookId] : undefined;

  const editorRef = useRef<EditorRef>(null);
  const [isAiPageOpen, setIsAiPageOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("is-utools");
  }, []);

  // Hooks
  useWorkspaceEvents({ activePageId, page, setIsAiPageOpen });
  useLocalFolderWatch({ notebook, activePageId, page });
  const scrollContainerRef = useScrollRestoration(activePageId);

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

  const {
    isDragging,
    dragIntent,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useFileDrop();

  return (
    <WorkspaceLayout
      isDragging={isDragging}
      dragIntent={dragIntent}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      isAiPageOpen={isAiPageOpen}
      setIsAiPageOpen={setIsAiPageOpen}
      editorRef={editorRef}
      scrollContainerRef={scrollContainerRef}
    />
  );
}
