import { useCallback, useEffect, useRef, useState } from "react";
import { isWorkspaceSettingsOpen } from "@/lib/settings-navigation";
import { GooseAIExtension } from "@/components/editor/ai/GooseAIExtension";
import { readEditorFindSeed } from "@/components/editor/find/findSeed";
import {
  isLinkShortcutClaimedByApp,
  isPrimaryLinkShortcutEvent,
} from "@/components/editor/extensions/linkKeyboardExtension";
import { closeAllOverlays } from "@/lib/closeAllOverlays";
import { matchShortcut } from "@/lib/shortcut-match";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { getSelectedImageUrl } from "@/components/editor/utils/selection";
import {
  SELECTION_QUOTE_ADD_SHORTCUT,
  canDispatchAppendComposerSelection,
  dispatchAppendComposerSelection,
} from "@/components/editor/ai/composer/selectionQuote";
import {
  isInlineAiEmptyParagraphTriggerKey,
  shouldOpenInlineAiOnEmptyParagraph,
} from "@/components/editor/ai/emptyParagraphAiShortcut";
import { isQuickNoteEditorPage } from "@/pages/workspace/components/editor-host/editorContentMode";
import { getPageMentionMenuItems } from "@/components/editor/inline/pageMentionMenuItems";
import {
  useEditorSettings,
  useEditorPageContext,
} from "@/components/editor/platform/hostContext";
import type { EditorComposerProps } from "./editorComposerTypes";

