import { useCallback, useEffect, useMemo } from "react";
import { createDebounce } from "@/components/editor/utils/debounce";
import {
  clonePageContent,
  normalizePageContent,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { commitPendingEditorChange } from "./editorPendingCommit";
import { getCachedContentSignature } from "./editorContentPolicy";
import type { EditorRuntime } from "./useEditorSession";

export function useEditorContentCommit(runtime: EditorRuntime) {
  const {
    editor,
    contentModeRef,
    pageIdForUpdateRef,
    pendingEditorChangeRef,
    syncedContentSignatureRef,
    onContentChangeRef,
  } = runtime;
  const readCurrentEditorContent = useCallback(() => {
    const rawContent = clonePageContent(editor.document as BlockNoteContent);
    const isLocalPage = contentModeRef.current === "raw";
    const content = isLocalPage ? rawContent : normalizePageContent(rawContent);
    return {
      content,
      signature: getCachedContentSignature(content),
    };
  }, [editor]);

  const debouncedUpdate = useMemo(() => {
    return createDebounce(
      (targetPageId: string) => {
        if (targetPageId !== pageIdForUpdateRef.current) return;
        const { content, signature } = readCurrentEditorContent();
        pendingEditorChangeRef.current = false;
        if (signature === syncedContentSignatureRef.current) return;
        syncedContentSignatureRef.current = signature;
        onContentChangeRef.current(content);
      },
      800,
      { maxWait: 3000 },
    );
  }, [readCurrentEditorContent]);

  const commitEditorContent = useCallback(
    (targetPageId?: string) => {
      const safePageId = targetPageId ?? pageIdForUpdateRef.current;
      if (!safePageId) return;
      debouncedUpdate.cancel();
      if (
        safePageId !== pageIdForUpdateRef.current ||
        !pendingEditorChangeRef.current
      )
        return;
      const { content, signature } = readCurrentEditorContent();
      const result = commitPendingEditorChange({
        targetPageId: safePageId,
        currentPageId: pageIdForUpdateRef.current,
        pending: pendingEditorChangeRef.current,
        content,
        signature,
        syncedSignature: syncedContentSignatureRef.current,
        commit: (nextContent) => onContentChangeRef.current(nextContent),
      });
      if (result === "committed" || result === "unchanged") {
        pendingEditorChangeRef.current = false;
      }
      if (result === "committed") syncedContentSignatureRef.current = signature;
    },
    [debouncedUpdate, readCurrentEditorContent],
  );

  useEffect(() => {
    return () => {
      // React 卸载仍处于同步阶段；先把最后一帧送入 store/journal，再取消定时器。
      commitEditorContent(pageIdForUpdateRef.current ?? undefined);
    };
  }, [commitEditorContent]);

  return { debouncedUpdate, commitEditorContent };
}
export type EditorContentCommit = ReturnType<typeof useEditorContentCommit>;
