import { AlignCenter, AlignLeft, AlignRight, Copy, Download, Maximize2 } from "lucide-react";
import { cn } from "@/components/editor/utils/cn";
import type { ImageAlignment } from "@/components/editor/image/imageUtils";

export interface SelectedImageState {
  blockId: string | null;
  src: string;
  alt?: string;
  index: number;
  rect: DOMRect;
  alignment: ImageAlignment;
}

interface ImageToolbarProps {
  selectedImage: SelectedImageState;
  applyImageAlignment: (alignment: ImageAlignment) => void;
  handleSelectedImageZoom: () => void;
  handleSelectedImageCopy: () => void;
  handleSelectedImageDownload: () => void;
}

export function ImageToolbar({
  selectedImage,
  applyImageAlignment,
  handleSelectedImageZoom,
  handleSelectedImageCopy,
  handleSelectedImageDownload,
}: ImageToolbarProps) {
  return (
    <div
      data-goose-image-toolbar
      className="fixed z-[20000] flex items-center gap-0.5 rounded-[10px] border border-border/75 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] animate-in fade-in-0 zoom-in-95 duration-150 dark:border-white/15 dark:bg-[#2f3437]"
      style={{
        top: Math.max(8, selectedImage.rect.top - 42),
        left: selectedImage.rect.left + selectedImage.rect.width / 2,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {([
        ["left", "左对齐", AlignLeft],
        ["center", "居中对齐", AlignCenter],
        ["right", "右对齐", AlignRight],
      ] as const).map(([alignment, label, Icon]) => (
        <button
          key={alignment}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => applyImageAlignment(alignment)}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 transition-colors hover:bg-muted",
            selectedImage.alignment === alignment && "bg-accent text-foreground",
          )}
        >
          <Icon className="h-[15px] w-[15px]" />
        </button>
      ))}

      <div className="mx-0.5 h-5 w-px bg-border/70" />

      <button
        type="button"
        title="放大图片"
        aria-label="放大图片"
        onClick={handleSelectedImageZoom}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 transition-colors hover:bg-muted"
      >
        <Maximize2 className="h-[15px] w-[15px]" />
      </button>
      <button
        type="button"
        title="复制图片"
        aria-label="复制图片"
        onClick={handleSelectedImageCopy}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 transition-colors hover:bg-muted"
      >
        <Copy className="h-[15px] w-[15px]" />
      </button>
      <button
        type="button"
        title="下载图片"
        aria-label="下载图片"
        onClick={handleSelectedImageDownload}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 transition-colors hover:bg-muted"
      >
        <Download className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}
