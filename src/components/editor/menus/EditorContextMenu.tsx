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
import {
  extractBlockNoteTitle,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { useEditorPlatform } from "@/components/editor/platform/context";
import { useEditorSettings } from "@/components/editor/platform/hostContext";
import {
  cachePasteTarget,
  pasteClipboardHtmlAsBlocks,
  pasteLinesAsBlocks,
  shouldPasteHtmlAsBlocks,
} from "@/components/editor/hooks/useEditorPaste";
import {
  GOOSE_BLOCKNOTE_BLOCK_COPY_MIME,
  resolveCopyBlockSelection,
} from "@/components/editor/extensions/copyCurrentBlockExtension";
import {
  getEditorSelectionPlainText,
  looksLikeMarkdownFragment,
  normalizeMarkdownPasteText,
} from "@/components/editor/utils/clipboard";
import {
  inspectPasteContainer,
  resolvePasteLines,
} from "@/components/editor/utils/multilinePaste";
import {
  buildSoftWrapPasteInline,
  insertSoftWrappedInline,
  insertSoftWrappedLines,
} from "@/components/editor/utils/softWrapPaste";
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
  searchProviders,
  customActions,
  isEditorFullWidth,
  children,
}: EditorContextMenuProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<BlockNoteContent>([]);
  const [selectedText, setSelectedText] = useState("");
  const [canCopy, setCanCopy] = useState(false);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const selectedBlocksRef = useRef<BlockNoteContent>([]);
  const selectedTextRef = useRef("");
  const platform = useEditorPlatform();
  const { redirectAction, openLinksInHost } = useEditorSettings();
  // 速记小窗不展示「生成选中图片」：生产包靠 __GOOSE_LITE__ 裁掉；
  // 开发态 / Electron 小窗靠草稿页 id 运行时隐藏。
  const showSelectionImageExport =
    !__GOOSE_LITE__ && page?.id !== "__quicknote_draft__";

  const activeSearchProviders = useMemo(
    () => searchProviders.filter((provider) => provider.isEnabled),
    [searchProviders],
  );
  const enabledCustomActions = useMemo(
    () =>
      customActions.filter(
        (action) =>
          action.isEnabled && action.name.trim() && action.command.trim(),
      ),
    [customActions],
  );

  const handleContextMenuOpen = () => {
    let text = "";
    try {
      text = getEditorSelectionPlainText(editor.prosemirrorState);
    } catch {
      /* ignore */
    }
    const trimmedText = text.trim();
    setSelectedText(trimmedText);
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

  const handleContextPaste = useCallback(async () => {
    if (!editable) return;
    try {
      let htmlText = "";
      let blockNoteHtml = "";
      let hasGooseMime = false;
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (!blockNoteHtml && item.types.includes("blocknote/html")) {
            try {
              blockNoteHtml = await (
                await item.getType("blocknote/html")
              ).text();
            } catch {
              // 有些浏览器不允许从异步 ClipboardItem 读取自定义类型，继续走兼容格式。
            }
          }
          if (item.types.includes(GOOSE_BLOCKNOTE_BLOCK_COPY_MIME)) {
            hasGooseMime = true;
          }
          if (!htmlText && item.types.includes("text/html")) {
            htmlText = await (await item.getType("text/html")).text();
          }
        }
      } catch {
        // read() 不可用或权限不足时回退 readText
      }

      // 键盘复制写入的原生内部 HTML 优先于自定义 MIME / text/html。
      // 右键粘贴没有原生 paste transaction，不能直接 pasteHTML(raw)，否则已有
      // block ID 不会经过 UniqueID；解析后递归移除 ID 再插入，保留 props 和 children。
      if (blockNoteHtml) {
        const target = cachePasteTarget(editor);
        if (target) {
          const pasted = await pasteClipboardHtmlAsBlocks(
            editor,
            blockNoteHtml,
            target,
          );
          if (pasted) return;
        }
      }

      if (shouldPasteHtmlAsBlocks(htmlText, hasGooseMime)) {
        const target = cachePasteTarget(editor);
        if (target) {
          const pasted = await pasteClipboardHtmlAsBlocks(
            editor,
            htmlText,
            target,
          );
          if (pasted) return;
        }
      }

      const text = normalizeMarkdownPasteText(
        await navigator.clipboard.readText(),
      );
      if (!text) return;
      const lines = resolvePasteLines(text, "");
      try {
        const container = inspectPasteContainer(
          editor.prosemirrorState.selection.$from,
        );
        if (container.inSoftWrap && lines && lines.length >= 2) {
          const inline = buildSoftWrapPasteInline({ plainText: text });
          if (inline.length > 0) insertSoftWrappedInline(editor, inline);
          else insertSoftWrappedLines(editor, lines.join("\n"));
          return;
        }
      } catch {
        /* 选区读不到时按普通多行粘贴 */
      }
      if (lines && lines.length >= 2) {
        let blockType: string | null = null;
        try {
          blockType = editor.getTextCursorPosition().block.type ?? null;
        } catch {
          blockType = null;
        }
        pasteLinesAsBlocks(editor, lines, blockType);
        return;
      }
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
    try {
      editor.focus();
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined" && document.execCommand("copy")) {
      return;
    }
    let text = selectedTextRef.current;
    try {
      text = getEditorSelectionPlainText(editor.prosemirrorState) || text;
    } catch {
      /* ignore */
    }
    if (text) void platform.clipboard.copyText(text);
  }, [editor, platform]);

  const handleCutSelection = useCallback(() => {
    if (!editable) return;
    let text = selectedTextRef.current;
    try {
      text = getEditorSelectionPlainText(editor.prosemirrorState) || text;
    } catch {
      /* ignore */
    }
    void platform.clipboard.copyText(text);
    editor.exec((state: any, dispatch: any) => {
      dispatch?.(state.tr.deleteSelection());
      return true;
    });
  }, [editable, editor, platform]);

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
              !__GOOSE_EDITOR_COMPACT__ && "pb-[100px]",
              isEditorFullWidth ? "max-w-none" : "max-w-[720px] mx-auto",
            )}
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent editorContext className="w-[180px]">
          {selectedText && activeSearchProviders.length > 0 && (
            <>
              <ContextMenuItem
                disabled
                className="max-w-[168px] truncate text-xs text-muted-foreground"
              >
                {selectedText.length > 20
                  ? `${selectedText.slice(0, 20)}...`
                  : selectedText}
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
                    void platform.shell.openUrl(url, openLinksInHost);
                  }}
                >
                  <LucideIcons.Search className="mr-2 h-4 w-4" />用{" "}
                  {provider.name} 搜索
                </ContextMenuItem>
              ))}
              <ContextMenuSeparator />
            </>
          )}
          {/* 快捷动作依赖 Electron redirect 生态：Electron 桌面端或宿主未注入 redirectAction 时整块不渲染 */}
          {__HOST_TARGET__ !== "electron" &&
            redirectAction &&
            selectedText &&
            enabledCustomActions.length > 0 && (
            <>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <LucideIcons.Zap className="mr-2 h-4 w-4" />
                  快捷动作
                </ContextMenuSubTrigger>
                <ContextMenuSubContent editorContext>
                  {enabledCustomActions.map((action) => (
                    <ContextMenuItem
                      key={action.id}
                      onSelect={() => {
                        const label = action.pluginName
                          ? ([action.pluginName, action.command] as [
                              string,
                              string,
                            ])
                          : action.command;
                        redirectAction?.(label, selectedText);
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
          {editable && (
            <ContextMenuItem
              disabled={!selectedText}
              onSelect={handleCutSelection}
            >
              <LucideIcons.Scissors className="mr-2 h-4 w-4" />
              剪切
              <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                {formatShortcut("Mod+X")}
              </span>
            </ContextMenuItem>
          )}
          <ContextMenuItem
            disabled={!canCopy}
            onSelect={handleCopySelection}
          >
            <LucideIcons.Copy className="mr-2 h-4 w-4" />
            拷贝
            <span className="ml-auto text-xs tracking-widest text-muted-foreground">
              {formatShortcut("Mod+C")}
            </span>
          </ContextMenuItem>
          {editable && (
            <ContextMenuItem onSelect={handleContextPaste}>
              <LucideIcons.Clipboard className="mr-2 h-4 w-4" />
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
              <LucideIcons.Image className="mr-2 h-4 w-4" />
              生成选中图片
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
