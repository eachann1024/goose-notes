interface SidebarResizeEdgeProps {
  width: number;
  minWidth: number;
  maxWidth: number;
  isResizing: boolean;
  onMouseDown: (event: React.MouseEvent) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export function SidebarResizeEdge({
  width,
  minWidth,
  maxWidth,
  isResizing,
  onMouseDown,
  onPointerDown,
  onKeyDown,
}: SidebarResizeEdgeProps) {
  return (
    <div
      className="absolute top-0 h-full z-[60] cursor-col-resize group/resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      style={{ right: "calc(-12px - var(--workspace-sidebar-gap, 8px) / 2)", width: "24px" }}
      onMouseDown={onMouseDown}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="separator"
      aria-label="调整侧栏宽度"
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      aria-valuetext={`${Math.round(width)} 像素`}
      title="调整侧栏宽度：左右方向键；Home 最窄，End 最宽"
    >
      <div
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150 motion-reduce:transition-none",
          isResizing ? "opacity-100" : "opacity-0 group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100",
        )}
        style={{
          width: "2px",
          height: "100%",
          borderRadius: 0,
          background: isResizing
            ? "var(--workspace-resize-line-active)"
            : "var(--workspace-resize-line)",
        }}
      />
    </div>
  );
}
