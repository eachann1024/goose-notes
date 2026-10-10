import { useRef, useState } from "react";
import * as GooseIcons from "@/components/ui/icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ImageExportThemeSelector } from "@/components/ui/image-export-theme-selector";
import type { CardThemeId, WatermarkConfig } from "@/lib/imageExport";
import { exportSelectionToImage } from "@/lib/imageExport";
import {
  extractBlockNoteTitle,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { isQuickNoteEditorPage } from "@/pages/workspace/components/editor-host/editorContentMode";
import { resolveCopyBlockSelection } from "@/components/editor/extensions/copyCurrentBlockExtension";
import { getEditorSelectionPlainText } from "@/components/editor/utils/clipboard";
import { useEditorContextClipboard } from "./useEditorContextClipboard";
import { getEditorSelectedBlocksForExport } from "@/components/editor/utils/selection";
import { cn, formatShortcut } from "@/lib/utils";

// 展示型块在这些类型上右键无意义，阻断编辑器右键菜单（含浏览器默认菜单）
// math/mermaid 是 codeBlock 的 language 变体，其 data-content-type 为 "codeBlock"，
// 但需通过父块的 data-language 属性区分；image/file/audio/video/divider/imageResize 直接匹配
const CONTEXT_MENU_EXCLUDED_BLOCK_TYPES = new Set([
  "image",
  "imageResize",
  "file",
  "audio",
  "video",
  "divider",
]);

function isExcludedBlockTarget(target: HTMLElement): boolean {
  if (target.closest(".bn-side-menu")) return true;
  const blockContent = target.closest(".bn-block-content");
  if (!blockContent) return false;
  const contentType = (blockContent as HTMLElement).dataset.contentType ?? "";
  if (CONTEXT_MENU_EXCLUDED_BLOCK_TYPES.has(contentType)) return true;
  // codeBlock 且 language 为 math 或 mermaid 也属于展示型
  if (contentType === "codeBlock") {
    const lang = (blockContent as HTMLElement).dataset.language ?? "";
    if (lang === "math" || lang === "mermaid") return true;
  }
  return false;
}

interface EditorContextMenuProps {
  editor: any;
  editable: boolean;
  page: any;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
  handleEditorBlankMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleEditorPasteCapture: (
    event: React.ClipboardEvent<HTMLDivElement>,
  ) => void;
  handleEditorKeyDownCapture?: (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => void;
  // EditorComposer 的属性暂由其他实施范围维护；本菜单不再消费这两项。
  searchProviders: any[];
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
  handleEditorKeyDownCapture,
  isEditorFullWidth,
  children,
}: EditorContextMenuProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<BlockNoteContent>([]);
  const [canCopy, setCanCopy] = useState(false);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const selectedBlocksRef = useRef<BlockNoteContent>([]);
  const selectedTextRef = useRef("");
  const { handleContextPaste, handleCopySelection, handleCutSelection } =
    useEditorContextClipboard(editor, editable, selectedTextRef);
  // 速记小窗不展示「生成选中图片」：生产包靠 __GOOSE_LITE__ 裁掉；
  // 开发态 / Electron 小窗靠草稿页 id 运行时隐藏。
  const showSelectionImageExport =
    !__GOOSE_LITE__ && page?.id !== "__quicknote_draft__";

  const handleContextMenuOpen = () => {
    let text = "";
    try {
      text = getEditorSelectionPlainText(editor.prosemirrorState);
    } catch {
      /* ignore */
    }
    const trimmedText = text.trim();
    selectedTextRef.current = trimmedText;
    let copyable = Boolean(trimmedText);
    try {
      copyable =
        copyable || Boolean(resolveCopyBlockSelection(editor.prosemirrorState));
    } catch {
      /* ignore */
    }
    setCanCopy(copyable);

    if (showSelectionImageExport) {
      const blocks = getEditorSelectedBlocksForExport(editor);
      setSelectedBlocks(blocks);
      selectedBlocksRef.current = blocks;
    }
  };

  const handleSelectionThemeConfirm = (
    themeId: CardThemeId,
    watermarkConfig: WatermarkConfig,
  ) => {
    const blocks = selectedBlocksRef.current;
    if (!Array.isArray(blocks) || blocks.length === 0) return;
    const title = extractBlockNoteTitle(page?.content) || "选中内容";
    exportSelectionToImage(blocks, title, themeId, watermarkConfig, page);
  };

  return (
    <>
      <ContextMenu
        onOpenChange={(open) => {
          if (open) handleContextMenuOpen();
        }}
      >
        <ContextMenuTrigger asChild>
          <div
            ref={editorContainerRef}
            onDragStartCapture={(event) => {
              if (
                !(event.target as Element).closest(".bn-side-menu") &&
                !(
                  (event.target as Element).closest(".bn-inline-content") &&
                  !window.getSelection()?.isCollapsed
                )
              )
                event.preventDefault();
            }}
            onMouseDown={handleEditorBlankMouseDown}
            onPasteCapture={handleEditorPasteCapture}
            onKeyDownCapture={handleEditorKeyDownCapture}
            onContextMenuCapture={(e) => {
              if (isExcludedBlockTarget(e.target as HTMLElement)) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            data-font-family={page.fontFamily ?? "default"}
            className={cn(
              "workspace-editor-surface relative flex min-h-0 flex-1 flex-col w-full pt-2",
              !__GOOSE_EDITOR_COMPACT__ &&
                !isQuickNoteEditorPage(page) &&
                "pb-[100px]",
              isEditorFullWidth ? "max-w-none" : "max-w-[720px] mx-auto",
            )}
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent editorContext className="w-[180px]">
          {editable && (
            <ContextMenuItem disabled={!canCopy} onSelect={handleCutSelection}>
              <GooseIcons.Scissors className="mr-2 h-4 w-4" />
              剪切
              <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                {formatShortcut("Mod+X")}
              </span>
            </ContextMenuItem>
          )}
          <ContextMenuItem disabled={!canCopy} onSelect={handleCopySelection}>
            <GooseIcons.Copy className="mr-2 h-4 w-4" />
            复制
            <span className="ml-auto text-xs tracking-widest text-muted-foreground">
              {formatShortcut("Mod+C")}
            </span>
          </ContextMenuItem>
          {editable && (
            <ContextMenuItem onSelect={handleContextPaste}>
              <GooseIcons.Clipboard className="mr-2 h-4 w-4" />
              粘贴
              <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                {formatShortcut("Mod+V")}
              </span>
            </ContextMenuItem>
          )}
          {showSelectionImageExport && selectedBlocks.length > 0 && (
            <ContextMenuItem
              onSelect={() => {
                selectedBlocksRef.current = selectedBlocks;
                setThemeSelectorOpen(true);
              }}
            >
              <GooseIcons.Image className="mr-2 h-4 w-4" />
              导出所选内容为图片
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {showSelectionImageExport && (
        <ImageExportThemeSelector
          open={themeSelectorOpen}
          onOpenChange={setThemeSelectorOpen}
          onConfirm={handleSelectionThemeConfirm}
          mode="selection"
          page={page}
          blocks={selectedBlocks}
        />
      )}
    </>
  );
}
