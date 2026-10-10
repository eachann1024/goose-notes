import type { ReactNode } from "react";
import { Minus, Plus, RotateCcw } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getArtifactScaleRange } from "./artifactPanZoomScale";
import { useArtifactTransform } from "./panzoom/useArtifactTransform";
import { useArtifactInteractions } from "./panzoom/useArtifactInteractions";
interface ArtifactPanZoomProps {
  children: ReactNode;
  /** 内容变化时重新适配视口（例如 SVG 重新渲染） */
  contentKey?: string;
  className?: string;
  minHeight?: number;
}

export function ArtifactPanZoom({
  children,
  contentKey,
  className,
  minHeight = 220,
}: ArtifactPanZoomProps) {
  const transform = useArtifactTransform(contentKey);
  const {
    viewportRef,
    contentRef,
    scale,
    fitScale,
    offset,
    ready,
    isZoomedIn,
    fitToViewport,
    zoomByStep,
  } = transform;
  const { dragging, onPointerDown, onPointerMove, endDrag } =
    useArtifactInteractions(transform);
  const percent = Math.round((scale / Math.max(fitScale, 0.0001)) * 100);
  const { minScale, maxScale } = getArtifactScaleRange(fitScale);
  const atMinZoom = scale <= minScale + 0.001;
  const atMaxZoom = scale >= maxScale - 0.001;
  const atFitZoom = Math.abs(scale - fitScale) <= 0.001;

  return (
    <div
      ref={viewportRef}
      className={cn(
        "notebook-ai-artifact-panzoom relative overflow-hidden",
        isZoomedIn && "is-zoomed",
        dragging && "is-dragging",
        className,
      )}
      style={{ minHeight }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label={isZoomedIn ? "已放大的图形，可拖动或滚轮平移" : "图形预览"}
    >
      <div
        ref={contentRef}
        className="notebook-ai-artifact-panzoom-content"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          opacity: ready ? 1 : 0,
        }}
      >
        {children}
      </div>

      <TooltipProvider delayDuration={300}>
        <div className="notebook-ai-artifact-panzoom-controls pointer-events-none absolute bottom-2 right-2 z-10 flex items-center gap-0.5 rounded-[8px] bg-background/95 p-0.5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                type="button"
                tone="muted"
                size="sm"
                className="pointer-events-auto cursor-pointer hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                aria-label="缩小"
                disabled={atMinZoom}
                onClick={() => zoomByStep(-1)}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>缩小</TooltipContent>
          </Tooltip>

          <span className="pointer-events-none min-w-[40px] select-none text-center text-[11px] tabular-nums text-muted-foreground">
            {percent}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                type="button"
                tone="muted"
                size="sm"
                className="pointer-events-auto cursor-pointer hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                aria-label="放大"
                disabled={atMaxZoom}
                onClick={() => zoomByStep(1)}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>放大后可拖动/滚轮平移</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                type="button"
                tone="muted"
                size="sm"
                className="pointer-events-auto cursor-pointer hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                aria-label="适配窗口"
                disabled={atFitZoom}
                onClick={() => fitToViewport()}
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>适配窗口</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
