/**
 * Electron 桌面端全宽 overlay 顶栏（仅 __HOST_TARGET__ === "electron" 时挂载）。
 *
 * macOS 原生 traffic lights 叠在 webview 上（titleBarStyle=hiddenInset），
 * 因此整条顶栏用 -webkit-app-region: drag。左侧 padding 跟主栏左缘对齐
 * （侧栏宽 + stage 左垫 + gap），且不小于红绿灯占位（mac 78px / win 12px）。
 * 按钮/输入框天然挡住拖拽；标签 pill 标 data-electron-no-drag，轨空白保持 drag。
 *
 * 内容从 PageHeader「提升」而来：侧栏折叠钮、AI 钮、TabRail、回收站恢复/删除、PageMenu。
 * 收藏、导出、页面置顶和页面历史收在 PageMenu 内。窗口控制位于侧栏上方。
 * 历史模式改渲染 HistoryToolbar（仍全宽）。
 * 非 Electron 构建不渲染本组件，PageHeader 保持原样。
 */
import * as LucideIcons from "lucide-react";
import { useWindowAlwaysOnTop } from "@/hooks/useWindowAlwaysOnTop";
import type { Page } from "@/types";
import { cn, formatShortcut } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import { usePages } from "@/stores/usePages";
import { useSidebarView } from "@/stores/useSidebarView";
import { useEffectiveSidebarCollapsed } from "@/hooks/useWorkspaceViewportCollapse";
import { useSettings } from "@/stores/useSettings";
import { useAiStatus } from "@/stores/useAiStatus";
import {
  isFullscreenAiLayout,
  type NotebookAiLayoutMode,
} from "../notebook-ai/useNotebookAiPanel";
import {
  useAiHeaderActions,
  useAiHeaderTitle,
} from "../notebook-ai/aiHeaderSlot";
import { ConversationTitle } from "../notebook-ai/ConversationTitle";
import { HistoryToolbar } from "../history/HistoryView";
import { PageIconButton } from "./PageIconButton";
import { PageMenu } from "./PageMenu";
import { TabRail } from "./TabRail";
import { canCustomizePageIcon } from "@/pages/workspace/components/sidebar/local-file-icon";
import { useNotebooks } from "@/stores/useNotebooks";

