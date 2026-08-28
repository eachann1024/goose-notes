import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { Plus, GripVertical, ChevronRight } from "lucide-react";
import { cn } from "@/components/editor/utils/cn";
import { ensureBlockMoveDragging } from "@/components/editor/core/ensureBlockMoveDragging";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/editor/ui/tooltip";
import {
  isFoldableHeadingBlock,
  queryHeadingTextRect,
  readHeadingCollapsed,
  toggleHeadingCollapsed,
} from "@/components/editor/core/toggleHeadingGutter";
import { getSectionInsertAnchorId } from "@/components/editor/core/headingSectionFold";
import {
  SIDE_MENU_CONTENT_GAP,
  isEditorSideMenuHoverTarget,
} from "@/components/editor/core/sideMenuHover";

const isMac = /Mac/i.test(navigator.platform);
const altKeyLabel = isMac ? "⌥" : "Alt";

const SIDEBAR_INTERACTION_SELECTOR = ".workspace-sidebar-pane, .rct-main-tree";
const SIDEBAR_HOVER_SELECTOR =
  ".workspace-sidebar-pane:hover, .rct-main-tree:hover";

export function EditorSideMenu() {
  const editor = useBlockNoteEditor<any, any, any>();
  const sideMenu = useExtension(SideMenuExtension);
  const [addTipOpen, setAddTipOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarInteracting, setSidebarInteracting] = useState(false);
  const [hoveringEditor, setHoveringEditor] = useState(false);
  const [foldHot, setFoldHot] = useState(false);
  const [foldTick, setFoldTick] = useState(0);
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
  const firstBlockId = editor.document[0]?.id as string | undefined;
  const showHeadingToggle = isFoldableHeadingBlock(block, firstBlockId);
  const liveHeading = block ? editor.getBlock(block.id) ?? block : undefined;
  const headingExpanded = liveHeading
    ? !readHeadingCollapsed(liveHeading)
    : false;
  void foldTick;

  useEffect(() => {
    const updateSidebarInteracting = (
      target: EventTarget | null = document.activeElement,
    ) => {
      const element = target instanceof Element ? target : null;
      const activeElement = document.activeElement;
      const next =
        Boolean(element?.closest(SIDEBAR_INTERACTION_SELECTOR)) ||
        Boolean(activeElement?.closest?.(SIDEBAR_INTERACTION_SELECTOR)) ||
        Boolean(document.querySelector(SIDEBAR_HOVER_SELECTOR));
      setSidebarInteracting(next);
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateSidebarInteracting(event.target);
      setHoveringEditor(isEditorSideMenuHoverTarget(event.target));
    };
    const handleFocusChange = (event: FocusEvent) =>
      updateSidebarInteracting(event.target);

    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("focusin", handleFocusChange, true);
    document.addEventListener("focusout", handleFocusChange, true);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("focusin", handleFocusChange, true);
      document.removeEventListener("focusout", handleFocusChange, true);
    };
  }, []);

  const shouldShow =
    Boolean(state?.show && state.referencePos && block) &&
    editor.isEditable &&
    !sidebarInteracting &&
    (hoveringEditor || isDragging);

  const handleToggleHeading = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!block) return;
      toggleHeadingCollapsed(editor, block.id);
      setFoldTick((tick) => tick + 1);
    },
    [block, editor],
  );

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
    setIsDragging(false);
    sideMenu?.blockDragEnd?.();
  }, [sideMenu]);

  const referencePos = state?.referencePos;
  if (!shouldShow || !referencePos || !block) {
    return null;
  }

  const textRect =
    block.type === "heading" ? queryHeadingTextRect(block.id) : null;
  const top = textRect
    ? textRect.top + textRect.height / 2
    : referencePos.top + referencePos.height / 2;
  const anchorLeft = referencePos.left - SIDE_MENU_CONTENT_GAP;
  const portalTarget = editor.portalElement ?? document.body;
  return createPortal(
    <div
      className={cn(
        "bn-side-menu fixed z-[70]",
        "transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
        "[body[data-scroll-locked]_&]:!opacity-0 [body[data-scroll-locked]_&]:!pointer-events-none",
      )}
      style={{
        top,
        left: anchorLeft,
        opacity: 1,
        // 缩放在内层用 --editor-scale 写真实尺寸，外壳只做定位平移。
        transform: "translate(-100%, -50%)",
        transformOrigin: "right center",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
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
                onClick={handleAdd}
                className={cn(
                  "flex h-6 w-[22px] items-center justify-center rounded-[7px] text-muted-foreground/55",
                  "transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)]",
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
              "goose-heading-fold-btn flex h-6 w-[22px] items-center justify-center rounded-[7px]",
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
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          className={cn(
            "relative flex h-6 w-[22px] cursor-grab items-center justify-center rounded-[7px] text-muted-foreground/45",
            "before:absolute before:-left-0.5 before:top-1 before:bottom-1 before:w-px before:bg-border/55 before:content-['']",
            "transition-colors hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] active:cursor-grabbing",
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>,
    portalTarget,
  );
}
