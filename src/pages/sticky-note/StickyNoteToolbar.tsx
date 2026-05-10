import { useCallback } from "react";
import type { Page } from "@/types";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

interface StickyNoteToolbarProps {
  page: Page;
  pageId: string;
  onClose: () => void;
  onSwitchPage: () => void;
  onOpenInWorkspace: () => void;
}

export function StickyNoteToolbar({
  page,
  pageId,
  onClose,
  onSwitchPage,
  onOpenInWorkspace,
}: StickyNoteToolbarProps) {
  const handleSwitchPage = () => {
    trackEvent("sticky_note_switch_page", {
      feature: "sticky_note",
      action: "switch_page",
      from_page_id: pageId,
    });
    onSwitchPage();
  };
  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  return (
    <div
      className={cn(
        "shrink-0 px-3 py-2 border-t border-border/40",
        "flex items-center justify-between gap-2",
        "bg-background/80 backdrop-blur-sm",
      )}
    >
      {/* 左侧：笔记信息 */}
      <div className="flex items-center gap-2 min-w-0">
        <LucideIcons.Clock className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground truncate">
          更新于 {formatTime(page.updatedAt)}
        </span>
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 px-2"
          onClick={handleSwitchPage}
        >
          <LucideIcons.ArrowLeftRight className="h-3 w-3" />
          切换
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 px-2"
          onClick={onOpenInWorkspace}
        >
          <LucideIcons.Maximize2 className="h-3 w-3" />
          工作区
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <LucideIcons.X className="h-3 w-3" />
          关闭
        </Button>
      </div>
    </div>
  );
}
