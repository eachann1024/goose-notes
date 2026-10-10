import { useEffect, useMemo, useRef, useState } from "react";
import {
  useQuickNote,
  buildQuickNoteDraftPage,
  getQuickNoteSlotName,
  loadQuickNoteSlotNames,
  QUICKNOTE_SLOTS,
  isQuickNoteDraftEmpty,
  type QuickNoteSlot,
} from "@/stores/useQuickNote";
import { type EditorRef } from "@/components/editor/core/Editor";
import { formatShortcut, getPlatformKind } from "@/lib/utils";
import { getQuickNoteCollectVariant } from "../quickNoteCollectDetector";
import { useSettings } from "@/stores/settings";
import {
  computeEditorUiScale,
  EDITOR_UI_SCALE_CHANGE_EVENT,
} from "@/lib/appearance";

export function useQuickNoteDraftState() {
  const editorRef = useRef<EditorRef>(null);

  const collectVariant = useMemo(
    () => getQuickNoteCollectVariant(window.location.search),
    [],
  );

  /** 撤销/重做重挂编辑器后，只静默一次同一槽位且与恢复内容签名一致的初始化同步。 */
  const restoredContentSignatureRef = useRef<{
    slot: QuickNoteSlot;
    signature: string;
  } | null>(null);

  const activeSlot = useQuickNote((s) => s.activeSlot);

  const drafts = useQuickNote((s) => s.drafts);

  const setActiveSlot = useQuickNote((s) => s.setActiveSlot);

  const setDraftContent = useQuickNote((s) => s.setDraftContent);

  const undoDraft = useQuickNote((s) => s.undoDraft);

  const redoDraft = useQuickNote((s) => s.redoDraft);

  const setWindowSize = useQuickNote((s) => s.setWindowSize);

  const setWindowPosition = useQuickNote((s) => s.setWindowPosition);

  const setEditorZoom = useQuickNote((s) => s.setEditorZoom);

  // 编辑界面缩放（持久化：下次开窗沿用上次 Cmd +/- 的程度）。
  const zoom = useQuickNote((s) => s.editorZoom);

  const editorFontSize = useSettings((s) => s.editorFontSize);

  const editorLineHeight = useSettings((s) => s.editorLineHeight);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--editor-line-height",
      String(editorLineHeight),
    );
  }, [editorLineHeight]);

  // 速记运行在独立 WebView：全局编辑字号与小窗局部缩放共同决定工具条等
  // 编辑器 UI 的有效尺寸。卸载时不清理，避免复用窗口期间退回错误的默认值。
  useEffect(() => {
    const root = document.documentElement;
    const scale = computeEditorUiScale(editorFontSize, zoom);
    if (root.style.getPropertyValue("--editor-ui-scale") === scale) return;
    root.style.setProperty("--editor-ui-scale", scale);
    window.dispatchEvent(
      new CustomEvent(EDITOR_UI_SCALE_CHANGE_EVENT, {
        detail: { scale },
      }),
    );
  }, [editorFontSize, zoom]);

  /**
   * 撤销/重做后递增，迫使 EditorHostBridge 用最新 drafts 重建。
   * 仅依赖 activeSlot 时，关窗重开后的持久化撤销无法驱动编辑器刷新。
   */
  const [historyEpoch, setHistoryEpoch] = useState(0);

  /**
   * 按住 1–5 拖动时的临时预览槽；null 表示未在 scrub。
   * 编辑器显示 previewSlot ?? activeSlot，松手/移走后由 onChange 正式写入 activeSlot。
   */
  const [previewSlot, setPreviewSlot] = useState<QuickNoteSlot | null>(null);

  const [helpOpen, setHelpOpen] = useState(false);

  const [savingToNote, setSavingToNote] = useState(false);

  const [renamingSlot, setRenamingSlot] = useState<QuickNoteSlot | null>(null);

  const [renameValue, setRenameValue] = useState("");

  const renameInputRef = useRef<HTMLInputElement>(null);

  const renameFinishingRef = useRef(false);

  const [slotNames, setSlotNames] = useState(() =>
    loadQuickNoteSlotNames(useQuickNote.getState().slotNames),
  );

  const slotNamesRef = useRef(slotNames);

  const helpShortcuts = useMemo(() => {
    const platform = getPlatformKind();
    return {
      switchSlots: formatShortcut("Mod+1–5", platform),
      alternateSwitchSlots:
        platform === "windows" ? formatShortcut("Alt+1–5", platform) : null,
      zoomIn: formatShortcut("Mod+Plus", platform),
      zoomOut: formatShortcut("Mod+-", platform),
      zoomReset: formatShortcut("Mod+0", platform),
      undo: formatShortcut("Mod+Z", platform),
      redo: formatShortcut("Mod+Shift+Z", platform),
      alternateRedo: formatShortcut("Mod+Y", platform),
    };
  }, []);

  const displaySlot = previewSlot ?? activeSlot;

  const displaySlotName = getQuickNoteSlotName(displaySlot, slotNames);

  const occupiedSlots = useMemo(
    () =>
      Object.fromEntries(
        QUICKNOTE_SLOTS.map((slot) => [
          slot,
          !isQuickNoteDraftEmpty(drafts[slot] ?? null),
        ]),
      ) as Record<QuickNoteSlot, boolean>,
    [drafts],
  );

  // 草稿 page：基于显示槽位草稿现造。仅随 displaySlot / 历史恢复重建，
  // 避免编辑 onChange 回灌打断输入。预览拖动时只换显示、不改 activeSlot。
  const draftPage = useMemo(
    () => buildQuickNoteDraftPage(drafts[displaySlot] ?? null),
    // 有意不依赖 drafts 的每次击键：槽位内容变更由编辑器内部维护。
    // historyEpoch 仅在撤销/重做后变化。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displaySlot, historyEpoch],
  );

  // resize 抖动抑制：拖动边框期间标记，停下再持久化尺寸（见下方 resize effect）。
  const isResizingRef = useRef(false);

  const resizeSettleTimerRef = useRef<number | null>(null);
  return {
    editorRef,
    collectVariant,
    restoredContentSignatureRef,
    activeSlot,
    drafts,
    setActiveSlot,
    setDraftContent,
    undoDraft,
    redoDraft,
    setWindowSize,
    setWindowPosition,
    setEditorZoom,
    zoom,
    editorFontSize,
    editorLineHeight,
    historyEpoch,
    setHistoryEpoch,
    previewSlot,
    setPreviewSlot,
    helpOpen,
    setHelpOpen,
    savingToNote,
    setSavingToNote,
    renamingSlot,
    setRenamingSlot,
    renameValue,
    setRenameValue,
    renameInputRef,
    renameFinishingRef,
    slotNames,
    setSlotNames,
    slotNamesRef,
    helpShortcuts,
    displaySlot,
    displaySlotName,
    occupiedSlots,
    draftPage,
    isResizingRef,
    resizeSettleTimerRef,
  };
}
