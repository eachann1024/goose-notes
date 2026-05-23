import "./styles/index.css";
import { useRef, useEffect, useState } from "react";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { type EditorRef } from "./components/editor/Editor";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useWorkspaceEvents } from "./hooks/useWorkspaceEvents";
import { useLocalFolderWatch } from "./hooks/useLocalFolderWatch";
import { useScrollRestoration } from "./hooks/useScrollRestoration";
import { useFileDrop } from "./hooks/useFileDrop";
import { WorkspaceLayout } from "./WorkspaceLayout";

export function WorkspacePage() {
  const { activePageId, getPage } = usePages();
  const { activeNotebookId, notebooks } = useNotebooks();

  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = activeNotebookId ? notebooks[activeNotebookId] : undefined;

  const editorRef = useRef<EditorRef>(null);
  const [isAiPageOpen, setIsAiPageOpen] = useState(false);
  const [hasOpenedAiPage, setHasOpenedAiPage] = useState(false);

  useEffect(() => {
    if (isAiPageOpen) setHasOpenedAiPage(true);
  }, [isAiPageOpen]);

  useEffect(() => {
    document.documentElement.classList.add("is-utools");
  }, []);

  // Hooks
  useGlobalShortcuts();
  useWorkspaceEvents({ activePageId, page, setIsAiPageOpen });
  useLocalFolderWatch({ notebook, activePageId, page });
  const scrollContainerRef = useScrollRestoration(activePageId);

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
      hasOpenedAiPage={hasOpenedAiPage}
      setIsAiPageOpen={setIsAiPageOpen}
      editorRef={editorRef}
      scrollContainerRef={scrollContainerRef}
    />
  );
}
