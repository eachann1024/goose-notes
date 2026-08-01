import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Download,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/components/editor/utils/cn";
import type { ImageAlignment } from "@/components/editor/image/imageUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/editor/ui/tooltip";
import { getScaledEditorUiPx } from "@/components/editor/utils/editorContextUi";

type VideoToolbarProps = {
  rect: DOMRect;
  alignment: ImageAlignment;
  editable: boolean;
  onAlign: (alignment: ImageAlignment) => void;
  onReplace: () => void;
  onDownload: () => void;
  onDelete: () => void;
};

const toolButtonClass = "goose-block-toolbar-control";

function VideoToolButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(toolButtonClass, className)}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function VideoToolbar({
  rect,
  alignment,
  editable,
  onAlign,
  onReplace,
  onDownload,
  onDelete,
}: VideoToolbarProps) {
  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={100}>
      <div
        data-goose-video-toolbar
        className="fixed z-[20000]"
        style={{
          top: Math.max(8, rect.top - getScaledEditorUiPx(40)),
          left: rect.left + rect.width / 2,
          transform: "translateX(-50%)",
        }}
        onMouseDown={(event) => event.preventDefault()}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        role="toolbar"
        aria-label="视频操作"
      >
        <div className="goose-editor-context-ui goose-block-toolbar-surface animate-in fade-in-0 zoom-in-95 duration-150">
          {editable &&
            (
              [
                ["left", "左对齐", AlignLeft],
                ["center", "居中对齐", AlignCenter],
                ["right", "右对齐", AlignRight],
              ] as const
            ).map(([value, label, Icon]) => (
              <VideoToolButton
                key={value}
                label={label}
                onClick={() => onAlign(value)}
                className={
                  alignment === value ? "bg-accent text-foreground" : undefined
                }
              >
                <Icon className="h-[15px] w-[15px]" />
              </VideoToolButton>
            ))}

          {editable && <div className="goose-block-toolbar-separator" />}

          {editable && (
            <VideoToolButton label="更换视频" onClick={onReplace}>
              <RefreshCw className="h-[15px] w-[15px]" />
            </VideoToolButton>
          )}
          <VideoToolButton label="下载视频" onClick={onDownload}>
            <Download className="h-[15px] w-[15px]" />
          </VideoToolButton>
          {editable && (
            <VideoToolButton
              label="删除视频"
              onClick={onDelete}
              className="hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive"
            >
              <Trash2 className="h-[15px] w-[15px]" />
            </VideoToolButton>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
