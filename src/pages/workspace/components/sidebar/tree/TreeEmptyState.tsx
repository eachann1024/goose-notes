import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TreeEmptyStateProps {
  isLocalNotebook: boolean;
  width: number;
  onCreatePage: () => void;
}

export function TreeEmptyState({
  isLocalNotebook,
  width,
  onCreatePage,
}: TreeEmptyStateProps) {
  const EmptyIcon = isLocalNotebook ? LucideIcons.FolderOpen : LucideIcons.Files;
  const isCompactEmptyState = width <= 172;

  return (
    <div
      className={cn("flex flex-col flex-1 items-center justify-center", isCompactEmptyState ? "px-2" : "px-4")}
    >
      <div className="flex flex-col items-center gap-2.5">
        <EmptyIcon className="h-7 w-7 text-foreground/45 stroke-[1.75]" />
        <p
          className={cn(
            "font-medium tracking-[0.01em] text-foreground/70",
            isCompactEmptyState ? "text-[14px]" : "text-[15px]",
          )}
        >
          {isLocalNotebook ? "暂无文件可选" : "暂无页面可选"}
        </p>
      </div>
      <Button
        variant="link"
        onClick={onCreatePage}
        className={cn(
          "mt-1 h-auto p-0 font-medium text-muted-foreground hover:text-foreground whitespace-normal break-words leading-snug",
          isCompactEmptyState ? "max-w-[9.5rem] text-[13px]" : "max-w-[11rem] text-[15px]",
        )}
      >
        {isLocalNotebook ? "新建文件" : "点击侧栏右上角加号创建"}
      </Button>
    </div>
  );
}
