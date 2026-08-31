/**
 * Electron 桌面端全宽 overlay 顶栏（仅 __HOST_TARGET__ === "electron" 时挂载）。
 *
 * macOS 原生 traffic lights 叠在 webview 上（titleBarStyle=hiddenInset），
 * 因此整条顶栏用 -webkit-app-region: drag。左侧 padding 跟主栏左缘对齐
 * （侧栏宽 + stage 左垫 + gap），且不小于红绿灯占位（mac 78px / win 12px）。
 * 按钮/输入框天然挡住拖拽；标题闲置态按住拖窗口、单击才进入编辑。
 *
 * 内容从 PageHeader「提升」而来：侧栏折叠钮、标题（SingleTabTitle / 欢迎页「开始」）、
 * AI 钮、回收站恢复/删除、收藏/导出/历史快捷按钮、最右 PageMenu「...」。
 * 历史模式改渲染 HistoryToolbar（仍全宽）。uTools 构建不渲染本组件，PageHeader 保持原样。
 */
import * as LucideIcons from "lucide-react";
import type { Page } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import { usePages } from "@/stores/usePages";
import { useSidebarView } from "@/stores/useSidebarView";
import { useSettings } from "@/stores/useSettings";
import { useAiStatus } from "@/stores/useAiStatus";
import { useHistoryView } from "@/stores/useHistoryView";
import { flushEditorContent } from "@/stores/pages";
import {
  exportToHTML,
  exportToJSON,
  exportToMarkdown,
  exportToPDF,
} from "@/lib/export";
import { formatShortcut } from "@/lib/utils";
import {
  isFullscreenAiLayout,
  type NotebookAiLayoutMode,
} from "../notebook-ai/useNotebookAiPanel";
import { useAiHeaderActions } from "../notebook-ai/aiHeaderSlot";
import { HistoryToolbar } from "../history/HistoryView";
import { SingleTabTitle } from "./SingleTabTitle";
import { PageMenu } from "./PageMenu";

interface DesktopTitleBarProps {
  page?: Page;
  isWelcomeTab: boolean;
  inHistoryMode: boolean;
  onRestore?: () => void;
  onDelete?: () => void;
  aiPanelOpen?: boolean;
  aiLayoutMode?: NotebookAiLayoutMode;
  onToggleAiPanel?: () => void;
}

/** 与 PageHeader 一致的顶栏图标按钮样式。 */
const actionButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground/75 transition-colors duration-150 hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] aria-pressed:bg-[var(--goose-interactive-selected)] aria-pressed:text-[var(--goose-interactive-selected-fg)] aria-pressed:hover:bg-[var(--goose-interactive-selected)] aria-pressed:hover:text-[var(--goose-interactive-selected-fg)]";

