import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import {
  FilePanelController,
  FormattingToolbarController,
  LinkToolbarController,
  SuggestionMenuController,
  TableHandlesController,
  useEditorState,
  useExtensionState,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  clonePageContent,
  ensureFirstTitleHeading,
  getContentSignature,
  normalizePageContent,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { CustomSlashMenu } from "@/pages/workspace/components/command/CustomSlashMenu";
import {
  EditorFormattingToolbar,
  shouldRenderFormattingToolbar,
} from "./EditorFormattingToolbar";
import { AIMenuController } from "@blocknote/xl-ai";
import { useFormattingToolbarAi } from "@/stores/useFormattingToolbarAi";
import { EditorSideMenu } from "./EditorSideMenu";
import { ImageLightbox } from "./ImageLightbox";
import { EditorLinkToolbar } from "./EditorLinkToolbar";
import { FindInPageBar } from "./FindInPageBar";
import { closeAllOverlays } from "@/lib/closeAllOverlays";

// Sub-component and modular utility imports
import { EditorFilePanel } from "./components/EditorFilePanel";
import { GooseTableHandle, GooseTableExtendButton } from "./components/GooseTableHandle";
import { EditorContextMenu } from "./components/EditorContextMenu";
import { editorSchema } from "./schema";

// Re-exports to prevent broken imports elsewhere
export {
  normalizeClipboardLineEndings,
  looksLikeMarkdownFragment,
  stripMarkdownHardBreaks,
  normalizeMarkdownPasteText,
  parseMarkdownLink,
  shouldPreferVisibleSelectionText,
  isValidUrl,
} from "@/components/editor/utils/clipboard";

export {
  isBottomEditorBlankClick,
  getSelectedPlainTextContext,
  getElementFromNode,
  isInteractiveEditorTarget,
} from "@/components/editor/utils/selection";

export { editorSchema } from "./schema";

type EditorFindBarProps = {
  editor: any;
  editable: boolean;
  page: any;
  editorContainerRef: RefObject<HTMLDivElement | null>;
  handleEditorBlankMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleEditorPasteCapture: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  getSlashItems: (query: string) => Promise<any[]>;
  restoreFirstTitleHeading: () => boolean;
  pageIdForUpdateRef: RefObject<string | null>;
  syncedContentSignatureRef: RefObject<string | null>;
  debouncedUpdate: ((id: string, content: BlockNoteContent) => void) & { cancel: () => void };
  isEditorFullWidth: boolean;
  effectiveTheme: "light" | "dark";
  tableEvenColumnWidth: boolean;
  searchProviders: any[];
  utools: { openSearchInUtools: boolean };
  customActions: any[];
  isSwitching?: boolean;
};

export function EditorFindBar({
  editor,
  editable,
  page,
  editorContainerRef,
  handleEditorBlankMouseDown,
  handleEditorPasteCapture,
  getSlashItems,
  restoreFirstTitleHeading,
  pageIdForUpdateRef,
  syncedContentSignatureRef,
  debouncedUpdate,
  isEditorFullWidth,
  effectiveTheme,
  tableEvenColumnWidth,
  searchProviders,
  utools,
  customActions,
  isSwitching,
}: EditorFindBarProps) {
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkPopoverUrl, setLinkPopoverUrl] = useState("");
  const linkPopoverRef = useRef<HTMLDivElement | null>(null);
  const [findBarOpen, setFindBarOpen] = useState(false);

  useEffect(() => {
    const handleOpenFind = () => {
      // 先关其它弹层，再开查找栏。setTimeout 让 Escape 引发的 commit 先跑完，
      // 避免被同步的 close 路径反吃掉。
      closeAllOverlays();
      setTimeout(() => setFindBarOpen(true), 0);
    };
    window.addEventListener("goose-note:editor-find-open", handleOpenFind);
    return () =>
      window.removeEventListener("goose-note:editor-find-open", handleOpenFind);
  }, []);

  useEffect(() => {
    const handleOpen = () => {
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
      if (event.key === "Escape") {
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

  const handleLinkPopoverSubmit = () => {
    const trimmed = linkPopoverUrl.trim();
    if (trimmed) {
      editor.createLink(trimmed);
    }
    setLinkPopoverOpen(false);
    setLinkPopoverUrl("");
  };

  const formattingToolbarStoreOpen = useExtensionState(FormattingToolbarExtension, { editor });
  const formattingToolbarSelectionAllowed = useEditorState({
    editor,
    on: "selection",
    selector: ({ editor }) => shouldRenderFormattingToolbar(editor),
  });
  const formattingToolbarAiActive = useFormattingToolbarAi((s) => s.active);
  const formattingToolbarFloatingOptions = useMemo(
    () => ({
      useFloatingOptions: {
        open:
          formattingToolbarAiActive ||
          (formattingToolbarStoreOpen && formattingToolbarSelectionAllowed),
      },
    }),
    [
      formattingToolbarAiActive,
      formattingToolbarSelectionAllowed,
      formattingToolbarStoreOpen,
    ],
  );

  return (
    <EditorContextMenu
      editor={editor}
      editable={editable}
      page={page}
      editorContainerRef={editorContainerRef}
      handleEditorBlankMouseDown={handleEditorBlankMouseDown}
      handleEditorPasteCapture={handleEditorPasteCapture}
      searchProviders={searchProviders}
      utools={utools}
      customActions={customActions}
      effectiveTheme={effectiveTheme}
      isEditorFullWidth={isEditorFullWidth}
      tableEvenColumnWidth={tableEvenColumnWidth}
    >
      {isSwitching && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex flex-col gap-3 px-8 pt-10 animate-in fade-in duration-150"
        >
          <div className="h-8 w-2/3 rounded-md bg-foreground/[0.06] animate-pulse dark:bg-foreground/[0.08]" />
          <div className="mt-4 h-4 w-11/12 rounded bg-foreground/[0.05] animate-pulse dark:bg-foreground/[0.07]" />
          <div className="h-4 w-10/12 rounded bg-foreground/[0.05] animate-pulse dark:bg-foreground/[0.07]" />
          <div className="h-4 w-9/12 rounded bg-foreground/[0.05] animate-pulse dark:bg-foreground/[0.07]" />
        </div>
      )}
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={effectiveTheme}
        slashMenu={false}
        formattingToolbar={false}
        sideMenu={false}
        tableHandles={false}
        filePanel={false}
        onChange={() => {
          const safePageId = pageIdForUpdateRef.current;
          if (!safePageId) return;
          if (restoreFirstTitleHeading()) return;
          const nextContent = normalizePageContent(
            clonePageContent(editor.document as BlockNoteContent),
          );
          const nextSig = getContentSignature(nextContent);
          if (nextSig === syncedContentSignatureRef.current) return;
          syncedContentSignatureRef.current = nextSig;
          debouncedUpdate(safePageId, nextContent);
        }}
      >
        <EditorSideMenu />
        <TableHandlesController
          tableHandle={GooseTableHandle}
          extendButton={GooseTableExtendButton}
        />
        <FormattingToolbarController
          formattingToolbar={EditorFormattingToolbar}
          floatingUIOptions={formattingToolbarFloatingOptions}
        />
        <LinkToolbarController linkToolbar={EditorLinkToolbar} />
        <FilePanelController filePanel={EditorFilePanel} />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashItems}
          shouldOpen={(event) => {
            const $from = event.selection.$from;
            const isFirstBlock = $from.index(0) === 0;
            const isAtBlockStart = $from.parentOffset === 0;
            if (!isFirstBlock || !isAtBlockStart) return false;
            return !$from.parent.type.isInGroup("tableContent");
          }}
          suggestionMenuComponent={CustomSlashMenu}
          onItemClick={(item) => {
            if (item && "onItemClick" in item) {
              (item as any).onItemClick();
            }
          }}
        />
        <SuggestionMenuController
          triggerCharacter="、"
          getItems={getSlashItems}
          shouldOpen={(event) => {
            const $from = event.selection.$from;
            const isFirstBlock = $from.index(0) === 0;
            const isAtBlockStart = $from.parentOffset === 0;
            if (!isFirstBlock || !isAtBlockStart) return false;
            return !$from.parent.type.isInGroup("tableContent");
          }}
          suggestionMenuComponent={CustomSlashMenu}
          onItemClick={(item) => {
            if (item && "onItemClick" in item) {
              (item as any).onItemClick();
            }
          }}
        />
        <AIMenuController />
      </BlockNoteView>
      {linkPopoverOpen && (
        <div
          ref={linkPopoverRef}
          className="absolute z-[20020] flex items-center gap-1.5 rounded-lg border border-border/80 bg-popover p-2 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/15 dark:bg-[#2f3437]"
          style={{ top: 8, left: "50%", transform: "translateX(-50%)" }}
        >
          <input
            value={linkPopoverUrl}
            onChange={(e) => setLinkPopoverUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLinkPopoverSubmit();
              }
              if (e.key === "Escape") {
                setLinkPopoverOpen(false);
              }
            }}
            placeholder="https://..."
            autoFocus
            className="h-8 w-56 rounded-md border border-transparent bg-background px-2.5 text-sm shadow-[inset_0_0_0_1px_hsl(var(--input)/0.8)] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          />
          <button
            type="button"
            onClick={handleLinkPopoverSubmit}
            className="flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            确认
          </button>
        </div>
      )}
      <ImageLightbox editor={editor} editorContainerRef={editorContainerRef} />
      <FindInPageBar
        editor={editor}
        open={findBarOpen}
        onClose={() => setFindBarOpen(false)}
      />
    </EditorContextMenu>
  );
}
