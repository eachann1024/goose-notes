import {
  useBlockNoteEditor,
  useEditorState,
  useExtension,
} from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GooseAIExtension } from "@/components/editor/ai/GooseAIExtension";
import {
  useEditorPageContext,
  useEditorSettings,
} from "@/components/editor/platform/hostContext";
import { useContextMenu } from "@/components/editor/state/contextMenu";
import { useGlobalScrollActivity } from "@/components/editor/hooks/useGlobalScrollActivity";
import { useFormattingToolbarAi } from "@/components/editor/state/formattingToolbarAi";
import { useFormattingToolbarHold } from "@/components/editor/state/formattingToolbarHold";
import {
  applySelectionTextAlignment,
  clearSelectionFormatting,
  getFormattingToolbarCapabilities,
  selectionDisallowsFormattingToolbar,
  selectionIsInsideFirstTitleBlock,
  selectionIsInsideHeadingBlock,
  shouldRenderFormattingToolbar,
  useSelectionMarkStates,
} from "./helpers";
import type { BindTooltip } from "./ToolbarTooltip";
import { getListTypeToolbarState } from "./listType";
import { getSelectedImageUrl } from "@/components/editor/utils/selection";
import { isQuickNoteEditorPage } from "@/pages/workspace/components/editor-host/editorContentMode";
import { useFormattingToolbarAiActivate } from "./useFormattingToolbarAiActivate";

export function useFormattingToolbarState() {
  const editor = useBlockNoteEditor();
  // 未启用 AI 的构建跳过 useExtension；编译期分支在同一构建内保持稳定。

  const aiExtension = __GOOSE_EDITOR_AI__
    ? useExtension(GooseAIExtension)
    : undefined;
  const { ai: aiSettings } = useEditorSettings();
  const { contentMode, page } = useEditorPageContext();
  const protectsFirstTitle = contentMode === "normalized";
  // Electron 桌面端与主窗共用构建，COMPACT / LITE 恒为 false，必须看运行时草稿页。
  const isQuickNoteSurface =
    __GOOSE_EDITOR_COMPACT__ || __GOOSE_LITE__ || isQuickNoteEditorPage(page);
  const markStates = useSelectionMarkStates(editor);

  const selectionState = useEditorState({
    editor,
    selector: ({ editor }) => {
      const { selection, doc } = editor.prosemirrorState;

      const selectedText = doc
        .textBetween(selection.from, selection.to, "\n", "\n")
        .trim();
      let quoteText: string;
      try {
        quoteText = (editor.getSelectedText() ?? "").trim();
      } catch {
        quoteText = selectedText;
      }

      return {
        hasTextSelection:
          (!selection.empty && selectedText.length > 0) ||
          shouldRenderFormattingToolbar(editor),
        disallowsFormattingToolbar: selectionDisallowsFormattingToolbar(editor),
        selectedQuoteText: quoteText,
        isImageNodeSelection:
          getSelectedImageUrl(editor.prosemirrorState) != null,
      };
    },
  });

  // 仅 normalized 文档把物理首块 H1 视为受保护的页面标题。
  const isInTitleOne = useEditorState({
    editor,
    selector: ({ editor }) =>
      protectsFirstTitle && selectionIsInsideFirstTitleBlock(editor),
  });

  const caps = useEditorState({
    editor,
    selector: ({ editor }) =>
      getFormattingToolbarCapabilities(editor, {
        isInHeading: selectionIsInsideHeadingBlock(editor),
      }),
  });

  const holdDuringPointerSelect = useFormattingToolbarHold();
  const aiActive = useFormattingToolbarAi(
    (s) => s.active && s.owner === editor,
  );
  const activateFormattingToolbarAi = useFormattingToolbarAi(
    (state) => state.activate,
  );
  const resetFormattingToolbarAi = useFormattingToolbarAi(
    (state) => state.reset,
  );

  const openMenuId = useContextMenu((state) => state.openMenuId);
  const isContextMenuOpen = Boolean(openMenuId);
  const scrollActivity = useGlobalScrollActivity({ idleMs: 120 });
  const isScrolling = scrollActivity.isScrolling;

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const bindTooltip = useCallback<BindTooltip>(
    (id) => ({
      delayDuration: 400,
      open: activeTooltip === id,
      onOpenChange: (open) =>
        setActiveTooltip((prev) => (open ? id : prev === id ? null : prev)),
    }),
    [activeTooltip],
  );

  useEffect(() => {
    if (!menuRef.current) return;
    menuRef.current.style.zIndex = "20000";
  }, []);

  useEffect(() => {
    if (!isScrolling && !isContextMenuOpen) return;
    setActiveTooltip(null);
  }, [isScrolling, isContextMenuOpen]);

  const handleAiActivate = useFormattingToolbarAiActivate({
    editor,
    aiSettings,
    aiExtension,
    activateFormattingToolbarAi,
    resetFormattingToolbarAi,
    setActiveTooltip,
  });

  const isBold = markStates.bold;
  const isItalic = markStates.italic;
  const isStrike = markStates.strike;
  const isUnderline = markStates.underline;
  const isCode = markStates.code;

  const textAlignment = caps.textAlignment;
  const listState = useEditorState({
    editor,
    selector: ({ editor }) => getListTypeToolbarState(editor),
  });

  const linkUrl = caps.showLink ? editor.getSelectedLinkUrl() : undefined;
  const isLinkActive = !!linkUrl;

  const setTextAlignment = useCallback(
    (alignment: "left" | "center" | "right") => {
      applySelectionTextAlignment(editor, alignment);
    },
    [editor],
  );

  const clearFormatting = useCallback(() => {
    clearSelectionFormatting(editor);
  }, [editor]);

  // 小窗的格式栏是固定底栏，滚动不会遮挡选区，也不应闪烁隐藏；
  // 常规笔记本的浮动栏仍在滚动时收起，避免与正文一起漂移。
  const shouldHideForScroll =
    (!isQuickNoteSurface && isScrolling) || isContextMenuOpen;
  // While AI is active we keep the toolbar visible regardless of scroll/menu.
  const shouldHide = !aiActive && !colorPickerOpen && shouldHideForScroll;

  const visible =
    editor.isEditable &&
    (aiActive ||
      colorPickerOpen ||
      holdDuringPointerSelect ||
      (selectionState.hasTextSelection &&
        !selectionState.disallowsFormattingToolbar &&
        !isInTitleOne));

  return {
    visible,
    editor,
    aiSettings,
    page,
    isQuickNoteSurface,
    selectionState,
    caps,
    aiActive,
    bindTooltip,
    menuRef,
    handleAiActivate,
    isBold,
    isItalic,
    isStrike,
    isUnderline,
    isCode,
    textAlignment,
    listState,
    linkUrl,
    isLinkActive,
    setTextAlignment,
    clearFormatting,
    shouldHide,
    setColorPickerOpen,
  };
}
