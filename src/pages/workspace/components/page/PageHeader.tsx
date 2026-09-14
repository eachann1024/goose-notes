import type { Page } from "@/types";
import type { NotebookAiLayoutMode } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { isFullscreenAiLayout } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { useAiHeaderActions, useAiHeaderTitle } from "@/pages/workspace/components/notebook-ai/aiHeaderSlot";
import { ConversationTitle } from "@/pages/workspace/components/notebook-ai/ConversationTitle";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import { useAiStatus } from "@/stores/useAiStatus";
import { useSidebarView } from "@/stores/useSidebarView";
import { useEffectiveSidebarCollapsed } from "@/hooks/useWorkspaceViewportCollapse";
import { PageMenu } from "./PageMenu";
import { PageIconButton } from "./PageIconButton";
import { canCustomizePageIcon } from "@/pages/workspace/components/sidebar/local-file-icon";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { SingleTabTitle } from "./SingleTabTitle";
import { TabRail } from "./TabRail";
import { useEffectiveSingleTabMode } from "@/lib/tabMode";
import { cn, formatShortcut } from "@/lib/utils";

interface PageHeaderProps {
  page?: Page;
  onOpenSearch: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  /** AI 面板当前是否打开 */
  aiPanelOpen?: boolean;
  /** AI 打开方式：全屏时入口在标签栏最左（仅图标） */
  aiLayoutMode?: NotebookAiLayoutMode;
  /** 切换 AI 面板（传入时显示按钮，不传则不渲染） */
  onToggleAiPanel?: () => void;
  /** 激活普通标签前回调（全屏 AI 下点标签可退出全屏） */
  onBeforeActivateTab?: () => void;
  /** 分屏时隐藏单标签大标题，改用每格 chrome */
  hideDocumentTitle?: boolean;
}

export function PageHeader({
  page,
  onOpenSearch,
  onRestore,
  onDelete,
  aiPanelOpen,
  aiLayoutMode = "fullscreen",
  onToggleAiPanel,
  onBeforeActivateTab,
  hideDocumentTitle = false,
}: PageHeaderProps) {
  const aiPhase = useAiStatus((state) => state.phase);
  const aiDoneToken = useAiStatus((state) => state.doneToken);
  const notebooks = useNotebooks((state) => state.notebooks);
  const showPageIcon = Boolean(
    page &&
      canCustomizePageIcon(
        page,
        notebooks[page.workspaceId]?.source === "local-folder",
      ),
  );
  const { appShortcuts } = useSettings();
  const singleTabMode = useEffectiveSingleTabMode();
  const aiHeaderActions = useAiHeaderActions();
  const aiHeaderTitle = useAiHeaderTitle();
  const sidebarCollapsed = useEffectiveSidebarCollapsed();
  const userSidebarCollapsed = useSidebarView((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSidebarView(
    (s) => s.toggleSidebarCollapsed,
  );
  const toggleSidebarShortcutLabel = appShortcuts.toggleSidebar
    ? formatShortcut(appShortcuts.toggleSidebar)
    : "";
  const toggleAiPanelShortcutLabel = appShortcuts.toggleAIPanel
    ? formatShortcut(appShortcuts.toggleAIPanel)
    : "";
  const prevSidebarCollapsedRef = useRef(userSidebarCollapsed);
  const [sidebarExpandAttention, setSidebarExpandAttention] = useState(false);

  useEffect(() => {
    if (!prevSidebarCollapsedRef.current && userSidebarCollapsed) {
      setSidebarExpandAttention(true);
      const timer = window.setTimeout(() => {
        setSidebarExpandAttention(false);
      }, 4000);
      prevSidebarCollapsedRef.current = userSidebarCollapsed;
      return () => window.clearTimeout(timer);
    }
    prevSidebarCollapsedRef.current = userSidebarCollapsed;
  }, [userSidebarCollapsed]);

  const showAiOnTabRail =
    Boolean(onToggleAiPanel) && isFullscreenAiLayout(aiLayoutMode);
  const showAiOnActions =
    Boolean(onToggleAiPanel) && !isFullscreenAiLayout(aiLayoutMode);
  const aiFullscreenOpen =
    Boolean(aiPanelOpen) && isFullscreenAiLayout(aiLayoutMode);

  const actionButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground/75 transition-colors duration-150 hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] aria-pressed:bg-[var(--goose-interactive-selected)] aria-pressed:text-[var(--goose-interactive-selected-fg)] aria-pressed:hover:bg-[var(--goose-interactive-selected)] aria-pressed:hover:text-[var(--goose-interactive-selected-fg)]";

  return (
    <div
      className={cn(
        "workspace-divider sticky top-0 z-10 shrink-0 bg-[hsl(var(--goose-editor-bg))] px-3",
        aiFullscreenOpen
          ? "notebook-ai-page-header-stack rounded-[12px] py-1"
          : "flex h-12 items-center justify-between",
        aiPhase === "streaming" && "ai-header-nebula-streaming",
      )}
      data-ai-conversation-header={aiFullscreenOpen || undefined}
      data-ai-header-effect={aiPhase === "streaming" ? "nebula" : undefined}
    >
      {aiFullscreenOpen ? (
        <div className="flex min-w-0 items-center px-0.5">
          <ConversationTitle summary={aiHeaderTitle ?? "新会话"} />
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 items-center justify-between",
          aiFullscreenOpen ? "h-8 min-h-8 w-full" : "h-12 w-full",
        )}
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
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-[8px] text-muted-foreground/80 transition-colors hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)]",
                    sidebarExpandAttention && "sidebar-expand-attention",
                  )}
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

        {singleTabMode ? (
          page && !hideDocumentTitle ? (
            <>
              {showPageIcon ? <PageIconButton page={page} /> : null}
              <SingleTabTitle
                key={`${page.id}:${getPageTitle(page)}`}
                page={page}
              />
            </>
          ) : hideDocumentTitle ? null : (
            <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold text-foreground">
              开始
            </span>
          )
        ) : (
          <TabRail
            variant="page-header"
            page={page}
            onOpenSearch={onOpenSearch}
            onBeforeActivateTab={onBeforeActivateTab}
            aiPanelOpen={aiPanelOpen}
            aiLayoutMode={aiLayoutMode}
            onToggleAiPanel={onToggleAiPanel}
            showAiOnTabRail={showAiOnTabRail}
          />
        )}

        {page?.isLocked && (
          <span className="text-xs bg-[var(--goose-color-lock-bg)] text-[var(--goose-color-lock-text)] px-1.5 py-0.5 rounded">
            已锁定
          </span>
        )}
        {page?.trashedAt && (
          <span className="text-xs bg-[var(--goose-color-lock-bg)] text-[var(--goose-color-lock-text)] px-1.5 py-0.5 rounded">
            页面已被删除
          </span>
        )}
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-1">
        {showAiOnActions && !page?.trashedAt && (
          <TooltipProvider delayDuration={600}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "ai-icon-button",
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

        {!singleTabMode && showPageIcon && page && !page.trashedAt ? (
          <PageIconButton page={page} />
        ) : null}

        {aiFullscreenOpen ? (
          aiHeaderActions
        ) : page && !page.trashedAt ? (
          <PageMenu />
        ) : null}
      </div>
      </div>
    </div>
  );
}
