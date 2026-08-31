import "./styles/index.css";
import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { type EditorRef } from "@/components/editor/core/Editor";
import { useWorkspaceEvents } from "./hooks/useWorkspaceEvents";
import { useLocalFolderWatch } from "./hooks/useLocalFolderWatch";
import { useScrollRestoration } from "./hooks/useScrollRestoration";
import { useFileDrop } from "./hooks/useFileDrop";
import { useHistoryRecorder } from "@/hooks/useHistoryRecorder";
import { getContentSignature } from "@/components/editor/utils/blocknote-content";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { isElectronRuntime } from "@/lib/electron/runtime";

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

  const editorRef = useRef<EditorRef>(null);
  useEffect(() => {
    // Electron 桌面端打 is-electron（顶栏在文档流里，安全区为 0）；其余保持 is-utools。
    const root = document.documentElement;
    root.classList.add(isElectronRuntime() ? "is-electron" : "is-utools");
    if (isElectronRuntime() && /Win/i.test(navigator.platform)) {
      root.classList.add("is-win");
    }
  }, []);

  // Hooks
  useWorkspaceEvents({ activePageId, page });
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
    <>
      <PageHistoryBinder />
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
    </>
  );
}
