import { cn } from "@/lib/utils";
import { isElectronHost } from "@/lib/local-vault";

interface TreeEmptyStateProps {
  isLocalNotebook: boolean;
  /** 侧栏树可视区高度；有值时用它做垂直居中，避免 flex 高度链断裂 */
  height?: number;
}

export function TreeEmptyState({
  isLocalNotebook,
  height = 0,
}: TreeEmptyStateProps) {
  const hasMeasuredHeight = height > 0;

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center px-4",
        !hasMeasuredHeight && "h-full min-h-0 flex-1",
      )}
      style={hasMeasuredHeight ? { height, minHeight: height } : undefined}
    >
      <p className="text-center text-xs font-normal text-muted-foreground">
        {isLocalNotebook
          ? "暂无文件可选"
          : isElectronHost
            ? "尚未打开仓库"
            : "暂无页面可选"}
      </p>
    </div>
  );
}
