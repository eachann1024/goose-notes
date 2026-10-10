import { useCallback, useEffect } from "react";
import {
  useQuickNote,
  getActiveDraftContent,
  isQuickNoteDraftEmpty,
  type QuickNoteSlot,
} from "@/stores/useQuickNote";
import { toast } from "@/components/ui/sonner";
import { useNotebooks } from "@/stores/useNotebooks";
import { quickNoteWindow } from "@/lib/electron/quickNoteWindow";
import type { useQuickNoteEditorActions } from "./useQuickNoteEditorActions";

export function useQuickNoteSaveActions(
  input: ReturnType<typeof useQuickNoteEditorActions>,
) {
  const {
    editorRef,
    setWindowPosition,
    setPreviewSlot,
    savingToNote,
    setSavingToNote,
    flushEditor,
    applyHistoryContentToEditor,
  } = input;

  const handleSaveToNote = useCallback(async () => {
    if (savingToNote) return;
    flushEditor();
    if (isQuickNoteDraftEmpty(getActiveDraftContent(useQuickNote.getState()))) {
      return;
    }
    setSavingToNote(true);
    try {
      await useNotebooks.persist.rehydrate();
      const id = await useQuickNote.getState().saveDraftToNotebook();
      if (!id) {
        toast.error("未能保存到笔记", {
          description: "请确认已打开笔记本后再试。",
        });
        return;
      }
      applyHistoryContentToEditor(null);
      toast.success("已保存到笔记");
    } finally {
      setSavingToNote(false);
    }
  }, [applyHistoryContentToEditor, flushEditor, savingToNote]);

  /** 拖动预览：只改显示槽，不写 activeSlot。 */
  const handlePreviewSlot = useCallback(
    (slot: QuickNoteSlot | null) => {
      flushEditor();
      setPreviewSlot(slot);
    },
    [flushEditor],
  );

  /** 关窗 / 收起前把当前位置写进 store + preload，保证下次 Electron 唤起仍在原处。 */
  const persistPlacementThenClose = useCallback(() => {
    flushEditor();
    const x = window.screenX;
    const y = window.screenY;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      setWindowPosition(x, y);
      quickNoteWindow.persistPosition(x, y);
    }
    quickNoteWindow.close();
  }, [flushEditor, setWindowPosition]);

  // 首帧：聚焦光标到编辑器。
  useEffect(() => {
    requestAnimationFrame(() => editorRef.current?.editor?.focus?.());
  }, []);

  // 复用窗口：父窗以「速记」再次唤起已存在的小窗时（preload 发 quicknote:enter），
  // 重新聚焦即可（草稿延续，不重解析笔记）。
  useEffect(() => {
    const handler = () => {
      requestAnimationFrame(() => editorRef.current?.editor?.focus?.());
    };
    window.addEventListener("goose-note:quicknote-enter", handler);
    return () =>
      window.removeEventListener("goose-note:quicknote-enter", handler);
  }, []);
  return {
    ...input,
    handleSaveToNote,
    handlePreviewSlot,
    persistPlacementThenClose,
  };
}
