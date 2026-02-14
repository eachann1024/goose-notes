import type { Page } from "@/types";
import { PageMenu } from "./PageMenu";
import { getPageTitle } from "@/lib/page-title";

interface PageHeaderProps {
  page: Page;
  onOpenSearch: () => void;
  onToggleFavorite: () => void;
  onTogglePinned: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}

export function PageHeader({
  page,
  onOpenSearch,
  onToggleFavorite,
  onTogglePinned,
  onRestore,
  onDelete,
}: PageHeaderProps) {
  const isLocalItem = !!page.localFilePath;
  const { lastSavedAt, getPage } = usePages();
  const {
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeTabsToLeft,
    closeTabsToRight,
  } = useTabs();
  const { closeTabShortcut } = useSettings();
  const [showSaved, setShowSaved] = useState(false);
  const tabsScrollerRef = useRef<HTMLDivElement>(null);
  const closeTabShortcutLabel = closeTabShortcut
    ? formatShortcut(closeTabShortcut)
    : "未设置";
  const searchShortcuts = `${formatShortcut("Mod+K")} / ${formatShortcut("Mod+P")}`;

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
    "inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground/70 dark:text-muted-foreground/55 transition-colors duration-150 hover:bg-muted/65 dark:hover:bg-muted/45 hover:text-foreground dark:hover:text-foreground/85";

  return (
    <div className="workspace-divider h-12 flex items-center justify-between px-3 bg-[hsl(var(--goose-shell-bg))] sticky top-0 z-10 shrink-0">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <div
          ref={tabsScrollerRef}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onWheel={handleTabsWheel}
        >
          {openTabs.map((tab, tabIndex) => {
            const tabPage = getPage(tab.pageId);
            if (!tabPage) return null;
            const isActive = activeTabId === tab.id;
            const hasLeftTabs = tabIndex > 0;
            const hasRightTabs = tabIndex < openTabs.length - 1;
            const hasOtherTabs = openTabs.length > 1;

            return (
              <ContextMenu key={tab.id}>
                <ContextMenuTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveTab(tab.id);
                      }
                    }}
                    className={cn(
                      "group flex h-8 max-w-[150px] shrink-0 items-center gap-1 rounded-[8px] px-2 text-sm transition-colors",
                      isActive
                        ? "bg-[var(--goose-interactive-selected)] text-foreground"
                        : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
                    )}
                    title={getPageTitle(tabPage)}
                  >
                    <span className="min-w-0 flex-1 truncate">{getPageTitle(tabPage)}</span>
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
                            onClick={(event) => {
                              event.stopPropagation();
                              closeTab(tab.id);
                            }}
                            aria-label="关闭标签页"
                          >
                            <LucideIcons.X className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        {/*<TooltipContent side="bottom">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {closeTabShortcutLabel}
                        </span>
                      </div>
                    </TooltipContent>*/}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-[200px]">
                  <ContextMenuItem onSelect={() => closeTab(tab.id)}>
                    关闭
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => closeOtherTabs(tab.id)}
                    disabled={!hasOtherTabs}
                  >
                    关闭其他标签页
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => closeTabsToLeft(tab.id)}
                    disabled={!hasLeftTabs}
                  >
                    关闭左侧标签页
                  </ContextMenuItem>
                  <ContextMenuItem
                    onSelect={() => closeTabsToRight(tab.id)}
                    disabled={!hasRightTabs}
                  >
                    关闭右侧标签页
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}

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
