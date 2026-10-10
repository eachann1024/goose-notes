import * as GooseIcons from "@/components/ui/icons";
import { Popover, PopoverTrigger, PopoverContent, PopoverAction } from "@/components/ui/popover";
import { FontSelector } from "@/pages/workspace/components/shared/FontSelector";
import "./page-menu.css";
import { ImageExportThemeSelector } from "@/components/ui/image-export-theme-selector";
import { useHistoryView } from "@/stores/useHistoryView";
import { deletePageWithUndo } from "@/lib/page-delete-actions";
import { cn } from "@/lib/utils";
import { normalizePageLayout } from "@/lib/local-frontmatter";
import { createDesktopWindow } from "@/lib/electron/windowContext";
import { detachTabFromThisWindow } from "@/lib/electron/detachTab";

import { PageExportSubmenu } from "./page-menu/PageExportSubmenu";
import { usePageMenu } from "./page-menu/usePageMenu";

export function PageMenu() {
  const {
    page, activePageId, viewport,
    defaultLayout, themeSelectorOpen, setThemeSelectorOpen,
    pageMenuOpen, setPageMenuOpen, selectedBlocks,
    isLocalItem, activeTab, canOpenInNewWindow,
    captureSelectedBlocks, handleImport, runExport,
    handleThemeConfirm, updatePage,
  } = usePageMenu();

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
            className="h-8 w-8 rounded-[8px] text-muted-foreground transition-colors duration-150 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]"
          >
            <GooseIcons.MoreHorizontal className="h-4 w-4" />
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
          {!page.isFolder && (
            <section aria-label="页面布局" className="px-1 py-2">
              <div className="px-1 pb-2 text-xs text-muted-foreground">正文宽度</div>
              <div className="grid grid-cols-2 gap-1" role="group" aria-label="选择当前笔记布局">
                {([
                  ["standard", "标准"],
                  ["full", "全宽"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={normalizePageLayout(page.pageLayout ?? defaultLayout) === value}
                    onClick={() => updatePage(activePageId, { pageLayout: value })}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs ",
                      normalizePageLayout(page.pageLayout ?? defaultLayout) === value
                        ? "border-[var(--goose-interactive-selected-border)] bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                        : "border-border hover:bg-[var(--goose-interactive-hover)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {page.pageLayout !== undefined && (
                <button
                  type="button"
                  className="mt-2 px-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => updatePage(activePageId, { pageLayout: undefined })}
                >
                  跟随默认宽度
                </button>
              )}
            </section>
          )}
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

          <div
            role="button"
            tabIndex={0}
            className="group grid min-h-[32px] cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-1.5 rounded-[9px] px-2 text-xs hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] "
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
            <GooseIcons.Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-[var(--goose-interactive-hover-fg)]" />
            <span className="min-w-0 truncate">锁定笔记</span>
            <Switch
              aria-label="锁定笔记"
              checked={page.isLocked}
              onCheckedChange={(checked) =>
                updatePage(activePageId, { isLocked: checked })
              }
              onClick={(e) => e.stopPropagation()}
            />
          </div>

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
              <GooseIcons.AppWindow className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
              <span className="min-w-0 truncate">在新窗口打开</span>
            </PopoverAction>
          ) : null}

          {/* Import */}
          <div>
            <PopoverAction
              className="group grid min-h-[32px] grid-cols-[18px_minmax(0,1fr)] gap-x-1.5 px-2 text-xs"
              onSelect={handleImport}
            >
              <GooseIcons.Upload className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
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
            <GooseIcons.Image className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="page-menu-shimmer-text min-w-0 truncate font-medium text-foreground">
              {selectedBlocks.length > 0 ? "导出所选为图片" : "导出为图片"}
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
              <GooseIcons.History className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
              <span className="min-w-0 truncate">历史版本</span>
            </PopoverAction>
          </div>

          <PopoverAction
            className="group grid min-h-[32px] grid-cols-[18px_minmax(0,1fr)] gap-x-1.5 px-2 text-xs text-foreground hover:text-[var(--goose-color-danger-focus)] focus:text-[var(--goose-color-danger-focus)]"
            onClick={() => void deletePageWithUndo(activePageId)}
          >
            {isLocalItem ? (
              <GooseIcons.FileX className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-color-danger-focus)]" />
            ) : (
              <GooseIcons.Trash2 className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-color-danger-focus)]" />
            )}
            <span className="min-w-0 truncate">
              {isLocalItem ? "移到废纸篓" : "移入回收站"}
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
