import type { Page } from "@/types";
import { PageMenu } from "./PageMenu";

interface PageHeaderProps {
  page: Page;
  onClose: () => void;
  onToggleFavorite: () => void;
}

export function PageHeader({ page, onClose, onToggleFavorite }: PageHeaderProps) {
  return (
    <div className="h-12 flex items-center justify-between px-3 border-b bg-background sticky top-0 z-10 shrink-0">
      <div className="flex items-center text-sm text-muted-foreground gap-2 overflow-hidden">
        <span className="truncate max-w-[200px]">{page.title || "无标题"}</span>
        {page.isLocked && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">已锁定</span>
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
          className="p-1 hover:bg-muted rounded text-muted-foreground/70 hover:text-foreground transition-colors"
          title="关闭页面"
        >
          <LucideIcons.X className="h-4 w-4" />
        </button>

        <button
          onClick={onToggleFavorite}
          className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground/70 hover:text-foreground"
          title={page.isFavorite ? "取消收藏" : "收藏页面"}
        >
          <LucideIcons.Star
            className={cn(
              "h-4 w-4 transition-colors",
              page.isFavorite
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/70",
            )}
          />
        </button>

        {!page.trashedAt && <PageMenu />}
      </div>
    </div>
  );
}
