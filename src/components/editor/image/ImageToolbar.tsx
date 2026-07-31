import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  Download,
  Maximize2,
} from "lucide-react";
import { useEffect, type MouseEventHandler, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import { cn } from "@/components/editor/utils/cn";
import type { ImageAlignment } from "@/components/editor/image/imageUtils";
import { EDITOR_UI_SCALE_CHANGE_EVENT } from "@/lib/appearance";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/editor/ui/tooltip";

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
  floatingBoundary?: HTMLElement | null;
  getReferenceRect?: () => DOMRect | null;
}

const imageToolButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

function ImageToolButton({
  label,
  className,
  pressed,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  pressed?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className={cn(imageToolButtonClass, className)}
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

export function ImageToolbar({
  selectedImage,
  applyImageAlignment,
  handleSelectedImageZoom,
  handleSelectedImageCopy,
  handleSelectedImageDownload,
  floatingBoundary,
  getReferenceRect,
}: ImageToolbarProps) {
  const usesFloatingPosition = Boolean(getReferenceRect);
  const overflowOptions = {
    boundary: floatingBoundary ?? undefined,
    padding: 8,
  };
  const { refs, floatingStyles, update } = useFloating({
    open: usesFloatingPosition,
    strategy: "fixed",
    placement: "top",
    middleware: [
      offset(10),
      flip({ ...overflowOptions, fallbackPlacements: ["bottom"] }),
      shift(overflowOptions),
      size({
        ...overflowOptions,
        apply({ availableWidth, elements }) {
          elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
          elements.floating.style.overflowX = "auto";
        },
      }),
    ],
    whileElementsMounted(reference, floating, update) {
      return autoUpdate(reference, floating, update, {
        animationFrame: true,
      });
    },
  });

  useEffect(() => {
    if (!getReferenceRect) return;
    refs.setPositionReference({
      getBoundingClientRect: () => getReferenceRect() ?? selectedImage.rect,
      contextElement: floatingBoundary ?? undefined,
    });
  }, [floatingBoundary, getReferenceRect, refs, selectedImage.rect]);

  useEffect(() => {
    if (!usesFloatingPosition) return;
    window.addEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
    return () =>
      window.removeEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, update);
  }, [update, usesFloatingPosition]);

  const toolbar = (
    <TooltipProvider delayDuration={400} skipDelayDuration={100}>
      <div
        ref={usesFloatingPosition ? refs.setFloating : undefined}
        data-goose-image-toolbar
        className="fixed z-[20000]"
        style={
          usesFloatingPosition
            ? floatingStyles
            : {
                top: Math.max(8, selectedImage.rect.top - 42),
                left: selectedImage.rect.left + selectedImage.rect.width / 2,
                transform: "translateX(-50%)",
              }
        }
        onMouseDown={(e) => e.preventDefault()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        role="toolbar"
        aria-label="图片操作"
      >
        <div
          className={cn(
            "flex items-center gap-0.5 rounded-[10px] border border-border/75 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] animate-in fade-in-0 zoom-in-95 duration-150 dark:border-white/15 dark:bg-[#2f3437]",
            usesFloatingPosition && "goose-editor-context-ui",
          )}
        >
          {(
            [
              ["left", "左对齐", AlignLeft],
              ["center", "居中对齐", AlignCenter],
              ["right", "右对齐", AlignRight],
            ] as const
          ).map(([alignment, label, Icon]) => (
            <ImageToolButton
              key={alignment}
              label={label}
              pressed={selectedImage.alignment === alignment}
              onClick={() => applyImageAlignment(alignment)}
              className={
                selectedImage.alignment === alignment
                  ? usesFloatingPosition
                    ? "goose-toolbar-control-active"
                    : "bg-accent text-foreground"
                  : undefined
              }
            >
              <Icon className="h-[15px] w-[15px]" />
            </ImageToolButton>
          ))}

          <div className="mx-0.5 h-5 w-px bg-border/70" />

          <ImageToolButton label="放大图片" onClick={handleSelectedImageZoom}>
            <Maximize2 className="h-[15px] w-[15px]" />
          </ImageToolButton>
          <ImageToolButton label="复制图片" onClick={handleSelectedImageCopy}>
            <Copy className="h-[15px] w-[15px]" />
          </ImageToolButton>
          <ImageToolButton
            label="下载图片"
            onClick={handleSelectedImageDownload}
          >
            <Download className="h-[15px] w-[15px]" />
          </ImageToolButton>
        </div>
      </div>
    </TooltipProvider>
  );

  return usesFloatingPosition && typeof document !== "undefined"
    ? createPortal(toolbar, document.body)
    : toolbar;
}
