import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ImageExportThemeSelector } from "@/components/ui/image-export-theme-selector";
import * as LucideIcons from "lucide-react";
import type { CardThemeId, WatermarkConfig } from "@/lib/imageExport";
import { exportSelectionToImage } from "@/lib/imageExport";
import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import {
  BlockNoteViewRaw as BlockNoteView,
  FilePanelController,
  FormattingToolbarController,
  LinkToolbarController,
  SuggestionMenuController,
  TableHandlesController,
  useEditorState,
  useExtensionState,
} from "@blocknote/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  clonePageContent,
  ensureFirstTitleHeading,
  extractBlockNoteTitle,
  getContentSignature,
  normalizePageContent,
  type BlockNoteContent,
} from "@/lib/blocknote-content";
import { CustomSlashMenu } from "@/pages/workspace/components/command/CustomSlashMenu";
import {
  EditorFormattingToolbar,
  shouldRenderFormattingToolbar,
} from "./EditorFormattingToolbar";
import { AiInlineInput } from "./AiInlineInput";
import { useFormattingToolbarAi } from "@/stores/useFormattingToolbarAi";
import { EditorSideMenu } from "./EditorSideMenu";
import { ImageLightbox } from "./ImageLightbox";
import { EditorLinkToolbar } from "./EditorLinkToolbar";
import { UToolsAdapter } from "@/lib/utools";

// Sub-component and modular utility imports
import { EditorFilePanel } from "./components/EditorFilePanel";
import { GooseTableHandle, GooseTableExtendButton } from "./components/GooseTableHandle";
import { editorSchema } from "./schema";
import {
  looksLikeMarkdownFragment,
  normalizeMarkdownPasteText,
  parseMarkdownLink,
} from "./utils/clipboard";
import {
  isBottomEditorBlankClick,
  getSelectedPlainTextContext,
} from "./utils/selection";

// Re-exports to prevent broken imports elsewhere
export {
  normalizeClipboardLineEndings,
  looksLikeMarkdownFragment,
  stripMarkdownHardBreaks,
  normalizeMarkdownPasteText,
  parseMarkdownLink,
  shouldPreferVisibleSelectionText,
  isValidUrl,
} from "./utils/clipboard";

