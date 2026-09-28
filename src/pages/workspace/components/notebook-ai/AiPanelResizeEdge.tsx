import { cn } from "@/lib/utils";

interface AiPanelResizeEdgeProps {
  isResizing: boolean;
  onMouseDown: (event: React.MouseEvent) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}

/** 命中区居中跨过两栏共用的分隔线，不额外占用布局宽度。 */
export function AiPanelResizeEdge({
  isResizing,
  onMouseDown,
  onPointerDown,
}: AiPanelResizeEdgeProps) {
  return (
    <div
      className="absolute top-0 z-[60] h-full cursor-col-resize group/resize"
      style={{ left: "-8px", width: "16px" }}
      onMouseDown={onMouseDown}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="调整 AI 面板宽度"
    >
      <div
        className={cn(
          "absolute left-1/2 top-1/2 h-full -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150",
          isResizing
            ? "opacity-100"
            : "opacity-0 group-hover/resize:opacity-100",
        )}
        style={{
          width: "1px",
          borderRadius: 0,
          background: isResizing
            ? "var(--workspace-resize-line-active)"
            : "var(--workspace-resize-line)",
        }}
      />
    </div>
  );
}
