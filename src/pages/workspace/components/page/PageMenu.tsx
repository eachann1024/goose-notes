import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAction,
} from "@/components/ui/popover";
import { FontSelector } from "@/pages/workspace/components/shared/FontSelector";
import "./page-menu.css";
import { ImageExportThemeSelector } from "@/components/ui/image-export-theme-selector";
import { useEffect, useRef, useState } from "react";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type { CardThemeId, WatermarkConfig } from "@/lib/imageExport";
import { exportPageToImage, exportSelectionToImage } from "@/lib/imageExport";
import { extractBlockNoteTitle } from "@/components/editor/utils/blocknote-content";
import {
  getActiveGooseNoteEditor,
  getEditorSelectedBlocksForExport,
} from "@/components/editor/utils/selection";
import { useHistoryView } from "@/stores/useHistoryView";
import { deletePageWithUndo } from "@/lib/page-delete-actions";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { isElectronRuntime } from "@/lib/electron/runtime";
import { createDesktopWindow } from "@/lib/electron/windowContext";
import { detachTabFromThisWindow } from "@/lib/electron/detachTab";
import { useTabs } from "@/stores/useTabs";

function captureEditorSelectedBlocks(): BlockNoteContent {
  return getEditorSelectedBlocksForExport(getActiveGooseNoteEditor());
}

const EXPORT_OPEN_DELAY_MS = 80;
const EXPORT_CLOSE_DELAY_MS = 150;
const EXPORT_MENU_PAD_PX = 8;

function pointInElement(
  x: number,
  y: number,
  element: HTMLElement | null,
  pad = 0,
) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (
    x >= rect.left - pad &&
    x <= rect.right + pad &&
    y >= rect.top - pad &&
    y <= rect.bottom + pad
  );
}

