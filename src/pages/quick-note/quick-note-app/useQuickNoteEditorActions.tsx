import { useCallback, useEffect, useMemo } from "react";
import {
  useQuickNote,
  buildQuickNoteDraftPage,
  getQuickNoteSlotName,
  persistQuickNoteSlotNames,
  updateQuickNoteSlotName,
  type QuickNoteSlot,
} from "@/stores/useQuickNote";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { getContentSignature } from "@/components/editor/utils/blocknote-content";
import type { useQuickNoteDraftState } from "./useQuickNoteDraftState";

export function useQuickNoteEditorActions(
  input: ReturnType<typeof useQuickNoteDraftState>,
) {
  const {
    editorRef,
    restoredContentSignatureRef,
    activeSlot,
    setActiveSlot,
    setDraftContent,
    undoDraft,
    redoDraft,
    setHistoryEpoch,
    setPreviewSlot,
    setHelpOpen,
    renamingSlot,
    setRenamingSlot,
    renameValue,
    setRenameValue,
    renameInputRef,
    renameFinishingRef,
    slotNames,
    setSlotNames,
    slotNamesRef,
    displaySlot,
  } = input;

  // 草稿内容变更：写入「当前显示的槽位」（正式 active 或 scrub 预览）。
  // 用 displaySlot 闭包锁定槽号，避免切换后旧实例尾随 onChange 串写。
  const onDraftChange = useMemo(() => {
    const boundSlot = displaySlot;
    return (content: BlockNoteContent) => {
      const signature = getContentSignature(content);
      const restored = restoredContentSignatureRef.current;
      const isRestoreSync =
        restored?.slot === boundSlot && signature === restored.signature;
      if (restored?.slot === boundSlot) {
        restoredContentSignatureRef.current = null;
      }
      setDraftContent(content as never, boundSlot, {
        recordHistory: !isRestoreSync,
      });
    };
  }, [displaySlot, setDraftContent]);

  const flushEditor = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("goose-note:flush-editor", {
        detail: { immediate: true },
      }),
    );
  }, []);

  const startRename = useCallback(
    (slot: QuickNoteSlot) => {
      flushEditor();
      renameFinishingRef.current = false;
      setHelpOpen(false);
      setRenameValue(getQuickNoteSlotName(slot, slotNames));
      setRenamingSlot(slot);
    },
    [flushEditor, slotNames],
  );

  const finishRename = useCallback(
    (save: boolean) => {
      if (renamingSlot === null || renameFinishingRef.current) return;
      renameFinishingRef.current = true;
      if (save) {
        const next = updateQuickNoteSlotName(
          slotNamesRef.current,
          renamingSlot,
          renameValue,
        );
        if (next !== slotNamesRef.current) {
          slotNamesRef.current = next;
          setSlotNames(next);
          persistQuickNoteSlotNames(next);
        }
      }
      setRenamingSlot(null);
      requestAnimationFrame(() => {
        renameFinishingRef.current = false;
        editorRef.current?.editor?.focus?.();
      });
    },
    [renameValue, renamingSlot],
  );

  useEffect(() => {
    if (renamingSlot === null) return;
    const frame = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [renamingSlot]);

  const applyHistoryContentToEditor = useCallback(
    (content: BlockNoteContent | null) => {
      restoredContentSignatureRef.current = {
        slot: useQuickNote.getState().activeSlot,
        signature: getContentSignature(
          buildQuickNoteDraftPage(content as never).content,
        ),
      };
      setHistoryEpoch((n) => n + 1);
      requestAnimationFrame(() => {
        editorRef.current?.editor?.focus?.();
      });
    },
    [],
  );

  const handleUndo = useCallback(() => {
    flushEditor();
    const result = undoDraft();
    if (!result.applied) return false;
    applyHistoryContentToEditor(result.content as BlockNoteContent | null);
    return true;
  }, [applyHistoryContentToEditor, flushEditor, undoDraft]);

  const handleRedo = useCallback(() => {
    flushEditor();
    const result = redoDraft();
    if (!result.applied) return false;
    applyHistoryContentToEditor(result.content as BlockNoteContent | null);
    return true;
  }, [applyHistoryContentToEditor, flushEditor, redoDraft]);

  const handleSwitchSlot = useCallback(
    (
      slot: QuickNoteSlot,
      source: "pointer" | "shortcut" | "switcher-keyboard",
    ) => {
      flushEditor();
      setPreviewSlot(null);
      if (slot === useQuickNote.getState().activeSlot) return;
      setActiveSlot(slot);
      if (source !== "switcher-keyboard") {
        requestAnimationFrame(() => {
          editorRef.current?.editor?.focus?.();
        });
      }
    },
    [flushEditor, setActiveSlot],
  );

  const handleHelpOpenChange = useCallback((open: boolean) => {
    setHelpOpen(open);
  }, []);
  return {
    ...input,
    onDraftChange,
    flushEditor,
    startRename,
    finishRename,
    applyHistoryContentToEditor,
    handleUndo,
    handleRedo,
    handleSwitchSlot,
    handleHelpOpenChange,
  };
}