export function DesktopTitleBar({
  page,
  isWelcomeTab,
  inHistoryMode,
  onRestore,
  onDelete,
  aiPanelOpen,
  aiLayoutMode = "fullscreen",
  onToggleAiPanel,
}: DesktopTitleBarProps) {
  const activePageId = usePages((s) => s.activePageId);
  const updatePage = usePages((s) => s.updatePage);
  const sidebarCollapsed = useSidebarView((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSidebarView((s) => s.toggleSidebarCollapsed);
  const appShortcuts = useSettings((s) => s.appShortcuts);
  const aiPhase = useAiStatus((s) => s.phase);
  const aiDoneToken = useAiStatus((s) => s.doneToken);
  const aiHeaderActions = useAiHeaderActions();

  const toggleSidebarShortcutLabel = appShortcuts.toggleSidebar
    ? formatShortcut(appShortcuts.toggleSidebar)
    : "";
  const toggleAiPanelShortcutLabel = appShortcuts.toggleAIPanel
    ? formatShortcut(appShortcuts.toggleAIPanel)
    : "";

  /** 全屏 AI 打开时：隐藏页面动作，改挂 AI 工具栏（与 PageHeader 一致）。 */
  const aiFullscreenOpen =
    Boolean(aiPanelOpen) && isFullscreenAiLayout(aiLayoutMode);

  const runExport = (label: string, task: () => Promise<unknown>) => {
    if (!page) return;
    if (page.isFolder) {
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

  const handleEnterHistory = () => {
    if (!activePageId || !page || page.isFolder) return;
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
  };

  if (inHistoryMode) {
    return (
      <div className="electron-titlebar w-full shrink-0">
        <HistoryToolbar />
      </div>
    );
  }

  const showPageActions = Boolean(page) && !page?.trashedAt;

  return (
    <div
      className="electron-titlebar flex h-11 w-full shrink-0 items-center gap-2 pr-3"
      data-electron-no-drag="false"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {sidebarCollapsed ? (
          <TooltipProvider delayDuration={600}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-[8px] text-muted-foreground/80 transition-colors hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)]"
                  onClick={toggleSidebarCollapsed}
                  aria-label="展开侧栏"
                >
                  <LucideIcons.PanelLeftOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>展开侧栏</span>
                  {toggleSidebarShortcutLabel && (
                    <span className="text-[11px] text-muted-foreground">
                      {toggleSidebarShortcutLabel}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}

        {page ? (
          <div className="min-w-0 flex-1">
            <SingleTabTitle
              key={`${page.id}:${page.localFilePath ?? ""}`}
              page={page}
              idleWindowDrag
            />
          </div>
        ) : (
          <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold text-foreground">
            {isWelcomeTab ? "开始" : "Goose Note"}
          </span>
        )}

        {page?.isLocked && (
          <span className="rounded bg-[var(--goose-color-lock-bg)] px-1.5 py-0.5 text-xs text-[var(--goose-color-lock-text)]">
            已锁定
          </span>
        )}
        {page?.trashedAt && (
          <span className="rounded bg-[var(--goose-color-lock-bg)] px-1.5 py-0.5 text-xs text-[var(--goose-color-lock-text)]">
            页面已被删除
          </span>
        )}
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-1">
        {onToggleAiPanel && !page?.trashedAt && (
          <TooltipProvider delayDuration={600}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn("ai-icon-button", actionButtonClass)}
                  data-ai-state={aiPhase}
                  onClick={onToggleAiPanel}
                  aria-label={aiPanelOpen ? "关闭 AI 面板" : "打开 AI 面板"}
                  aria-pressed={aiPanelOpen}
                >
                  <AiGradientIcon
                    key={aiPhase === "done" ? `done-${aiDoneToken}` : aiPhase}
                    className="h-4 w-4"
                    state={aiPhase}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>{aiPanelOpen ? "关闭 AI 面板" : "打开 AI 面板"}</span>
                  {toggleAiPanelShortcutLabel && (
                    <span className="text-[11px] text-muted-foreground">
                      {toggleAiPanelShortcutLabel}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {page?.trashedAt && onRestore && onDelete && (
          <>
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onRestore}
                    type="button"
                    aria-label="恢复页面"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[8px] bg-[var(--goose-interactive-selected)] text-[hsl(var(--foreground))] transition-colors hover:bg-[var(--goose-color-restore-hover)] hover:text-white"
                  >
                    <LucideIcons.RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">恢复页面</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onDelete}
                    type="button"
                    aria-label="永久删除页面"
                    size="icon"
                    className="h-8 w-8 rounded-[8px] bg-[var(--goose-interactive-selected)] text-[hsl(var(--foreground))] transition-colors hover:bg-[var(--goose-color-danger-hover)] hover:text-white"
                  >
                    <LucideIcons.Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">永久删除</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {aiFullscreenOpen ? (
          aiHeaderActions
        ) : showPageActions && page && activePageId ? (
          <>
            {/* 收藏快捷按钮（...菜单里仍保留收藏项，这里只是桌面端顶栏的快捷入口） */}
            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={actionButtonClass}
                    aria-label={page.isFavorite ? "取消收藏" : "收藏页面"}
                    aria-pressed={Boolean(page.isFavorite)}
                    onClick={() =>
                      updatePage(activePageId, {
                        isFavorite: !page.isFavorite,
                      })
                    }
                  >
                    <LucideIcons.Star
                      className={cn(
                        "h-4 w-4",
                        page.isFavorite &&
                          "fill-[var(--goose-color-favorite)] text-[var(--goose-color-favorite)]",
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {page.isFavorite ? "取消收藏" : "收藏页面"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <TooltipProvider delayDuration={600}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          actionButtonClass,
                          "outline-none data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]",
                        )}
                        aria-label="导出"
                      >
                        <LucideIcons.Download className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">导出</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent
                className="min-w-[144px] rounded-[12px] p-1"
                align="end"
                sideOffset={4}
                collisionPadding={8}
              >
                <DropdownMenuItem
                  className="group grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                  onSelect={() => runExport("JSON", () => exportToJSON(page))}
                >
                  <LucideIcons.FileJson className="h-3.5 w-3.5 text-muted-foreground group-data-[highlighted]:text-[var(--goose-interactive-selected-fg)]" />
                  <span className="min-w-0 truncate">JSON</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="group grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                  onSelect={() =>
                    runExport("Markdown", () => exportToMarkdown(page))
                  }
                >
                  <LucideIcons.FileCode className="h-3.5 w-3.5 text-muted-foreground group-data-[highlighted]:text-[var(--goose-interactive-selected-fg)]" />
                  <span className="min-w-0 truncate">Markdown</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="group grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                  onSelect={() => runExport("HTML", () => exportToHTML(page))}
                >
                  <LucideIcons.FileType className="h-3.5 w-3.5 text-muted-foreground group-data-[highlighted]:text-[var(--goose-interactive-selected-fg)]" />
                  <span className="min-w-0 truncate">HTML</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="group grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 text-xs"
                  onSelect={() => runExport("PDF", () => exportToPDF(page))}
                >
                  <LucideIcons.FileText className="h-3.5 w-3.5 text-muted-foreground group-data-[highlighted]:text-[var(--goose-interactive-selected-fg)]" />
                  <span className="min-w-0 truncate">PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider delayDuration={600}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={actionButtonClass}
                    aria-label="页面历史"
                    disabled={page.isFolder}
                    onClick={handleEnterHistory}
                  >
                    <LucideIcons.History className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">页面历史</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <PageMenu />
          </>
        ) : null}
      </div>
    </div>
  );
}