function PageExportSubmenu({
  enabled,
  viewportHeight,
  onExportMarkdown,
  onExportHtml,
  onExportWord,
  onExportPdf,
}: {
  enabled: boolean;
  viewportHeight: number;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onExportWord: () => void;
  onExportPdf: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const suppressHoverOpen = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  openRef.current = open;

  const clearTimers = () => {
    if (openTimer.current != null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const closeNow = () => {
    suppressHoverOpen.current = true;
    clearTimers();
    setOpen(false);
  };

  const pointerInHoverZone = (x: number, y: number) =>
    pointInElement(x, y, triggerRef.current, 2) ||
    pointInElement(x, y, menuRef.current, EXPORT_MENU_PAD_PX);

  useEffect(() => () => clearTimers(), []);
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const menu = document.querySelector<HTMLElement>(".goose-page-menu-export");
      if (menu) menuRef.current = menu;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    if (!enabled) {
      suppressHoverOpen.current = false;
      clearTimers();
      setOpen(false);
      return;
    }
    const onMove = (event: PointerEvent) => {
      if (pointerInHoverZone(event.clientX, event.clientY)) {
        if (suppressHoverOpen.current) return;
        if (closeTimer.current != null) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
        if (openRef.current || openTimer.current != null) return;
        openTimer.current = window.setTimeout(() => {
          openTimer.current = null;
          setOpen(true);
        }, EXPORT_OPEN_DELAY_MS);
        return;
      }
      suppressHoverOpen.current = false;
      if (openTimer.current != null) {
        window.clearTimeout(openTimer.current);
        openTimer.current = null;
      }
      if (!openRef.current || closeTimer.current != null) return;
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = null;
        setOpen(false);
      }, EXPORT_CLOSE_DELAY_MS);
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [enabled]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeNow();
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const select = (action: () => void) => {
    closeNow();
    action();
  };

  const itemClass =
    "goose-interactive group grid min-h-[32px] w-full cursor-default grid-cols-[16px_minmax(0,1fr)] items-center gap-x-2 rounded-lg px-2 text-left text-xs";

  return (
    <Popover
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (next) {
          clearTimers();
          setOpen(true);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          data-state={open ? "open" : "closed"}
          aria-haspopup="menu"
          aria-expanded={open}
          onPointerEnter={(event) => {
            if (suppressHoverOpen.current) return;
            if (pointerInHoverZone(event.clientX, event.clientY) && !open) {
              if (openTimer.current != null) return;
              openTimer.current = window.setTimeout(() => {
                openTimer.current = null;
                setOpen(true);
              }, EXPORT_OPEN_DELAY_MS);
            }
          }}
          className="goose-interactive group grid min-h-[32px] w-full cursor-default grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-1.5 rounded-lg px-2 text-left text-xs"
        >
          <LucideIcons.Download className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)] group-data-[state=open]:text-[var(--goose-interactive-selected-fg)]" />
          <span className="min-w-0 truncate">导出</span>
          <LucideIcons.ChevronRight className="ml-auto h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={menuRef}
        side="right"
        align="start"
        sideOffset={4}
        alignOffset={-4}
        collisionPadding={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="goose-page-menu-export goose-page-menu-surface min-w-[144px] w-auto rounded-[12px] p-1"
        style={{
          maxHeight:
            viewportHeight <= 0
              ? undefined
              : `${Math.max(120, viewportHeight - 16)}px`,
        }}
      >
        <div role="menu" aria-label="导出">
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => select(onExportMarkdown)}
          >
            <LucideIcons.FileCode className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
            <span className="min-w-0 truncate">Markdown</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => select(onExportHtml)}
          >
            <LucideIcons.FileType className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
            <span className="min-w-0 truncate">HTML</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => select(onExportWord)}
          >
            <LucideIcons.File className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
            <span className="min-w-0 truncate">Word</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => select(onExportPdf)}
          >
            <LucideIcons.FileText className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
            <span className="min-w-0 truncate">PDF</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PageMenu() {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }));
  const {
    activePageId,
    getPage,
    updatePage,
    createPage,
    createLocalPageRecord,
    setActivePage,
  } = usePages();
  const { activeNotebookId, notebooks } = useNotebooks();
  const page = activePageId ? getPage(activePageId) : undefined;
  const activeNotebook = activeNotebookId
    ? notebooks[activeNotebookId]
    : undefined;
  const isLocalFolderNotebook = activeNotebook?.source === "local-folder";
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<BlockNoteContent>([]);
  const selectedBlocksRef = useRef<BlockNoteContent>([]);
  const isLocalItem = Boolean(page?.localFilePath);
  const { openTabs, activeTabId } = useTabs();
  const activeTab = openTabs.find((tab) => tab.id === activeTabId);
  const canOpenInNewWindow = isElectronRuntime();

  const captureSelectedBlocks = () => {
    const blocks = captureEditorSelectedBlocks();
    selectedBlocksRef.current = blocks;
    setSelectedBlocks(blocks);
    return blocks;
  };

  useEffect(() => {
    const updateViewport = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const handleImport = async () => {
    try {
      const result = await importFile({
        preserveStructure: isLocalFolderNotebook,
      });
      if (!result.success) {
        if (result.error !== "未选择文件") {
          toast.error(result.error || "导入失败");
        }
        return;
      }

      closeNotebookAiIfFullscreen();
      if (__HOST_TARGET__ === "electron" && !activeNotebookId) {
        toast.error("请先打开文件夹", {
          description: "Electron 桌面端仅支持本地文件夹仓库。",
        });
        return;
      }

      if (isLocalFolderNotebook && activeNotebookId) {
        const pageId = await createLocalPageRecord({
          workspaceId: activeNotebookId,
          title: result.title,
          content: result.content as never,
        });
        if (!pageId) {
          toast.error("导入失败，请重试");
          return;
        }
        setActivePage(null);
        requestAnimationFrame(() => {
          setActivePage(pageId);
        });
        toast.success("已导入为新页面");
        return;
      }

      const newId = createPage(undefined, activeNotebookId || DEFAULT_NOTEBOOK);
      if (!newId) return;

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
    if (page?.isFolder) {
      toast.error("文件夹不能直接导出，请打开其中的笔记再导出");
      return;
    }
    const toastId = toast.loading(`正在导出 ${label}…`);
    void task()
      .then(() => toast.success(`${label} 已导出`, { id: toastId }))
      .catch((error) => {
        console.error(`[export] ${label} 失败:`, error);
        const message = error instanceof Error ? error.message : "";
        toast.error(
          message ? `${label} 导出失败：${message}` : `${label} 导出失败`,
          { id: toastId },
        );
      });
  };

  const handleThemeConfirm = (
    themeId: CardThemeId,
    watermarkConfig: WatermarkConfig,
  ) => {
    if (!page) return;
    const blocks = selectedBlocksRef.current;
    if (blocks.length > 0) {
      exportSelectionToImage(
        blocks,
        extractBlockNoteTitle(page.content) || "选中内容",
        themeId,
        watermarkConfig,
        page,
      );
    } else {
      exportPageToImage(page, themeId, watermarkConfig);
    }
  };

  if (!page || !activePageId) return null;

  return (
    <>
      <Popover
        onOpenChange={(open) => {
          setPageMenuOpen(open);
          if (open) captureSelectedBlocks();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="更多操作"
            onPointerDownCapture={captureSelectedBlocks}
            className="h-8 w-8 rounded-[8px] text-muted-foreground/70 transition-colors duration-150 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]"
          >
            <LucideIcons.MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">更多操作</span>
          </Button>
        </PopoverTrigger>
        {/*
          不要在定位外壳上挂 goose-editor-context-ui（CSS zoom）。
          Electron 旧内核会把 zoom 祖先的 getBoundingClientRect 再次放大，
          导致导出子菜单相对「导出」触发项下漂，中间出现无法穿越的空隙。
          页面更多菜单走 viewport 坐标系，尺寸用真实 px。
        */}
        <PopoverContent
          className="goose-page-menu-surface goose-floating-surface max-h-[calc(100vh-24px)] w-[272px] max-w-[calc(100vw-16px)] overflow-y-auto p-1.5"
          align="end"
          sideOffset={6}
          style={{
            maxHeight:
              viewport.height <= 0
                ? undefined
                : `${Math.max(160, viewport.height - 24)}px`,
            maxWidth:
              viewport.width <= 0
                ? undefined
                : `${Math.max(160, viewport.width - 16)}px`,
          }}
          forceMount
        >
          {/* Font Selector */}
          <div className="px-0.5 py-1">
            <FontSelector
              value={page.fontFamily}
              compact
              onChange={(fontFamily) =>
                updatePage(activePageId, { fontFamily })
              }
            />
          </div>

          <div className="mx-1 my-1 h-px bg-border" />

          <section aria-label="页面状态">
            <div className="px-2 pb-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground">
              页面状态
            </div>
            <div className="grid grid-cols-2 gap-1 px-1 pb-0.5">
              <button
                type="button"
                aria-pressed={page.isFavorite}
                onClick={() =>
                  updatePage(activePageId, { isFavorite: !page.isFavorite })
                }
                className={cn(
                  "goose-interactive relative grid min-h-[40px] grid-cols-[20px_minmax(0,1fr)] items-center gap-1.5 rounded-[9px] border px-2 py-1 pr-5 text-left transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  page.isFavorite
                    ? "border-[var(--goose-interactive-selected-border)] bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                    : "border-[var(--goose-block-subtle-border)] bg-card text-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-[7px]",
                    page.isFavorite && "bg-[var(--goose-interactive-selected)]",
                  )}
                >
                  <LucideIcons.Star
                    className={cn(
                      "h-3.5 w-3.5 text-current",
                      page.isFavorite &&
                        "fill-[var(--goose-interactive-selected-fg)] text-[var(--goose-interactive-selected-fg)]",
                    )}
                  />
                </span>
                <span className="min-w-0 truncate text-xs font-medium">
                  {isLocalItem ? "收藏文件" : "收藏页面"}
                </span>
                {page.isFavorite && (
                  <LucideIcons.Check className="absolute right-1.5 top-1.5 h-3 w-3" />
                )}
              </button>

              <button
                type="button"
                aria-pressed={page.isPinned}
                onClick={() =>
                  updatePage(activePageId, { isPinned: !page.isPinned })
                }
                className={cn(
                  "goose-interactive relative grid min-h-[40px] grid-cols-[20px_minmax(0,1fr)] items-center gap-1.5 rounded-[9px] border px-2 py-1 pr-5 text-left transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  page.isPinned
                    ? "border-[var(--goose-interactive-selected-border)] bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                    : "border-[var(--goose-block-subtle-border)] bg-card text-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-[7px]",
                    page.isPinned && "bg-[var(--goose-interactive-selected)]",
                  )}
                >
                  <LucideIcons.Pin
                    className={cn(
                      "h-3.5 w-3.5 text-current",
                      page.isPinned &&
                        "fill-[var(--goose-interactive-selected-fg)] text-[var(--goose-interactive-selected-fg)]",
                    )}
                  />
                </span>
                <span className="min-w-0 truncate text-xs font-medium">
                  置顶页面
                </span>
                {page.isPinned && (
                  <LucideIcons.Check className="absolute right-1.5 top-1.5 h-3 w-3" />
                )}
              </button>
            </div>

            {/* 页面锁定同属页面状态，连续呈现，避免用分割线制造多余层级。 */}
            <div
              role="button"
              tabIndex={0}
              className="group grid min-h-[32px] cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-1.5 rounded-[9px] px-2 text-xs hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              onClick={() =>
                updatePage(activePageId, { isLocked: !page.isLocked })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  updatePage(activePageId, { isLocked: !page.isLocked });
                }
              }}
            >
              <LucideIcons.Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-[var(--goose-interactive-hover-fg)]" />
              <span className="min-w-0 truncate">锁定页面</span>
              <Switch
                aria-label="锁定页面"
                checked={page.isLocked}
                onCheckedChange={(checked) =>
                  updatePage(activePageId, { isLocked: checked })
                }
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </section>

          {canOpenInNewWindow && activeTab ? (
            <PopoverAction
              className="group grid min-h-[32px] grid-cols-[18px_minmax(0,1fr)] gap-x-1.5 px-2 text-xs"
              onSelect={() => {
                void (async () => {
                  const created = await createDesktopWindow({
                    mode: "currentTab",
                    tab: {
                      id: activeTab.id,
                      pageId: activeTab.pageId,
                      type: activeTab.type,
                      pinned: activeTab.pinned,
                      workspaceId: activeTab.workspaceId,
                    },
                  });
                  if (created?.windowId) {
                    detachTabFromThisWindow(activeTab.id, created.windowId);
                  }
                })();
              }}
            >
              <LucideIcons.AppWindow className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
              <span className="min-w-0 truncate">在新窗口打开</span>
            </PopoverAction>
          ) : null}

          {/* Import */}
          <div>
            <PopoverAction
              className="group grid min-h-[32px] grid-cols-[18px_minmax(0,1fr)] gap-x-1.5 px-2 text-xs"
              onSelect={handleImport}
            >
              <LucideIcons.Upload className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
              <span className="min-w-0 truncate">导入</span>
            </PopoverAction>
          </div>

          {/* Generate Image — standalone, before Export */}
          <PopoverAction
            className="page-menu-generate-image grid min-h-[32px] grid-cols-[18px_minmax(0,1fr)] gap-x-1.5 px-2 text-xs text-foreground"
            onSelect={() => {
              setThemeSelectorOpen(true);
            }}
          >
            <LucideIcons.Image className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="page-menu-shimmer-text min-w-0 truncate font-medium text-foreground">
              {selectedBlocks.length > 0 ? "生成选中图片" : "生成图片"}
            </span>
          </PopoverAction>

          {/* Export submenu */}
          <div className="w-full">
            <PageExportSubmenu
              enabled={pageMenuOpen}
              viewportHeight={viewport.height}
              onExportMarkdown={() =>
                runExport("Markdown", () => exportToMarkdown(page))
              }
              onExportHtml={() => runExport("HTML", () => exportToHTML(page))}
              onExportWord={() => runExport("Word", () => exportToWord(page))}
              onExportPdf={() => runExport("PDF", () => exportToPDF(page))}
            />

            <PopoverAction
              className="group grid min-h-[32px] grid-cols-[18px_minmax(0,1fr)] gap-x-1.5 px-2 text-xs"
              disabled={page?.isFolder}
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
              <LucideIcons.History className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
              <span className="min-w-0 truncate">页面历史</span>
            </PopoverAction>
          </div>

          <PopoverAction
            className="group grid min-h-[32px] grid-cols-[18px_minmax(0,1fr)] gap-x-1.5 px-2 text-xs text-foreground hover:text-[var(--goose-color-danger-focus)] focus:text-[var(--goose-color-danger-focus)]"
            onClick={() => void deletePageWithUndo(activePageId)}
          >
            {isLocalItem ? (
              <LucideIcons.FileX className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-color-danger-focus)]" />
            ) : (
              <LucideIcons.Trash2 className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-color-danger-focus)]" />
            )}
            <span className="min-w-0 truncate">
              {isLocalItem ? "移到系统回收站" : "删除"}
            </span>
          </PopoverAction>

          <div className="mx-1 mt-1 h-px bg-border" />

          <div className="flex items-center justify-between gap-3 px-2 py-1 text-[10px] text-muted-foreground">
            <span>{countWords(page.content)} 字</span>
            <span className="min-w-0 truncate text-right">
              编辑于 {new Date(page.updatedAt).toLocaleString("zh-CN")}
            </span>
          </div>
        </PopoverContent>
      </Popover>

      <ImageExportThemeSelector
        open={themeSelectorOpen}
        onOpenChange={setThemeSelectorOpen}
        onConfirm={handleThemeConfirm}
        mode={selectedBlocks.length > 0 ? "selection" : "page"}
        page={page}
        blocks={selectedBlocks}
      />
    </>
  );
}
