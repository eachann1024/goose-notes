import { Editor } from "@tiptap/react";
interface TableHoverControlsProps {
  editor: Editor;
}

export function TableHoverControls({ editor }: TableHoverControlsProps) {
  const [hoverState, setHoverState] = useState<{
    type: "row" | "col" | "both" | "none";
    tableRect: DOMRect;
    pos: number;
  } | null>(null);
  const [visible, setVisible] = useState(false);

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
      if (!editor.isEditable) return;
      const target = e.target as HTMLElement;

      if (controlsRef.current?.contains(target)) {
        clearHideTimeout();
        return;
      }

      const cell = target.closest("td, th") as HTMLTableCellElement;
      const table = cell?.closest("table");
      const currentTableRect =
        table?.getBoundingClientRect() || hoverState?.tableRect;

      if (!cell || !table || !editor.view.dom.contains(table)) {
        const isNearRowBar =
          hoverState?.type !== "none" &&
          currentTableRect &&
          Math.abs(
            e.clientX - (currentTableRect.left + currentTableRect.width / 2),
          ) <
            currentTableRect.width / 2 + 20 &&
          Math.abs(e.clientY - (currentTableRect.bottom + 16)) < 30;

        const isNearColBar =
          hoverState?.type !== "none" &&
          currentTableRect &&
          Math.abs(e.clientX - (currentTableRect.right + 16)) < 30 &&
          Math.abs(
            e.clientY - (currentTableRect.top + currentTableRect.height / 2),
          ) <
            currentTableRect.height / 2 + 20;

        if (!isNearRowBar && !isNearColBar) {
          if (!hideTimeoutRef.current && hoverState) {
            setVisible(false);
            hideTimeoutRef.current = setTimeout(() => {
              setHoverState(null);
            }, 300);
          }
        }
        return;
      }

      clearHideTimeout();

      const row = cell.parentElement as HTMLTableRowElement;
      const rowIndex = row.rowIndex;
      const cellIndex = cell.cellIndex;
      const isLastRow = rowIndex === table.rows.length - 1;
      const isLastCol = cellIndex === row.cells.length - 1;

      if (!isLastRow && !isLastCol) {
        setVisible(false);
        setHoverState(null);
        return;
      }

      const tableRect = currentTableRect!;

      try {
        const pos = editor.view.posAtDOM(cell, 0);

        let type: "row" | "col" | "both" | "none" = "none";

        if (isLastRow && isLastCol) type = "both";
        else if (isLastRow) type = "row";
        else if (isLastCol) type = "col";

        setHoverState({
          type,
          tableRect,
          pos: pos - 1,
        });
        setVisible(true);
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

  const baseBarStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "opacity 0.2s ease-out, background-color 0.2s",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
  };

  const barClasses =
    "bg-gradient-to-br from-muted/60 to-muted/40 hover:from-primary/25 hover:to-primary/15 text-muted-foreground border border-border/50 rounded-sm backdrop-blur-[2px] table-add-control transition-all duration-200";

  const rowBarStyle: React.CSSProperties = {
    ...baseBarStyle,
    left: tableRect.left,
    top: tableRect.bottom + 4,
    width: tableRect.width,
    height: "24px",
  };

  const colBarStyle: React.CSSProperties = {
    ...baseBarStyle,
    left: tableRect.right + 4,
    top: tableRect.top,
    width: "24px",
    height: tableRect.height,
  };

  const handleAddRow = () => {
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1)
      .addRowAfter()
      .run();
    setVisible(false);
    setTimeout(() => setHoverState(null), 200);
  };

  const handleAddCol = () => {
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1)
      .addColumnAfter()
      .run();
    setVisible(false);
    setTimeout(() => setHoverState(null), 200);
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
                <LucideIcons.Plus className="h-4 w-4" />
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
                <LucideIcons.Plus className="h-4 w-4" />
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
