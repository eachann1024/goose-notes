import type { Page } from "@/types";
import { PageMenu } from "./PageMenu";
import { getPageTitle } from "@/lib/page-title";

interface PageHeaderProps {
  page: Page;
  onClose: () => void;
  onToggleFavorite: () => void;
}

export function PageHeader({
  page,
  onClose,
  onToggleFavorite,
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
    <div className="workspace-divider h-12 flex items-center justify-between px-3 border-b bg-background/96 dark:bg-background/94 backdrop-blur-[1px] sticky top-0 z-10 shrink-0">
      <div className="flex items-center text-sm text-muted-foreground dark:text-muted-foreground/70 gap-2 overflow-hidden">
        <span className="truncate max-w-[200px]">
          {getPageTitle(page)}
        </span>
        {showSaved && (
          <LucideIcons.Check className="h-3.5 w-3.5 text-green-500 animate-in fade-in duration-200" />
        )}
        {page.isLocked && (
          <span className="text-xs bg-gradient-to-r from-muted/80 to-muted/60 px-1.5 py-0.5 rounded">已锁定</span>
        )}
        {page.trashedAt && (
          <span className="text-xs bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded">
            只读
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!page.trashedAt && (
          <button
            onClick={onClose}
            className={actionButtonClass}
            title={isLocalItem ? "关闭文件" : "关闭页面"}
          >
            <LucideIcons.X className="h-4 w-4" />
          </button>
        )}

        {!page.trashedAt && (
          <button
            onClick={onToggleFavorite}
            className={actionButtonClass}
            title={
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
        )}

        {!page.trashedAt && <PageMenu />}
      </div>
    </div>
  );
}
