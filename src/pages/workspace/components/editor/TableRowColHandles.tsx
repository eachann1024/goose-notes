import { Editor } from "@tiptap/react";

interface TableRowColHandlesProps {
  editor: Editor;
}

type HandleInfo = {
  rect: DOMRect;
  cellPos: number;
};

type HandleState = {
  row: HandleInfo | null;
  col: HandleInfo | null;
};

const emptyState: HandleState = { row: null, col: null };

export function TableRowColHandles({ editor }: TableRowColHandlesProps) {
  const [handles, setHandles] = useState<HandleState>(emptyState);
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState<"row" | "col" | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const suppressDragHandle = useCallback(() => {
    document.body.classList.add("drag-handle-suppressed");
  }, []);

  const restoreDragHandle = useCallback(() => {
    document.body.classList.remove("drag-handle-suppressed");
  }, []);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (menuOpen) return;
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        hideTimeoutRef.current = setTimeout(() => {
          setHandles(emptyState);
        }, 300);
      }, 150);
  }, [menuOpen, clearHideTimeout]);

  useEffect(() => {
    if (!editor) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!editor.isEditable || menuOpen) return;

      const target = e.target as HTMLElement;

      if (handleRef.current?.contains(target)) {
        clearHideTimeout();
        return;
      }

      const cell = target.closest("td, th") as HTMLTableCellElement;
      const table = cell?.closest("table");

      if (!cell || !table || !editor.view.dom.contains(table)) {
        scheduleHide();
        return;
      }

      clearHideTimeout();

      const row = cell.parentElement as HTMLTableRowElement;
      const tableRect = table.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();

      const leftEdge =
        cellRect.left - tableRect.left < 40 && e.clientX < cellRect.left + 20;
      const topEdge =
        cellRect.top - tableRect.top < 40 && e.clientY < cellRect.top + 20;

      if (!leftEdge && !topEdge) {
        const isNearRowHandle =
          handles.row &&
          Math.abs(e.clientX - (handles.row.rect.left - 15)) < 30 &&
          Math.abs(
            e.clientY - (handles.row.rect.top + handles.row.rect.height / 2),
          ) < 20;

        const isNearColHandle =
          handles.col &&
          Math.abs(
            e.clientX - (handles.col.rect.left + handles.col.rect.width / 2),
          ) < 20 &&
          Math.abs(e.clientY - (handles.col.rect.top - 15)) < 30;

        if (!isNearRowHandle && !isNearColHandle) {
          scheduleHide();
          return;
        }
      }

      try {
        const pos = editor.view.posAtDOM(cell, 0) - 1;
        const newState: HandleState = { row: null, col: null };

        if (leftEdge) {
          newState.row = { rect: rowRect, cellPos: pos };
        }

        if (topEdge) {
          const colRect = new DOMRect(
            cellRect.left,
            tableRect.top,
            cellRect.width,
            tableRect.height,
          );
          newState.col = { rect: colRect, cellPos: pos };
        }

        setHandles(newState);
        setVisible(true);
      } catch {
        scheduleHide();
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [editor, menuOpen, clearHideTimeout, scheduleHide]);

  useEffect(() => {
    if (menuOpen) {
      suppressDragHandle();
    } else {
      restoreDragHandle();
    }
  }, [menuOpen, suppressDragHandle, restoreDragHandle]);

  useEffect(() => {
    return () => {
      restoreDragHandle();
    };
  }, [restoreDragHandle]);

  if (!handles.row && !handles.col) return null;

  const rowActions = [
    {
      label: "在上方插入行",
      icon: LucideIcons.ArrowUpToLine,
      action: (cellPos: number) => {
        editor
          .chain()
          .focus()
          .setTextSelection(cellPos + 1)
          .addRowBefore()
          .run();
      },
    },
    {
      label: "在下方插入行",
      icon: LucideIcons.ArrowDownToLine,
      action: (cellPos: number) => {
        editor
          .chain()
          .focus()
          .setTextSelection(cellPos + 1)
          .addRowAfter()
          .run();
      },
    },
    {
      label: "删除行",
      icon: LucideIcons.Trash2,
      action: (cellPos: number) => {
        editor
          .chain()
          .focus()
          .setTextSelection(cellPos + 1)
          .deleteRow()
          .run();
      },
      destructive: true,
    },
  ];

  const colActions = [
    {
      label: "在左侧插入列",
      icon: LucideIcons.ArrowLeftToLine,
      action: (cellPos: number) => {
        editor
          .chain()
          .focus()
          .setTextSelection(cellPos + 1)
          .addColumnBefore()
          .run();
      },
    },
    {
      label: "在右侧插入列",
      icon: LucideIcons.ArrowRightToLine,
      action: (cellPos: number) => {
        editor
          .chain()
          .focus()
          .setTextSelection(cellPos + 1)
          .addColumnAfter()
          .run();
      },
    },
    {
      label: "删除列",
      icon: LucideIcons.Trash2,
      action: (cellPos: number) => {
        editor
          .chain()
          .focus()
          .setTextSelection(cellPos + 1)
          .deleteColumn()
          .run();
      },
      destructive: true,
    },
  ];

  const buttonClass = cn(
    "flex items-center justify-center rounded-sm cursor-grab",
    "bg-muted/60 hover:bg-primary/20 text-muted-foreground hover:text-foreground",
    "border border-border/50 backdrop-blur-[2px]",
    "transition-all duration-200 ease-out",
    visible
      ? "opacity-70 hover:opacity-100"
      : "opacity-0 invisible pointer-events-none",
  );

  return (
    <div
      ref={handleRef}
      onMouseEnter={() => {
        clearHideTimeout();
        setVisible(true);
      }}
      onMouseLeave={scheduleHide}
    >
      {handles.row && (
        <DropdownMenu
          open={menuOpen === "row"}
          onOpenChange={(open) => setMenuOpen(open ? "row" : null)}
        >
          <DropdownMenuTrigger asChild>
            <button
              style={{
                position: "fixed",
                zIndex: 60,
                left: handles.row.rect.left - 28,
                top: handles.row.rect.top + handles.row.rect.height / 2 - 12,
                width: 24,
                height: 24,
              }}
              className={buttonClass}
              onMouseEnter={suppressDragHandle}
              onMouseLeave={restoreDragHandle}
            >
              <LucideIcons.GripVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {rowActions.map((item, i) => (
              <DropdownMenuItem
                key={i}
                onClick={() => {
                  item.action(handles.row!.cellPos);
                  setHandles(emptyState);
                }}
                className={
                  item.destructive
                    ? "text-destructive focus:text-destructive"
                    : ""
                }
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {handles.col && (
        <DropdownMenu
          open={menuOpen === "col"}
          onOpenChange={(open) => setMenuOpen(open ? "col" : null)}
        >
          <DropdownMenuTrigger asChild>
            <button
              style={{
                position: "fixed",
                zIndex: 60,
                left: handles.col.rect.left + handles.col.rect.width / 2 - 12,
                top: handles.col.rect.top - 28,
                width: 24,
                height: 24,
              }}
              className={buttonClass}
              onMouseEnter={suppressDragHandle}
              onMouseLeave={restoreDragHandle}
            >
              <LucideIcons.GripHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {colActions.map((item, i) => (
              <DropdownMenuItem
                key={i}
                onClick={() => {
                  item.action(handles.col!.cellPos);
                  setHandles(emptyState);
                }}
                className={
                  item.destructive
                    ? "text-destructive focus:text-destructive"
                    : ""
                }
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
