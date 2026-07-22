import { FontSelector } from "@/pages/workspace/components/shared/FontSelector";
import { ImageExportThemeSelector } from "@/components/ui/image-export-theme-selector";
import { useState } from "react";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type { CardThemeId, WatermarkConfig } from "@/lib/imageExport";
import { exportPageToImage, exportSelectionToImage } from "@/lib/imageExport";
import { extractBlockNoteTitle } from "@/components/editor/utils/blocknote-content";
import { useHistoryView } from "@/stores/useHistoryView";
import { deletePageWithUndo } from "@/lib/page-delete-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  } catch {
    /* ignore */
  }
  return [];
}

export function PageMenu() {
  const { activePageId, getPage, updatePage, createPage, setActivePage } =
    usePages();
  const { activeNotebookId, notebooks, updateNotebook } = useNotebooks();
  const { globalEditorFullWidth } = useSettings();
  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = page ? notebooks[page.workspaceId] : undefined;
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<BlockNoteContent>([]);
  const isLocalItem = Boolean(page?.localFilePath);

  const handleImport = async () => {
    try {
      const result = await importFile();
      if (!result.success) {
        if (result.error !== "未选择文件") {
          toast.error(result.error || "导入失败");
        }
        return;
      }

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
      toast.success("已导入为新页面");
    } catch (error) {
      console.error("导入失败:", error);
      toast.error("导入失败，请检查文件后重试");
    }
  };

  const runExport = (label: string, task: () => Promise<unknown>) => {
    const toastId = toast.loading(`正在导出 ${label}…`);
    void task()
      .then(() => toast.success(`${label} 已导出`, { id: toastId }))
      .catch((error) => {
        console.error(`[export] ${label} 失败:`, error);
        toast.error(`${label} 导出失败`, { id: toastId });
      });
  };

  const handleThemeConfirm = (
    themeId: CardThemeId,
    watermarkConfig: WatermarkConfig,
  ) => {
    if (!page) return;
    const blocks = getEditorSelectedBlocks();
    if (blocks.length > 0) {
      exportSelectionToImage(
        blocks,
        extractBlockNoteTitle(page.content) || "选中内容",
        themeId,
        watermarkConfig,
      );
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
            className="h-8 w-8 rounded-[8px] text-muted-foreground/70 transition-colors duration-150 hover:bg-muted/65 hover:text-foreground"
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
              onChange={(fontFamily) =>
                updatePage(activePageId, { fontFamily })
              }
            />
          </div>

          <DropdownMenuGroup>
              <DropdownMenuItem
                className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                onSelect={() => {
                  updatePage(activePageId, { isFavorite: !page.isFavorite });
                }}
              >
                <LucideIcons.Star
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground",
                    page.isFavorite &&
                      "fill-[var(--goose-color-favorite)] text-[var(--goose-color-favorite)]",
                  )}
                />
                <span className="min-w-0 truncate">
                  {page.isFavorite
                    ? "取消收藏"
                    : isLocalItem
                      ? "收藏文件"
                      : "收藏页面"}
                </span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                onSelect={() => {
                  updatePage(activePageId, { isPinned: !page.isPinned });
                }}
              >
                <LucideIcons.Pin
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground",
                    page.isPinned &&
                      "fill-[var(--goose-color-danger)] text-[var(--goose-color-danger)]",
                  )}
                />
                <span className="min-w-0 truncate">
                  {page.isPinned ? "取消置顶" : "置顶页面"}
                </span>
              </DropdownMenuItem>

              <div className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2 rounded-[10px] px-2 py-1.5 text-xs">
                <LucideIcons.Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">锁定页面</span>
                <Switch
                  aria-label="锁定页面"
                  checked={page.isLocked}
                  onCheckedChange={(checked) =>
                    updatePage(activePageId, { isLocked: checked })
                  }
                />
              </div>
            </DropdownMenuGroup>

          {/* Switches Section */}
          <DropdownMenuGroup>
            <div className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2 rounded-[10px] px-2 py-1.5 text-xs">
              <LucideIcons.ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">全宽显示（当前记事本）</span>
              <Switch
                aria-label="全宽显示（当前记事本）"
                checked={Boolean(
                  notebook?.editorFullWidth ?? globalEditorFullWidth,
                )}
                onCheckedChange={(checked) => {
                  if (!notebook) return;
                  updateNotebook(notebook.id, { editorFullWidth: checked });
                }}
              />
            </div>

            <DropdownMenuItem
              className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs text-foreground/85 dark:text-foreground/85 data-[highlighted]:text-[var(--goose-color-danger-focus)] focus:text-[var(--goose-color-danger-focus)]"
              onClick={() => void deletePageWithUndo(activePageId)}
            >
              {isLocalItem ? (
                <LucideIcons.FileX className="h-3.5 w-3.5" />
              ) : (
                <LucideIcons.Trash2 className="h-3.5 w-3.5" />
              )}
              <span className="min-w-0 truncate">
                {isLocalItem ? "移到系统回收站" : "移至垃圾箱"}
              </span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {/* Import */}
          {!isLocalItem && (
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                onSelect={handleImport}
              >
                <LucideIcons.Upload className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="min-w-0 truncate">导入</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}

          {/* Generate Image — standalone, before Export */}
          <DropdownMenuItem
            className="page-menu-generate-image grid grid-cols-[16px_minmax(0,1fr)_auto] gap-x-2 text-xs text-foreground"
            onSelect={() => {
              setSelectedBlocks(getEditorSelectedBlocks());
              setThemeSelectorOpen(true);
            }}
          >
            <LucideIcons.Image className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="page-menu-shimmer-text min-w-0 truncate font-medium text-foreground">
              {selectedBlocks.length > 0 ? "生成选中图片" : "生成图片"}
            </span>
            <span className="text-[10px] font-normal text-muted-foreground/70">
              {selectedBlocks.length > 0 ? "选中" : "可选中生成"}
            </span>
          </DropdownMenuItem>

          {/* Export submenu */}
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2 text-xs">
                <LucideIcons.Download className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="min-w-0 truncate">导出</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[160px]">
                <DropdownMenuItem
                  className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                  onSelect={() => runExport("JSON", () => exportToJSON(page))}
                >
                  <LucideIcons.FileJson className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="min-w-0 truncate">JSON</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                  onSelect={() =>
                    runExport("Markdown", () => exportToMarkdown(page))
                  }
                >
                  <LucideIcons.FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="min-w-0 truncate">Markdown</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                  onSelect={() => runExport("HTML", () => exportToHTML(page))}
                >
                  <LucideIcons.FileType className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="min-w-0 truncate">HTML</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                  onSelect={() => runExport("PDF", () => exportToPDF(page))}
                >
                  <LucideIcons.FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="min-w-0 truncate">PDF</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem
              className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
              onSelect={() => {
                const pid = activePageId;
                // 进入历史模式前 flush，避免 200ms debounce 内的最新编辑丢失
                try {
                  flushEditorContent(true);
                } catch {
                  /* ignore */
                }
                setTimeout(() => {
                  useHistoryView.getState().enter(pid);
                }, 80);
              }}
            >
              <LucideIcons.History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="min-w-0 truncate">页面历史</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2">
                <span aria-hidden="true" />
                <span>字数</span>
                <span className="text-[10px] opacity-80">
                  {countWords(page.content)}
                </span>
              </div>
              <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2">
                <span aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span>最后编辑于</span>
                  <span className="text-[10px] opacity-80">
                    {new Date(page.updatedAt).toLocaleString("zh-CN")}
                  </span>
                </div>
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
    </>
  );
}
