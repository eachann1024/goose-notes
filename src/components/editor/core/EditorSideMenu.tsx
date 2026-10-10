import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBlockNoteEditor, useExtension } from "@blocknote/react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { Plus, GripVertical, ChevronRight } from "@/components/ui/icons";
import { cn } from "@/components/editor/utils/cn";
import { ensureBlockMoveDragging } from "@/components/editor/core/ensureBlockMoveDragging";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/editor/ui/tooltip";
import {
  queryHeadingTextRect,
  readHeadingCollapsed,
  toggleHeadingCollapsed,
} from "@/components/editor/core/toggleHeadingGutter";
import { getSectionInsertAnchorId } from "@/components/editor/core/headingSectionFold";
import { useEditorSideMenuTarget } from "./useEditorSideMenuTarget";

const isMac = /Mac/i.test(navigator.platform);
const altKeyLabel = isMac ? "⌥" : "Alt";

export function EditorSideMenu() {
  const editor = useBlockNoteEditor<any, any, any>();
  const sideMenu = useExtension(SideMenuExtension);
  const menuRef = useRef<HTMLDivElement>(null);
  const pressedHandle = useRef(false);
  const [addTipOpen, setAddTipOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [foldHot, setFoldHot] = useState(false);
  const {
    block,
    referencePos,
    shouldShow,
    showHeadingToggle,
    headingExpanded,
    sideMenuGap,
    setFoldTick,
  } = useEditorSideMenuTarget(editor, isDragging, menuRef, pressedHandle);

  const handleToggleHeading = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!block) return;
      toggleHeadingCollapsed(editor, block.id);
      setFoldTick((tick) => tick + 1);
    },
    [block, editor, setFoldTick],
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
      ensureBlockMoveDragging(editor.prosemirrorView, e.dataTransfer);
    },
    [block, editor, sideMenu],
  );

  const handleDragEnd = useCallback(() => {
    pressedHandle.current = false;
    setIsDragging(false);
    sideMenu?.blockDragEnd?.();
  }, [sideMenu]);

  useEffect(() => {
    if (!isDragging) return;
    // Moving a block can unmount its handle before native dragend fires.
    const onDrop = () => window.setTimeout(handleDragEnd, 0);
    document.addEventListener("drop", onDrop, true);
    return () => document.removeEventListener("drop", onDrop, true);
  }, [isDragging, handleDragEnd]);

  const handleAdd = useCallback(
    (e: React.MouseEvent) => {
      setAddTipOpen(false);
      if (!block) return;
      const placement: "before" | "after" =
        e.altKey || e.ctrlKey || e.metaKey ? "before" : "after";
      const current = editor.getBlock(block.id) ?? block;
      // 折叠中的 heading 点加号：插到 section 尾部，否则新块会立刻被快照外隐藏规则波及。
      const collapsedHeadingAfter =
        placement === "after" &&
        current.type === "heading" &&
        readHeadingCollapsed(current);
      const content = current.content;
      const isEmpty =
        content !== undefined && Array.isArray(content) && content.length === 0;
      if (isEmpty && placement === "after" && !collapsedHeadingAfter) {
        editor.setTextCursorPosition(current);
      } else {
        const anchor = collapsedHeadingAfter
          ? (editor.getBlock(
              getSectionInsertAnchorId(editor.document as any, current.id),
            ) ?? current)
          : current;
        const [inserted] = editor.insertBlocks(
          [{ type: "paragraph" }],
          anchor,
          placement,
        );
        editor.setTextCursorPosition(inserted);
      }
      editor.focus();
    },
    [block, editor],
  );

  if (!shouldShow || !referencePos || !block) {
    return null;
  }

  const textRect =
    block.type === "heading" ? queryHeadingTextRect(block.id) : null;
  const top = textRect
    ? textRect.top + textRect.height / 2
    : referencePos.top + referencePos.height / 2;
  const anchorLeft = referencePos.left - sideMenuGap;
  // Workspace sidebar and main sheet have separate stacking contexts; escape the main sheet.
  const portalTarget = editor.prosemirrorView.dom.closest(
    ".workspace-main-sheet",
  )
    ? document.body
    : (editor.portalElement ?? document.body);
  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        "bn-side-menu fixed z-[70]",
        "transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
        "[body[data-scroll-locked]_&]:!opacity-0 [body[data-scroll-locked]_&]:!pointer-events-none",
      )}
      data-heading-gutter={block.type !== "table" ? "true" : undefined}
      style={{
        top,
        left: anchorLeft,
        opacity: 1,
        // 缩放在内层用 --editor-scale 写真实尺寸，外壳只做定位平移。
        transform: "translate(-100%, -50%)",
        transformOrigin: "right center",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => {
        // Native drag needs mousedown; only non-draggable actions preserve focus.
        if (!(e.target as Element).closest("[draggable='true']"))
          e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="goose-editor-inline-context-ui flex items-center gap-0.5 rounded-[10px] border border-border/50 bg-popover p-[3px] pl-1 pr-1 shadow-[0_1px_2px_hsl(var(--foreground)/0.05),0_8px_22px_hsl(var(--foreground)/0.06)] dark:border-white/12 dark:shadow-[0_8px_22px_rgba(0,0,0,0.35)]">
        <TooltipProvider delayDuration={600} disableHoverableContent>
          <Tooltip
            open={addTipOpen && shouldShow && !isDragging}
            onOpenChange={setAddTipOpen}
          >
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="添加块"
                onClick={handleAdd}
                className={cn(
                  "flex h-6 w-[22px] items-center justify-center rounded-[7px] text-muted-foreground",
                  "transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                )}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent editorContext side="bottom" align="start">
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
        {showHeadingToggle ? (
          <button
            type="button"
            draggable={false}
            aria-expanded={headingExpanded}
            aria-label={headingExpanded ? "收起章节" : "展开章节"}
            data-fold-hot={foldHot ? "true" : undefined}
            onMouseEnter={() => setFoldHot(true)}
            onMouseLeave={() => setFoldHot(false)}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={handleToggleHeading}
            className={cn(
              "goose-heading-fold-btn flex h-6 w-[22px] cursor-pointer items-center justify-center rounded-[7px]",
              "transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
            )}
          >
            <span
              className={cn(
                "inline-flex transition-transform duration-150 ease-out motion-reduce:transition-none",
                headingExpanded ? "rotate-90" : "rotate-0",
              )}
              aria-hidden
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </button>
        ) : null}
        <button
          type="button"
          draggable
          aria-label="拖动移动块"
          onPointerDown={() => {
            pressedHandle.current = true;
          }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className={cn(
            "relative flex h-6 w-[22px] cursor-grab items-center justify-center rounded-[7px] text-muted-foreground",
            "before:absolute before:-left-0.5 before:top-1 before:bottom-1 before:w-px before:bg-border/55 before:content-['']",
            "transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] active:cursor-grabbing",
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>,
    portalTarget,
  );
}