export function useEditorComposerInteractions({
  editor,
  editable,
  page,
  editorContainerRef,
}: Pick<
  EditorComposerProps,
  "editor" | "editable" | "page" | "editorContainerRef"
>) {
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkPopoverUrl, setLinkPopoverUrl] = useState("");
  const linkPopoverRef = useRef<HTMLDivElement | null>(null);
  const [findBarOpen, setFindBarOpen] = useState(false);
  const [findSeedQuery, setFindSeedQuery] = useState("");
  const [findOpenNonce, setFindOpenNonce] = useState(0);
  const [findOpenReplace, setFindOpenReplace] = useState(false);
  const { ai: aiSettings } = useEditorSettings();
  const { searchPages } = useEditorPageContext();
  const getMentionItems = useCallback(
    async (query: string) =>
      getPageMentionMenuItems(
        editor,
        searchPages(query).filter((item) => !item.isFolder),
      ),
    [editor, searchPages],
  );

  const handleEditorKeyDownCapture = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    const target = event.target as HTMLElement | null;
    const settings = useSettings.getState();
    const isPrimaryLinkShortcut =
      editable &&
      isPrimaryLinkShortcutEvent(event) &&
      !isLinkShortcutClaimedByApp([
        ...Object.values(settings.appShortcuts),
        settings.closeTabShortcut,
        settings.searchPanelCloseShortcut,
      ]) &&
      !!target?.closest(".bn-editor");

    // 不依赖 ProseMirror keymap 在模块加载时缓存的 navigator.platform。
    // Electron 的 Windows WebView 偶尔会让 Mod-k 错配，capture 兜底直接按实际
    // Ctrl/Meta 状态处理；已有链接仍保持“再次按下即移除”的既有行为。
    if (isPrimaryLinkShortcut) {
      const url = editor.getSelectedLinkUrl();
      const selectedText = editor.getSelectedText();
      if (url || selectedText) {
        event.preventDefault();
        event.stopPropagation();
        if (url) {
          editor.deleteLink();
        } else {
          document.dispatchEvent(new CustomEvent("goose-open-link-popover"));
        }
        return;
      }
    }

    if (isQuickNoteEditorPage(page)) return;
    if (
      !__GOOSE_EDITOR_AI__ ||
      !isInlineAiEmptyParagraphTriggerKey(event.key)
    ) {
      return;
    }

    let block: any;
    let inTable = false;
    let selectionEmpty = true;
    try {
      const selection = editor.prosemirrorState?.selection;
      selectionEmpty = selection?.empty !== false;
      inTable = Boolean(
        selection?.$from?.parent?.type?.isInGroup?.("tableContent"),
      );
      block = editor.getTextCursorPosition().block;
    } catch {
      block = null;
    }

    if (
      !shouldOpenInlineAiOnEmptyParagraph({
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        repeat: event.repeat,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
        editable,
        aiEnabled: aiSettings.enabled,
        inEditor: Boolean(target?.closest(".bn-editor")),
        inTable,
        selectionEmpty,
        block,
      })
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const ai = editor.getExtension(GooseAIExtension);
    if (ai && block?.id) {
      ai.openAIMenuAtBlock(block.id);
    }
  };

  useEffect(() => {
    const handleOpenFind = (event: Event) => {
      if (isWorkspaceSettingsOpen()) return;
      const findInputFocused = Boolean(
        document.activeElement?.closest?.("[data-goose-find-in-page]"),
      );
      const seed = findInputFocused
        ? ""
        : readEditorFindSeed(editor, editorContainerRef.current);
      const openReplace =
        (event as CustomEvent<{ replace?: unknown }>).detail?.replace === true;
      // 先关其它弹层，再开查找栏。setTimeout 让 Escape 引发的 commit 先跑完，
      // 避免被同步的 close 路径反吃掉。
      closeAllOverlays();
      setFindSeedQuery(seed);
      setFindOpenReplace(openReplace);
      setFindOpenNonce((value) => value + 1);
      setTimeout(() => setFindBarOpen(true), 0);
    };
    window.addEventListener("goose-note:editor-find-open", handleOpenFind);
    return () =>
      window.removeEventListener("goose-note:editor-find-open", handleOpenFind);
  }, [editor, editorContainerRef]);

  useEffect(() => {
    const handleOpen = () => {
      if (isWorkspaceSettingsOpen()) return;
      setLinkPopoverUrl("");
      setLinkPopoverOpen(true);
    };
    const handleClose = () => setLinkPopoverOpen(false);
    document.addEventListener("goose-open-link-popover", handleOpen);
    document.addEventListener("goose-close-link-popover", handleClose);
    return () => {
      document.removeEventListener("goose-open-link-popover", handleOpen);
      document.removeEventListener("goose-close-link-popover", handleClose);
    };
  }, []);

  useEffect(() => {
    if (!linkPopoverOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (linkPopoverRef.current?.contains(target)) return;
      setLinkPopoverOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (isWorkspaceSettingsOpen()) return;
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !event.isComposing &&
        !event.repeat
      ) {
        event.preventDefault();
        event.stopPropagation();
        setLinkPopoverOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleEscape, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleEscape, true);
    };
  }, [linkPopoverOpen]);

  useEffect(() => {
    if (__GOOSE_EDITOR_COMPACT__ || __GOOSE_LITE__) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        isWorkspaceSettingsOpen() ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing
      )
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-shortcut-recorder]")) return;
      if (!matchShortcut(event, SELECTION_QUOTE_ADD_SHORTCUT)) return;

      if (isQuickNoteEditorPage(page)) return;

      let selectedText: string;
      try {
        selectedText = (editor.getSelectedText() ?? "").trim();
      } catch {
        selectedText = "";
      }
      const isImageNodeSelection =
        getSelectedImageUrl(editor.prosemirrorState) != null;
      if (
        !canDispatchAppendComposerSelection({
          aiEnabled: aiSettings.enabled,
          isCompact: isQuickNoteEditorPage(page),
          selectedText,
          isImageNodeSelection,
        })
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      dispatchAppendComposerSelection({
        pageId: page?.id ?? "",
        pageTitle: getPageTitle(page),
        text: selectedText,
        animate: false,
      });
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [aiSettings.enabled, editor, page]);

  const handleLinkPopoverSubmit = () => {
    const trimmed = linkPopoverUrl.trim();
    if (trimmed) {
      editor.createLink(trimmed);
    }
    setLinkPopoverOpen(false);
    setLinkPopoverUrl("");
  };

  return {
    aiSettings,
    getMentionItems,
    handleEditorKeyDownCapture,
    linkPopoverOpen,
    setLinkPopoverOpen,
    linkPopoverUrl,
    setLinkPopoverUrl,
    linkPopoverRef,
    handleLinkPopoverSubmit,
    findBarOpen,
    setFindBarOpen,
    findSeedQuery,
    findOpenNonce,
    findOpenReplace,
  };
}
