import { FontSelector } from "@/pages/workspace/components/shared/FontSelector";
import { ImageExportThemeSelector } from "@/components/ui/image-export-theme-selector";
import { useState } from "react";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type { CardThemeId, WatermarkConfig } from "@/lib/imageExport";
import { exportPageToImage, exportSelectionToImage } from "@/lib/imageExport";
import { extractBlockNoteTitle } from "@/components/editor/utils/blocknote-content";
import { useHistoryView } from "@/stores/useHistoryView";

function getEditorSelectedBlocks(): BlockNoteContent {
  try {
    const editor = (window as any).__gooseNoteEditor;
    if (editor && typeof editor.getSelection === "function") {
      const $from = editor.prosemirrorState.selection.$from;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "blockContainer") {
          const sel = editor.getSelection();
          if (Array.isArray(sel?.blocks)) return sel.blocks as BlockNoteContent;
          break;
        }
      }
    }
  } catch { /* ignore */ }
  return [];
}

export function PageMenu() {
  const {
    activePageId,
    getPage,
    updatePage,
    createPage,
    setActivePage,
  } = usePages();
  const { deletePageWithUndo } = useDeletePageWithUndo();
  const { activeNotebookId, notebooks, updateNotebook } = useNotebooks();
  const { globalEditorFullWidth } = useSettings();
  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = page ? notebooks[page.workspaceId] : undefined;
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<BlockNoteContent>([]);

  const handleImport = async () => {
    const result = await importFile();
    if (result.success) {
      const newId = createPage(undefined, activeNotebookId || DEFAULT_NOTEBOOK);

      const content = result.content;
      const blocks = [
        { type: "heading", props: { level: 1 }, content: result.title },
        ...content,
      ] as any[];

      updatePage(newId, { content: blocks });

      setActivePage(null);
      requestAnimationFrame(() => {
        setActivePage(newId);
      });
    } else {
      console.error("导入失败:", result.error);
    }
  };

  const handleThemeConfirm = (themeId: CardThemeId, watermarkConfig: WatermarkConfig) => {
    if (!page) return;
    if (selectedBlocks.length > 0) {
      exportSelectionToImage(selectedBlocks, extractBlockNoteTitle(page.content) || "选中内容", themeId, watermarkConfig);
    } else {
      exportPageToImage(page, themeId, watermarkConfig);
    }
  };

  if (!page || !activePageId) return null;

  return (
    <>
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          const blocks = getEditorSelectedBlocks();
          setSelectedBlocks(blocks);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="更多操作"
          className="h-7 w-7 rounded-[7px] text-muted-foreground/70 transition-colors duration-150 hover:bg-muted/65 hover:text-foreground"
        >
          <LucideIcons.MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">更多操作</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px] p-2" align="end" forceMount>
        {/* Font Selector */}
        <div className="px-1 py-2">
          <FontSelector
            value={page.fontFamily}
            onChange={(fontFamily) => updatePage(activePageId, { fontFamily })}
          />
        </div>

        <DropdownMenuGroup>
          <div className="flex items-center justify-between py-1 px-2 rounded-sm text-xs">
            <div className="flex items-center gap-2">
              <LucideIcons.Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>锁定页面</span>
            </div>
            <Switch
              checked={page.isLocked}
              onCheckedChange={(checked) =>
                updatePage(activePageId, { isLocked: checked })
              }
            />
          </div>
        </DropdownMenuGroup>

        {/* Switches Section */}
        <DropdownMenuGroup>
          <div className="flex items-center justify-between py-1 px-2 rounded-sm text-xs">
            <div className="flex items-center gap-2">
              <LucideIcons.ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>全宽显示（当前记事本）</span>
            </div>
            <Switch
              checked={Boolean(notebook?.editorFullWidth ?? globalEditorFullWidth)}
              onCheckedChange={(checked) => {
                if (!notebook) return;
                updateNotebook(notebook.id, { editorFullWidth: checked });
              }}
            />
          </div>

          <DropdownMenuItem
            className="text-xs text-foreground/85 dark:text-foreground/85 data-[highlighted]:text-red-600 dark:data-[highlighted]:text-red-400 focus:text-red-600 dark:focus:text-red-400"
            onClick={() => void deletePageWithUndo(activePageId)}
          >
            <LucideIcons.Trash2 className="mr-2 h-3.5 w-3.5" />
            <span>移至垃圾箱</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Import */}
        <DropdownMenuGroup>
          <DropdownMenuItem className="text-xs" onSelect={handleImport}>
            <LucideIcons.Upload className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <span>导入</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Generate Image — standalone, before Export */}
        <DropdownMenuItem
          className="text-xs relative overflow-hidden group"
          onSelect={() => setThemeSelectorOpen(true)}
        >
          <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-rose-50/80 to-amber-50/80 dark:from-rose-950/30 dark:to-amber-950/30 pointer-events-none" />
          <LucideIcons.Image className="relative mr-2 h-3.5 w-3.5 text-rose-500" />
          <span className="relative font-medium">{selectedBlocks.length > 0 ? "生成选中图片" : "生成图片"}</span>
          <span className="relative ml-auto text-[10px] text-rose-400/70 font-normal">{selectedBlocks.length > 0 ? "选中" : "卡片"}</span>
        </DropdownMenuItem>

        {/* Export submenu */}
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">
              <LucideIcons.Download className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span>导出</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[160px]">
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => exportToJSON(page)}
              >
                <LucideIcons.FileJson className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => {
                  void exportToMarkdown(page).catch((e) => {
                    console.error("[export] Markdown 失败:", e);
                  });
                }}
              >
                <LucideIcons.FileCode className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Markdown
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => {
                  void exportToHTML(page).catch((e) => {
                    console.error("[export] HTML 失败:", e);
                  });
                }}
              >
                <LucideIcons.FileType className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> HTML
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => {
                  void exportToPDF(page).catch((e) => {
                    console.error("[export] PDF 失败:", e);
                  });
                }}
              >
                <LucideIcons.FileText className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> PDF
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="text-xs"
            onSelect={() => {
              const pid = activePageId;
              // 进入历史模式前 flush，避免 200ms debounce 内的最新编辑丢失
              try { flushEditorContent(true); } catch { /* ignore */ }
              setTimeout(() => {
                useHistoryView.getState().enter(pid);
              }, 80);
            }}
          >
            <LucideIcons.History className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <span>页面历史</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span>字数</span>
              <span className="text-[10px] opacity-80">
                {countWords(page.content)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span>最后编辑于</span>
              <span className="text-[10px] opacity-80">
                {new Date(page.updatedAt).toLocaleString("zh-CN")}
              </span>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>

    <ImageExportThemeSelector
      open={themeSelectorOpen}
      onOpenChange={setThemeSelectorOpen}
      onConfirm={handleThemeConfirm}
      mode={selectedBlocks.length > 0 ? "selection" : "page"}
    />
  </>);
}
