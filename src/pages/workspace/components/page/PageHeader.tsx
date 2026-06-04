import type { Page } from "@/types";
import type { TabItem } from "@/stores/useTabs";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AiGradientIcon } from "@/components/ui/ai-gradient-icon";
import { useAiStatus } from "@/stores/useAiStatus";
import { useSidebarView } from "@/stores/useSidebarView";
import { PageMenu } from "./PageMenu";
import { getPageTitle } from "@/components/editor/utils/page-title";

interface SortableTabItemProps {
  tab: TabItem;
  tabPage: Page;
  isActive: boolean;
  isDirty: boolean;
  hasLeftTabs: boolean;
  hasRightTabs: boolean;
  hasOtherTabs: boolean;
  closeTabShortcutLabel: string;
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseLeft: () => void;
  onCloseRight: () => void;
  onTogglePin: () => void;
}

function SortableTabItem({
  tab,
  tabPage,
  isActive,
  isDirty,
  hasLeftTabs,
  hasRightTabs,
  hasOtherTabs,
  closeTabShortcutLabel,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseLeft,
  onCloseRight,
  onTogglePin,
}: SortableTabItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tab.id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onClick={onActivate}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onActivate();
            }
          }}
          className={cn(
            "group flex h-8 max-w-[150px] shrink-0 items-center gap-1 rounded-[8px] px-2 text-sm transition-colors",
            isDragging && "opacity-60",
            isActive
              ? "bg-[var(--goose-interactive-selected)] text-foreground"
              : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
          )}
        >
          {tab.pinned && (
            <LucideIcons.Pin
              aria-label="已固定"
              className="h-3 w-3 shrink-0 text-primary"
            />
          )}
          {isDirty && (
            <span
              aria-label="未保存"
              className="h-2 w-2 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400"
            />
          )}
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              isDirty && "font-medium italic",
            )}
          >
            {getPageTitle(tabPage)}
          </span>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-[6px] p-0 transition-colors",
                    isActive
                      ? "text-foreground/70 hover:bg-white hover:text-foreground"
                      : "text-muted-foreground/70 hover:bg-white hover:text-foreground",
                  )}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                  }}
                  aria-label="关闭标签页"
                >
                  <LucideIcons.X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>关闭标签页</span>
                  <span className="text-[11px] text-muted-foreground">
                    {closeTabShortcutLabel}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[200px]">
        <ContextMenuItem onSelect={onTogglePin}>
          {tab.pinned ? "取消固定" : "固定标签"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onClose}>
          关闭
          <span className="ml-auto text-xs text-muted-foreground">
            {closeTabShortcutLabel}
          </span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseOthers} disabled={!hasOtherTabs}>
          关闭其他标签页
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseLeft} disabled={!hasLeftTabs}>
          关闭左侧标签页
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseRight} disabled={!hasRightTabs}>
          关闭右侧标签页
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}


interface PageHeaderProps {
  page: Page;
  isAiPageOpen?: boolean;
  onToggleAiPage?: () => void;
  onExitAiPage?: () => void;
  onOpenSearch: () => void;
  onToggleFavorite: () => void;
  onTogglePinned: () => void;
  onRestore?: () => void;
  onDelete?: () => void;

}

