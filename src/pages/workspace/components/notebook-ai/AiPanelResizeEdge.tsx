import { cn } from "@/lib/utils";

interface AiPanelResizeEdgeProps {
  isResizing: boolean;
  onMouseDown: (event: React.MouseEvent) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}

/** 落在编辑区与 AI 面板的 8px 缝上，命中区比 4px 内边手柄宽。 */
export function AiPanelResizeEdge({
  isResizing,
  onMouseDown,
  onPointerDown,
}: AiPanelResizeEdgeProps) {
  return (
    <div
      className="absolute top-0 z-[60] h-full cursor-col-resize group/resize"
      style={{ left: "-10px", width: "16px" }}
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
          width: "2px",
          marginLeft: "-1px",
          borderRadius: 0,
          background: isResizing
            ? "var(--workspace-resize-line-active)"
            : "var(--workspace-resize-line)",
        }}
      />
    </div>
  );
}
