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
import { useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import * as GooseIcons from "@/components/ui/icons";
import { WinWindowControls } from "./WinWindowControls";
import type { Page } from "@/types";
import { cn, formatShortcut } from "@/lib/utils";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { bindIdleWindowDrag } from "@/lib/electron/windowDrag";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "@/components/ui/icons";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { useFileNavHistory } from "@/stores/useFileNavHistory";
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
import { PageMenu } from "./PageMenu";
import { TabRail } from "./TabRail";

interface DesktopTitleBarProps {
  page?: Page;
  settingsOpen?: boolean;
  sidebarCollapsedOverride?: boolean;
  onToggleSidebar?: () => void;
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
  "inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground transition-colors duration-150 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] aria-pressed:bg-[var(--goose-interactive-selected)] aria-pressed:text-[var(--goose-interactive-selected-fg)] aria-pressed:hover:bg-[var(--goose-interactive-selected)] aria-pressed:hover:text-[var(--goose-interactive-hover-fg)]";

export function DesktopTitleBar({
  page,
  settingsOpen = false,
  sidebarCollapsedOverride,
  onToggleSidebar,
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
  const activePageId = usePages((s) => s.activePageId);
  const workspaceSidebarCollapsed = useEffectiveSidebarCollapsed();
  const sidebarCollapsed = sidebarCollapsedOverride ?? workspaceSidebarCollapsed;
  const toggleSidebarCollapsed = useSidebarView(
    (s) => s.toggleSidebarCollapsed,
  );
  const appShortcuts = useSettings((s) => s.appShortcuts);
  const aiPhase = useAiStatus((s) => s.phase);
  const aiHeaderActions = useAiHeaderActions();
  const aiHeaderTitle = useAiHeaderTitle();
  const canGoBack = useFileNavHistory((s) => s.index > 0);
  const canGoForward = useFileNavHistory((s) => s.index >= 0 && s.index < s.entries.length - 1);

  const toggleSidebarShortcutLabel = appShortcuts.toggleSidebar
    ? formatShortcut(appShortcuts.toggleSidebar)
    : "";
  const toggleAiPanelShortcutLabel = appShortcuts.toggleAIPanel
    ? formatShortcut(appShortcuts.toggleAIPanel)
    : "";

  const aiFullscreenOpen =
    Boolean(aiPanelOpen) && isFullscreenAiLayout(aiLayoutMode);
  const aiSidePanelOpen = Boolean(aiPanelOpen) && !aiFullscreenOpen;

  // Win/Linux 均为 frameless：右侧渲染自定义 min/max/close 窗控。
  const isFramelessElectron =
    typeof navigator !== "undefined" && /Win|Linux/i.test(navigator.platform);
  // Linux 上 CSS 拖拽区不派发鼠标事件（index.css 已整体 no-drag），
  // 顶栏空白处改走 JS 拖拽，双击切换最大化/还原。
  const isLinuxElectron =
    typeof navigator !== "undefined" && /Linux/i.test(navigator.platform);

  const titleBarWindowDragRef = useRef(false);
  const isInteractiveTitleBarTarget = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, input, textarea, a, select, [role='button'], [role='tab'], [data-electron-no-drag]",
      ),
    );

  const onTitleBarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isLinuxElectron) return;
    if (event.button !== 0) return;
    if (isInteractiveTitleBarTarget(event.target)) return;
    bindIdleWindowDrag(event, titleBarWindowDragRef);
  };

  const onTitleBarDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isLinuxElectron) return;
    if (isInteractiveTitleBarTarget(event.target)) return;
    void getGooseDesktop()?.toggleMaximizeWindow?.();
  };

  const windowControls = (
    <div
      className="electron-window-controls flex shrink-0 items-center gap-1"
      data-electron-no-drag
    >
      <TooltipProvider delayDuration={600}>
        {[
          { label: "后退", Icon: GooseIcons.ArrowLeft, disabled: !canGoBack, onClick: () => { onBeforeActivateTab?.(); useTabs.getState().goBackTabHistory(); } },
          { label: "前进", Icon: GooseIcons.ArrowRight, disabled: !canGoForward, onClick: () => { onBeforeActivateTab?.(); useTabs.getState().goForwardTabHistory(); } },
        ].map(({ label, Icon, disabled, onClick }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button type="button" className={cn(actionButtonClass, "disabled:pointer-events-none disabled:text-disabled")} aria-label={label} disabled={disabled} onClick={onClick}>
                <Icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={actionButtonClass}
              onClick={onToggleSidebar ?? toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
              aria-pressed={sidebarCollapsed}
            >
              <GooseIcons.PanelLeft className="h-4 w-4" />
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
        className="electron-titlebar flex w-full shrink-0 items-center"
        data-sidebar-collapsed={sidebarCollapsed}
        onPointerDown={onTitleBarPointerDown}
        onDoubleClick={onTitleBarDoubleClick}
      >
        {windowControls}
        <HistoryToolbar />
        {isFramelessElectron ? <WinWindowControls /> : null}
      </div>
    );
  }

  const showPageActions = Boolean(page) && !page?.trashedAt;
  const titleBarRow = (
    <div className="electron-document-header relative flex min-w-0 w-full flex-1 items-center justify-between">
      <div
        className={cn(
          "min-w-0 flex-1 items-center gap-2 overflow-hidden",
          "flex",
        )}
      >
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
              className="tab-rail-item flex min-w-0 max-w-[560px] flex-1 items-center px-2 text-foreground"
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
            settingsOpen={settingsOpen}
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
                  <Sparkles className="h-4 w-4" />
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
                    className="h-8 w-8 rounded-[8px] bg-[var(--goose-interactive-selected)] text-[hsl(var(--foreground))] transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                  >
                    <GooseIcons.RotateCcw className="h-4 w-4" />
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
                    className="h-8 w-8 rounded-[8px] bg-[var(--goose-interactive-selected)] text-[hsl(var(--foreground))] transition-colors hover:bg-[var(--goose-color-danger-subtle-bg)] hover:text-[var(--goose-color-danger)]"
                  >
                    <GooseIcons.Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">永久删除</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {settingsOpen ? null : aiFullscreenOpen ? (
          aiHeaderActions
        ) : showPageActions && page && activePageId ? (
          <PageMenu />
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "electron-titlebar flex w-full shrink-0 items-center",
        isFramelessElectron ? "pr-0" : "pr-4",
      )}
      data-ai-conversation-header={aiFullscreenOpen || undefined}
      data-ai-side-panel={aiSidePanelOpen || undefined}
      data-sidebar-collapsed={sidebarCollapsed}
      onPointerDown={onTitleBarPointerDown}
      onDoubleClick={onTitleBarDoubleClick}
    >
      {windowControls}
      {titleBarRow}
      {aiSidePanelOpen && (
        <div className="electron-ai-header relative flex min-w-0 shrink-0 items-center gap-2 px-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">AI 助手</span>
          {aiHeaderActions}
        </div>
      )}
      {isFramelessElectron ? <WinWindowControls /> : null}
    </div>
  );
}