export function PageHeader({
  page,
  isAiPageOpen = false,
  onToggleAiPage,
  onExitAiPage,
  onOpenSearch,
  onToggleFavorite,
  onTogglePinned,
  onRestore,
  onDelete,

}: PageHeaderProps) {
  const aiEnabled = useSettings((state) => state.ai.enabled);
  const aiPhase = useAiStatus((state) => state.phase);
  const aiDoneToken = useAiStatus((state) => state.doneToken);
  const isLocalItem = !!page.localFilePath;
  const { lastSavedAt, getPage } = usePages();
  const dirtyLocalPageIds = usePages((state) => state.dirtyLocalPageIds);
  const isTabDirty = (tabPageId: string) =>
    Boolean(dirtyLocalPageIds?.[tabPageId]);
  const {
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeTabsToLeft,
    closeTabsToRight,
    reorderTabs,
    togglePinTab,
  } = useTabs();
  const { closeTabShortcut } = useSettings();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const handleTabDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = openTabs.findIndex((tab) => tab.id === active.id);
    const to = openTabs.findIndex((tab) => tab.id === over.id);
    if (from === -1 || to === -1) return;
    reorderTabs(from, to);
  };
  const visibleTabs = openTabs.filter((tab) => {
    const tabPage = getPage(tab.pageId);
    return tabPage && !tabPage.trashedAt;
  });
  const [showSaved, setShowSaved] = useState(false);
  const tabsScrollerRef = useRef<HTMLDivElement>(null);
  const closeTabShortcutLabel = closeTabShortcut
    ? formatShortcut(closeTabShortcut)
    : "未设置";
  const searchShortcuts = `${formatShortcut("Mod+K")} / ${formatShortcut("Mod+P")}`;
  const sidebarCollapsed = useSidebarView((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSidebarView((s) => s.toggleSidebarCollapsed);
  const toggleSidebarShortcutLabel = formatShortcut("Alt+B");

  useEffect(() => {
    if (lastSavedAt && isLocalItem) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSavedAt, isLocalItem]);

  const handleTabsWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scroller = tabsScrollerRef.current;
    if (!scroller) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    scroller.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  const actionButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground/70 dark:text-muted-foreground/55 transition-colors duration-150 hover:bg-muted/65 dark:hover:bg-muted/45 hover:text-foreground dark:hover:text-foreground/85";

  return (
    <div className="workspace-divider h-12 flex items-center justify-between px-3 bg-[hsl(var(--goose-editor-bg))] sticky top-0 z-10 shrink-0">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {sidebarCollapsed ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-[8px] text-muted-foreground/80 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-foreground"
                  onClick={toggleSidebarCollapsed}
                  aria-label="展开侧栏"
                >
                  <LucideIcons.PanelLeftOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>展开侧栏</span>
                  <span className="text-[11px] text-muted-foreground">
                    {toggleSidebarShortcutLabel}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        {aiEnabled ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "ai-icon-button h-8 w-8 shrink-0 rounded-[8px] border transition-colors",
                    isAiPageOpen
                      ? "border-foreground/10 bg-[var(--goose-interactive-selected)]"
                      : "border-transparent hover:bg-[var(--goose-interactive-hover)]",
                  )}
                  data-ai-state={aiPhase}
                  onClick={onToggleAiPage}
                  aria-label={
                    aiPhase === "streaming"
                      ? "AI 正在生成"
                      : "打开 AI 页面"
                  }
                >
                  <AiGradientIcon
                    key={aiPhase === "done" ? `done-${aiDoneToken}` : aiPhase}
                    className="h-4 w-4"
                    state={aiPhase}
                  />
                  {aiPhase === "done" && (
                    <span
                      key={`rings-${aiDoneToken}`}
                      className="ai-icon-rings"
                      aria-hidden="true"
                    >
                      <span className="ai-icon-ring" />
                      <span className="ai-icon-ring ai-icon-ring--delayed" />
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">AI 页面</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}

        <div
          ref={tabsScrollerRef}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onWheel={handleTabsWheel}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleTabDragEnd}
          >
            <SortableContext
              items={visibleTabs.map((tab) => tab.id)}
              strategy={horizontalListSortingStrategy}
            >
              {visibleTabs.map((tab) => {
                const tabPage = getPage(tab.pageId);
                if (!tabPage) return null;
                const originalIndex = openTabs.findIndex((t) => t.id === tab.id);
                return (
                  <SortableTabItem
                    key={tab.id}
                    tab={tab}
                    tabPage={tabPage}
                    isActive={activeTabId === tab.id}
                    isDirty={isTabDirty(tab.pageId)}
                    hasLeftTabs={originalIndex > 0}
                    hasRightTabs={originalIndex < openTabs.length - 1}
                    hasOtherTabs={openTabs.length > 1}
                    closeTabShortcutLabel={closeTabShortcutLabel}
                    onActivate={() => {
                      onExitAiPage?.();
                      setActiveTab(tab.id);
                    }}
                    onClose={() => closeTab(tab.id)}
                    onCloseOthers={() => closeOtherTabs(tab.id)}
                    onCloseLeft={() => closeTabsToLeft(tab.id)}
                    onCloseRight={() => closeTabsToRight(tab.id)}
                    onTogglePin={() => togglePinTab(tab.id)}
                  />
                );
              })}
            </SortableContext>
          </DndContext>

          {openTabs.length === 0 && (
            <span className="truncate text-sm text-foreground/80">
              {getPageTitle(page)}
            </span>
          )}

          {!page.trashedAt && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-[7px] text-muted-foreground/70 hover:bg-muted/65 hover:text-foreground"
                    onClick={onOpenSearch}
                  >
                    <LucideIcons.Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="flex items-center gap-2">
                    <span>新标签页</span>
                    <span className="text-[11px] text-muted-foreground">
                      {searchShortcuts}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {showSaved && (
          <LucideIcons.Check className="h-3.5 w-3.5 text-green-500 animate-in fade-in duration-200" />
        )}
        {page.isLocked && (
          <span className="text-xs bg-yellow-300 text-yellow-950 px-1.5 py-0.5 rounded">已锁定</span>
        )}
        {page.trashedAt && (
          <span className="text-xs bg-yellow-300 text-yellow-950 px-1.5 py-0.5 rounded">
            页面已被删除
          </span>
        )}
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-1">
        {page.trashedAt && onRestore && onDelete && (
          <>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onRestore}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[8px] bg-foreground/10 text-white transition-colors hover:bg-amber-500/90 hover:text-white"
                  >
                    <LucideIcons.RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">恢复页面</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onDelete}
                    type="button"
                    size="icon"
                    className="h-8 w-8 rounded-[8px] bg-foreground/10 text-white transition-colors hover:bg-red-600 hover:text-white"
                  >
                    <LucideIcons.Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">永久删除</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {!page.trashedAt && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleFavorite}
                  className={actionButtonClass}
                  aria-label={
                    page.isFavorite
                      ? "取消收藏"
                      : isLocalItem
                        ? "收藏文件"
                        : "收藏页面"
                  }
                >
                  <LucideIcons.Star
                    className={cn(
                      "h-4 w-4 transition-colors",
                      page.isFavorite
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/70 dark:text-muted-foreground/55",
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {page.isFavorite
                  ? "取消收藏"
                  : isLocalItem
                    ? "收藏文件"
                    : "收藏页面"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {!page.trashedAt && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onTogglePinned}
                  className={cn(
                    actionButtonClass,
                    page.isPinned &&
                      "bg-[var(--goose-interactive-selected)] text-foreground",
                  )}
                  aria-label={page.isPinned ? "取消置顶" : "置顶页面"}
                >
                  <LucideIcons.Pin
                    className={cn(
                      "h-4 w-4 transition-colors",
                      page.isPinned
                        ? "text-primary"
                        : "text-muted-foreground/70 dark:text-muted-foreground/55",
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {page.isPinned ? "取消置顶" : "置顶页面"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {!page.trashedAt && <PageMenu />}
      </div>
    </div>
  );
}
