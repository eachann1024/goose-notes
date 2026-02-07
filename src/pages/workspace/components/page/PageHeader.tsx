import type { Page } from "@/types";
import { PageMenu } from "./PageMenu";
import { getPageTitle } from "@/lib/page-title";

interface PageHeaderProps {
  page: Page;
  onClose: () => void;
  onToggleFavorite: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}

export function PageHeader({
  page,
  onClose,
  onToggleFavorite,
  onRestore,
  onDelete,
}: PageHeaderProps) {
  const isLocalItem = !!page.localFilePath;
  const { lastSavedAt } = usePages();
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (lastSavedAt && isLocalItem) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSavedAt, isLocalItem]);

  const actionButtonClass =
    "inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground/70 dark:text-muted-foreground/55 transition-colors duration-150 hover:bg-muted/65 dark:hover:bg-muted/45 hover:text-foreground dark:hover:text-foreground/85";

  return (
    <div className="workspace-divider h-12 flex items-center justify-between px-3 bg-[hsl(var(--goose-shell-bg))] sticky top-0 z-10 shrink-0">
      <div className="flex items-center text-sm text-foreground/80 dark:text-foreground/80 gap-2 overflow-hidden">
        <span className="truncate max-w-[200px]">
          {getPageTitle(page)}
        </span>
        {showSaved && (
          <LucideIcons.Check className="h-3.5 w-3.5 text-green-500 animate-in fade-in duration-200" />
        )}
        {page.isLocked && (
          <span className="text-xs bg-yellow-300 text-yellow-950 px-1.5 py-0.5 rounded">已锁定</span>
        )}
        {page.trashedAt && (
          <span className="text-xs bg-yellow-300 text-yellow-950 px-1.5 py-0.5 rounded">
            只读
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
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
                  onClick={onClose}
                  className={actionButtonClass}
                  aria-label={isLocalItem ? "关闭文件" : "关闭页面"}
                >
                  <LucideIcons.X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isLocalItem ? "关闭文件" : "关闭页面"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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

        {!page.trashedAt && <PageMenu />}
      </div>
    </div>
  );
}