export {
  isBottomEditorBlankClick,
  getSelectedPlainTextContext,
  getElementFromNode,
  isInteractiveEditorTarget,
} from "./utils/selection";

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
  searchProviders: any[];
  utools: { openSearchInUtools: boolean };
  customActions: any[];
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
  searchProviders,
  utools,
  customActions,
}: EditorFindBarProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<BlockNoteContent>([]);
  const [selectedText, setSelectedText] = useState("");
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const selectedBlocksRef = useRef<BlockNoteContent>([]);
  const selectedTextRef = useRef("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkPopoverUrl, setLinkPopoverUrl] = useState("");
  const linkPopoverRef = useRef<HTMLDivElement | null>(null);

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

  const handleLinkPopoverSubmit = useCallback(() => {
    const trimmed = linkPopoverUrl.trim();
    if (trimmed) {
      editor.createLink(trimmed);
    }
    setLinkPopoverOpen(false);
    setLinkPopoverUrl("");
  }, [linkPopoverUrl, editor]);

  const activeSearchProviders = useMemo(
    () => searchProviders.filter((provider) => provider.isEnabled),
    [searchProviders],
  );
  const enabledCustomActions = useMemo(
    () => customActions.filter((action) => action.isEnabled && action.name.trim() && action.command.trim()),
    [customActions],
  );

  const handleContextMenuOpen = () => {
    let text = "";
    try {
      text = editor.getSelectedText() || "";
    } catch { /* ignore */ }
    if (!text.trim()) {
      try {
        text = document.getSelection()?.toString() || "";
      } catch { /* ignore */ }
    }
    const trimmedText = text.trim();
    setSelectedText(trimmedText);
    selectedTextRef.current = trimmedText;

    let blocks: BlockNoteContent = [];
    if (!trimmedText) {
      try {
        const pmSel = editor.prosemirrorState.selection;
        const $from = pmSel.$from;
        let inBlock = false;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "blockContainer") { inBlock = true; break; }
        }
        if (inBlock) {
          const selected = editor.getSelection();
          if (Array.isArray(selected?.blocks)) {
            blocks = selected.blocks as BlockNoteContent;
          }
        }
      } catch { /* ignore */ }
      if (blocks.length <= 1) {
        blocks = [];
      }
    }
    setSelectedBlocks(blocks);
    selectedBlocksRef.current = blocks;
  };

  const handleContextPaste = useCallback(async () => {
    if (!editable) return;
    try {
      const text = normalizeMarkdownPasteText(await navigator.clipboard.readText());
      if (!text) return;
      if (looksLikeMarkdownFragment(text)) {
        editor.pasteMarkdown(text);
      } else {
        editor.insertInlineContent(text);
      }
    } catch (error) {
      console.error("Failed to read clipboard contents: ", error);
    }
  }, [editable, editor]);

  const handleCopySelection = useCallback(() => {
    const text = selectedTextRef.current || editor.getSelectedText() || "";
    UToolsAdapter.copyToClipboard(text);
  }, [editor]);

  const handleCutSelection = useCallback(() => {
    if (!editable) return;
    const text = selectedTextRef.current || editor.getSelectedText() || "";
    UToolsAdapter.copyToClipboard(text);
    editor.exec((state: any, dispatch: any) => {
      dispatch?.(state.tr.deleteSelection());
      return true;
    });
  }, [editable, editor]);

  const handleSelectionThemeConfirm = (themeId: CardThemeId, watermarkConfig: WatermarkConfig) => {
    const blocks = selectedBlocksRef.current;
    if (!Array.isArray(blocks) || blocks.length === 0) return;
    const title = extractBlockNoteTitle(page?.content) || "选中内容";
    exportSelectionToImage(blocks, title, themeId, watermarkConfig);
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
    <>
    <ContextMenu onOpenChange={(open) => { if (open) handleContextMenuOpen(); }}>
      <ContextMenuTrigger asChild>
        <div
          ref={editorContainerRef}
          onMouseDown={handleEditorBlankMouseDown}
          onPasteCapture={handleEditorPasteCapture}
          data-font-family={page.fontFamily ?? "default"}
          className={cn(
            "workspace-editor-surface relative flex min-h-0 flex-1 flex-col w-full pt-2",
            isEditorFullWidth ? "max-w-none" : "max-w-4xl mx-auto",
          )}
        >
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
          <AiInlineInput />
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
      </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[180px]">
        {selectedText && activeSearchProviders.length > 0 && (
          <>
            <ContextMenuItem disabled className="max-w-[168px] truncate text-xs text-muted-foreground">
              {selectedText.length > 20 ? `${selectedText.slice(0, 20)}...` : selectedText}
            </ContextMenuItem>
            <ContextMenuSeparator />
            {activeSearchProviders.map((provider) => (
              <ContextMenuItem
                key={provider.id}
                onSelect={() => {
                  const url = provider.urlTemplate.replace(
                    "%s",
                    encodeURIComponent(selectedText),
                  );
                  UToolsAdapter.openUrl(url, utools.openSearchInUtools);
                }}
              >
                <LucideIcons.Search className="mr-2 h-4 w-4" />
                用 {provider.name} 搜索
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
          </>
        )}
        {selectedText && enabledCustomActions.length > 0 && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <LucideIcons.Zap className="mr-2 h-4 w-4" />
                快捷动作
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {enabledCustomActions.map((action) => (
                  <ContextMenuItem
                    key={action.id}
                    onSelect={() => {
                      const label = action.pluginName
                        ? [action.pluginName, action.command] as [string, string]
                        : action.command;
                      UToolsAdapter.redirect(label, selectedText);
                    }}
                  >
                    {action.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          disabled={!editable || !selectedText}
          onSelect={handleCutSelection}
        >
          <LucideIcons.Scissors className="mr-2 h-4 w-4" />
          剪切
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘X</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!selectedText}
          onSelect={handleCopySelection}
        >
          <LucideIcons.Copy className="mr-2 h-4 w-4" />
          拷贝
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘C</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!editable}
          onSelect={handleContextPaste}
        >
          <LucideIcons.Clipboard className="mr-2 h-4 w-4" />
          粘贴
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘V</span>
        </ContextMenuItem>
        {selectedBlocks.length > 0 && (
          <ContextMenuItem
            onSelect={() => {
              selectedBlocksRef.current = selectedBlocks;
              setThemeSelectorOpen(true);
            }}
          >
            <LucideIcons.Image className="mr-2 h-4 w-4" />
            生成选中图片
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>

    <ImageExportThemeSelector
      open={themeSelectorOpen}
      onOpenChange={setThemeSelectorOpen}
      onConfirm={handleSelectionThemeConfirm}
      mode="selection"
    />
    <ImageLightbox editor={editor} editorContainerRef={editorContainerRef} />
  </>);
}