interface DesktopTitleBarProps {
  page?: Page;
  isWelcomeTab: boolean;
  inHistoryMode: boolean;
  onOpenSearch: () => void;
  onBeforeActivateTab?: () => void;
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
  isWelcomeTab: _isWelcomeTab,
  inHistoryMode,
  onOpenSearch,
  onBeforeActivateTab,
  onRestore,
  onDelete,
  aiPanelOpen,
  aiLayoutMode = "fullscreen",
  onToggleAiPanel,
}: DesktopTitleBarProps) {
  const { alwaysOnTop, toggleAlwaysOnTop } = useWindowAlwaysOnTop();
  const activePageId = usePages((s) => s.activePageId);
  const notebooks = useNotebooks((s) => s.notebooks);
  const sidebarCollapsed = useEffectiveSidebarCollapsed();
  const toggleSidebarCollapsed = useSidebarView(
    (s) => s.toggleSidebarCollapsed,
  );
  const appShortcuts = useSettings((s) => s.appShortcuts);
  const theme = useSettings((s) => s.theme);
  const toggleDarkMode = useSettings((s) => s.toggleDarkMode);
  const themeLabel =
    theme === "system"
      ? "跟随系统"
      : theme === "dark"
        ? "深色模式"
        : "浅色模式";
  const ThemeIcon =
    theme === "system"
      ? LucideIcons.Laptop
      : theme === "dark"
        ? LucideIcons.Moon
        : LucideIcons.Sun;
  const aiPhase = useAiStatus((s) => s.phase);
  const aiDoneToken = useAiStatus((s) => s.doneToken);
  const aiHeaderActions = useAiHeaderActions();
  const aiHeaderTitle = useAiHeaderTitle();

  const toggleSidebarShortcutLabel = appShortcuts.toggleSidebar
    ? formatShortcut(appShortcuts.toggleSidebar)
    : "";
  const toggleAiPanelShortcutLabel = appShortcuts.toggleAIPanel
    ? formatShortcut(appShortcuts.toggleAIPanel)
    : "";

  const aiFullscreenOpen =
    Boolean(aiPanelOpen) && isFullscreenAiLayout(aiLayoutMode);

  const windowControls = (
    <div
      className="electron-window-controls flex shrink-0 items-center gap-2"
      data-electron-no-drag
    >
      <TooltipProvider delayDuration={600}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={actionButtonClass}
              onClick={toggleAlwaysOnTop}
              aria-label={alwaysOnTop ? "取消窗口置顶" : "窗口置顶"}
              aria-pressed={alwaysOnTop}
            >
              <LucideIcons.Pin
                className={cn("h-4 w-4", alwaysOnTop && "fill-current")}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {alwaysOnTop ? "取消窗口置顶" : "窗口置顶"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={actionButtonClass}
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
              aria-pressed={sidebarCollapsed}
            >
              <LucideIcons.PanelLeft className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>{sidebarCollapsed ? "展开侧栏" : "收起侧栏"}</span>
            {toggleSidebarShortcutLabel && (
              <span className="ml-2 text-[11px] text-muted-foreground">
                {toggleSidebarShortcutLabel}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  if (inHistoryMode) {
    return (
      <div
        className="electron-titlebar w-full shrink-0"
        data-sidebar-collapsed={sidebarCollapsed}
      >
        {windowControls}
        <HistoryToolbar />
      </div>
    );
  }

  const showPageActions = Boolean(page) && !page?.trashedAt;
  const showPageIcon = Boolean(
    page &&
    canCustomizePageIcon(
      page,
      notebooks[page.workspaceId]?.source === "local-folder",
    ),
  );

  const titleBarRow = (
    <div className="flex min-w-0 w-full flex-1 items-center justify-between">
      <div
        className={cn(
          "min-w-0 flex-1 items-center gap-2 overflow-hidden",
          "flex",
        )}
      >
        {onToggleAiPanel && !page?.trashedAt && (
          <TooltipProvider delayDuration={600}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "ai-icon-button shrink-0",
                    actionButtonClass,
                    "text-foreground",
                  )}
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

        {!aiFullscreenOpen && showPageIcon && page && !page.trashedAt ? (
          <div data-electron-no-drag className="shrink-0">
            <PageIconButton page={page} />
          </div>
        ) : null}

        {aiFullscreenOpen ? (
          <div
            className="tab-rail flex min-w-0 flex-1 items-center"
            role="tablist"
            aria-label="AI 会话"
          >
            <div
              role="tab"
              aria-selected="true"
              tabIndex={0}
              className="tab-rail-item flex min-w-0 flex-1 items-center px-2 text-foreground"
            >
              <ConversationTitle
                summary={aiHeaderTitle ?? "新会话"}
                muted={false}
              />
            </div>
          </div>
        ) : (
          <TabRail
            variant="electron-titlebar"
            page={page}
            onOpenSearch={onOpenSearch}
            onBeforeActivateTab={onBeforeActivateTab}
            aiPanelOpen={aiPanelOpen}
            aiLayoutMode={aiLayoutMode}
          />
        )}

        {!aiFullscreenOpen && page?.isLocked && (
          <span className="rounded bg-[var(--goose-color-lock-bg)] px-1.5 py-0.5 text-xs text-[var(--goose-color-lock-text)]">
            已锁定
          </span>
        )}
        {!aiFullscreenOpen && page?.trashedAt && (
          <span className="rounded bg-[var(--goose-color-lock-bg)] px-1.5 py-0.5 text-xs text-[var(--goose-color-lock-text)]">
            页面已被删除
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
          <PageMenu />
        ) : null}
        <TooltipProvider delayDuration={600}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={actionButtonClass}
                onClick={toggleDarkMode}
                aria-label={`外观：${themeLabel}`}
              >
                <ThemeIcon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">外观：{themeLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={actionButtonClass}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("goose-note:open-settings"),
                  )
                }
                aria-label="设置"
              >
                <LucideIcons.Settings className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">设置</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );

  return (
    <div
      className="electron-titlebar flex w-full shrink-0 items-center gap-2 pr-3"
      data-ai-conversation-header={aiFullscreenOpen || undefined}
      data-sidebar-collapsed={sidebarCollapsed}
    >
      {windowControls}
      {titleBarRow}
    </div>
  );
}
