import { useEffect, useState, useRef, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TableHoverControlsProps {
  editor: Editor;
}

export function TableHoverControls({ editor }: TableHoverControlsProps) {
  const [hoverState, setHoverState] = useState<{
    type: "row" | "col" | "both" | "none";
    tableRect: DOMRect;
    pos: number; // Last cell pos to anchor operations
  } | null>(null);

  const controlsRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!editor) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if hovering over our controls
      if (controlsRef.current?.contains(target)) {
        clearHideTimeout();
        return;
      }

      const cell = target.closest("td, th") as HTMLTableCellElement;
      const table = cell?.closest("table");

      if (!cell || !table || !editor.view.dom.contains(table)) {
        // Only hide if we aren't already scheduled to hide or if we move completely away
        if (!hideTimeoutRef.current && hoverState) {
          hideTimeoutRef.current = setTimeout(() => {
            setHoverState(null);
          }, 150); // Small delay to allow moving to control
        }
        return;
      }

      // We are inside the table, clear any hide timeout
      clearHideTimeout();

      const row = cell.parentElement as HTMLTableRowElement;
      const rowIndex = row.rowIndex;
      const cellIndex = cell.cellIndex;
      const isLastRow = rowIndex === table.rows.length - 1;
      const isLastCol = cellIndex === row.cells.length - 1;

      if (!isLastRow && !isLastCol) {
        setHoverState(null);
        return;
      }

      // Calculate table rect for full bars
      const tableRect = table.getBoundingClientRect();

      // Get appropriate position for insertion (last cell)
      try {
        const pos = editor.view.posAtDOM(cell, 0);

        // Determine what to show
        let type: "row" | "col" | "both" | "none" = "none";

        // Notion simplification:
        // If in last row (any column), show Bottom "Add Row" Bar.
        // If in last column (any row), show Right "Add Column" Bar.
        
        if (isLastRow && isLastCol) type = "both";
        else if (isLastRow) type = "row";
        else if (isLastCol) type = "col";

        setHoverState({
          type,
          tableRect,
          pos: pos - 1,
        });
      } catch (err) {
        console.warn("Failed to get pos for table cell", err);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [editor, hoverState, clearHideTimeout]);

  useEffect(() => {
    return () => {
      document.body.classList.remove("drag-handle-suppressed");
    };
  }, []);

  useEffect(() => {
    if (!hoverState) {
      document.body.classList.remove("drag-handle-suppressed");
    }
  }, [hoverState]);

  if (!hoverState) return null;

  const { type, tableRect, pos } = hoverState;

  // Base styles for the bars
  const baseBarStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background-color 0.2s",
  };

  const barClasses =
    "bg-muted/50 hover:bg-primary/20 text-muted-foreground border border-border/50 rounded-sm backdrop-blur-[2px] table-add-control";

  // Bottom Add Row Bar
  const rowBarStyle: React.CSSProperties = {
    ...baseBarStyle,
    left: tableRect.left,
    top: tableRect.bottom + 4,
    width: tableRect.width,
    height: "24px",
  };

  // Right Add Col Bar
  const colBarStyle: React.CSSProperties = {
    ...baseBarStyle,
    left: tableRect.right + 4,
    top: tableRect.top,
    width: "24px",
    height: tableRect.height,
  };

  const handleAddRow = () => {
    // Focus, select node, add row
    editor.chain().focus().setNodeSelection(pos).addRowAfter().run();
    setHoverState(null);
  };

  const handleAddCol = () => {
    // Focus, select node, add column
    editor.chain().focus().setNodeSelection(pos).addColumnAfter().run();
    setHoverState(null);
  };

  const suppressDragHandle = () => {
    document.body.classList.add("drag-handle-suppressed");
  };

  const restoreDragHandle = () => {
    document.body.classList.remove("drag-handle-suppressed");
  };

  return (
    <div ref={controlsRef}>
      <TooltipProvider delayDuration={0}>
        {(type === "row" || type === "both") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                role="button"
                style={rowBarStyle}
                className={barClasses}
                onClick={handleAddRow}
                onMouseEnter={suppressDragHandle}
                onMouseLeave={restoreDragHandle}
              >
                <Plus className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>点击以添加新行</p>
            </TooltipContent>
          </Tooltip>
        )}

        {(type === "col" || type === "both") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                role="button"
                style={colBarStyle}
                className={barClasses}
                onClick={handleAddCol}
                onMouseEnter={suppressDragHandle}
                onMouseLeave={restoreDragHandle}
              >
                <Plus className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>点击以添加新列</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}
