import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { Plus, GripVertical } from "lucide-react";
import { cn } from "@/components/editor/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/editor/ui/tooltip";

const isMac = /Mac/i.test(navigator.platform);
const altKeyLabel = isMac ? "⌥" : "Alt";

export function EditorSideMenu() {
  const editor = useBlockNoteEditor<any, any, any>();
  const sideMenu = useExtension(SideMenuExtension);
  const lastPosRef = useRef({ top: 0, left: 0 });
  const [addTipOpen, setAddTipOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const state = useExtensionState(SideMenuExtension, {
    selector: (s) =>
      s !== undefined
        ? {
            show: s.show,
            block: s.block,
            referencePos: s.referencePos,
          }
        : undefined,
  });

  const block = state?.block;
  const isVisible =
    !!state?.show &&
    !!state.referencePos &&
    !(block && block.id === editor.document[0]?.id);

  const handleAdd = useCallback(
    (e: React.MouseEvent) => {
      setAddTipOpen(false);
      if (!block) return;
      const placement: "before" | "after" =
        e.altKey || e.ctrlKey || e.metaKey ? "before" : "after";
      const content = block.content;
      const isEmpty =
        content !== undefined && Array.isArray(content) && content.length === 0;
      if (isEmpty && placement === "after") {
        editor.setTextCursorPosition(block);
      } else {
        const [inserted] = editor.insertBlocks(
          [{ type: "paragraph" }],
          block,
          placement,
        );
        editor.setTextCursorPosition(inserted);
      }
      editor.focus();
    },
    [block, editor],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!block || !sideMenu) return;
      setAddTipOpen(false);
      setIsDragging(true);
      sideMenu.blockDragStart(
        { dataTransfer: e.dataTransfer, clientY: e.clientY },
        block,
      );
    },
    [block, sideMenu],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    sideMenu?.blockDragEnd?.();
  }, [sideMenu]);

  if (state?.referencePos) {
    const sideMenuWidth = 40;
    // BlockNote 为 heading 设置了 padding-top:18px，底部仅 3px，
    // 导致几何中心比文字视觉中心偏高 (18-3)/2 = 7.5px，需补偿。
    const headingOffset = block?.type === "heading" ? 7.5 : 0;
    lastPosRef.current = {
      top: state.referencePos.top + state.referencePos.height / 2 + headingOffset,
      left: Math.max(4, state.referencePos.left - sideMenuWidth),
    };
  }

  const { top, left } = lastPosRef.current;

  return createPortal(
    <div
      className="fixed z-[60] flex items-center rounded-lg p-1 transition-[opacity,transform] duration-150 ease-out [body[data-scroll-locked]_&]:!opacity-0 [body[data-scroll-locked]_&]:!pointer-events-none"
      style={{
        top,
        left,
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? "translateY(-50%) scale(1)"
          : "translateY(-50%) scale(0.92)",
        pointerEvents: isVisible ? "auto" : "none",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <TooltipProvider delayDuration={600} disableHoverableContent>
        <Tooltip
          open={addTipOpen && isVisible && !isDragging}
          onOpenChange={setAddTipOpen}
        >
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleAdd}
              className={cn(
                "flex h-6 w-5 items-center justify-center rounded-md text-muted-foreground/50",
                "transition-colors hover:bg-muted hover:text-foreground",
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start">
            <div className="flex flex-col gap-1 whitespace-nowrap">
              <span>
                <span className="text-[hsl(var(--foreground))]">点击</span>{" "}
                在下方添加块
              </span>
              <span>
                <span className="text-[hsl(var(--foreground))]">
                  {altKeyLabel} 点击
                </span>{" "}
                在上方添加块
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={cn(
          "flex h-6 w-5 cursor-grab items-center justify-center rounded-md text-muted-foreground/40",
          "transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing",
        )}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>,
    document.body,
  );
}
