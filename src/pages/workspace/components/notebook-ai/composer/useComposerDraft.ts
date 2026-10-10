import { useCallback, useEffect, useRef } from "react";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
import type { JSONContent } from "@/types";
/** 草稿写盘防抖，保留顺序标记防止旧任务回写。 */
const COMPOSER_DRAFT_PERSIST_MS = 500;
export function useComposerDraft(notebookId: string) {
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSeqRef = useRef(0);
  const cancelPendingDraftPersist = useCallback(() => {
    draftSeqRef.current += 1;
    if (draftTimerRef.current != null) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingDraftPersist();
    };
  }, [cancelPendingDraftPersist]);

  const handleContentChange = useCallback(
    (content: JSONContent | null) => {
      // 防抖写 Electron：英文快打也会打到同步 dbStorage；拼音中间态已在 input 层跳过
      const seq = ++draftSeqRef.current;
      if (draftTimerRef.current != null) {
        clearTimeout(draftTimerRef.current);
      }
      draftTimerRef.current = setTimeout(() => {
        draftTimerRef.current = null;
        if (seq !== draftSeqRef.current) return;
        useNotebookAiChats.getState().setComposerDraft(notebookId, content);
      }, COMPOSER_DRAFT_PERSIST_MS);
    },
    [notebookId],
  );

  return { cancelPendingDraftPersist, handleContentChange };
}
