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
  return (
    <div className="h-12 flex items-center justify-between px-3 border-b bg-gradient-to-b from-background/90 via-background/80 to-background/70 dark:from-background/80 dark:via-background/70 dark:to-background/60 backdrop-blur-md dark:backdrop-blur-xl sticky top-0 z-10 shrink-0">
      <div className="flex items-center text-sm text-muted-foreground dark:text-muted-foreground/70 gap-2 overflow-hidden">
        <span className="truncate max-w-[200px]">
          {getPageTitle(page)}
        </span>
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
        <button
          onClick={onClose}
          className="p-1 hover:bg-gradient-to-br hover:from-muted/60 hover:to-muted/40 rounded text-muted-foreground/70 dark:text-muted-foreground/55 hover:text-foreground dark:hover:text-foreground/85 transition-all duration-200"
          title="关闭页面"
        >
          <LucideIcons.X className="h-4 w-4" />
        </button>

        {!page.trashedAt && (
          <button
            onClick={onToggleFavorite}
            className="p-1 hover:bg-gradient-to-br hover:from-muted/60 hover:to-muted/40 rounded transition-all duration-200 text-muted-foreground/70 dark:text-muted-foreground/55 hover:text-foreground dark:hover:text-foreground/85"
            title={page.isFavorite ? "取消收藏" : "收藏页面"}
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
