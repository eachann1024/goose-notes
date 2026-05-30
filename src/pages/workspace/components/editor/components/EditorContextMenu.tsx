import { useCallback, useMemo, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
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
import { ImageExportThemeSelector } from "@/components/ui/image-export-theme-selector";
import type { CardThemeId, WatermarkConfig } from "@/lib/imageExport";
import { exportSelectionToImage } from "@/lib/imageExport";
import { extractBlockNoteTitle, type BlockNoteContent } from "@/lib/blocknote-content";
import { UToolsAdapter } from "@/lib/utools";
import { looksLikeMarkdownFragment, normalizeMarkdownPasteText } from "../utils/clipboard";
import { cn, formatShortcut } from "@/lib/utils";

interface EditorContextMenuProps {
  editor: any;
  editable: boolean;
  page: any;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
  handleEditorBlankMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleEditorPasteCapture: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  searchProviders: any[];
  utools: { openSearchInUtools: boolean };
  customActions: any[];
  effectiveTheme: "light" | "dark";
  isEditorFullWidth: boolean;
  children: React.ReactNode;
}

export function EditorContextMenu({
  editor,
  editable,
  page,
  editorContainerRef,
  handleEditorBlankMouseDown,
  handleEditorPasteCapture,
  searchProviders,
  utools,
  customActions,
  isEditorFullWidth,
  children,
}: EditorContextMenuProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<BlockNoteContent>([]);
  const [selectedText, setSelectedText] = useState("");
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const selectedBlocksRef = useRef<BlockNoteContent>([]);
  const selectedTextRef = useRef("");

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
              isEditorFullWidth ? "max-w-none" : "max-w-[720px] mx-auto",
            )}
          >
            {children}
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
            <span className="ml-auto text-xs tracking-widest text-muted-foreground">{formatShortcut("Mod+X")}</span>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selectedText}
            onSelect={handleCopySelection}
          >
            <LucideIcons.Copy className="mr-2 h-4 w-4" />
            拷贝
            <span className="ml-auto text-xs tracking-widest text-muted-foreground">{formatShortcut("Mod+C")}</span>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!editable}
            onSelect={handleContextPaste}
          >
            <LucideIcons.Clipboard className="mr-2 h-4 w-4" />
            粘贴
            <span className="ml-auto text-xs tracking-widest text-muted-foreground">{formatShortcut("Mod+V")}</span>
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
    </>
  );
}
