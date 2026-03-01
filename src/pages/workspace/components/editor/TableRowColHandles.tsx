import { Editor } from "@tiptap/react";

interface TableRowColHandlesProps {
  editor: Editor;
}

type HandleInfo = {
  rect: DOMRect;
  cellPos: number;
  index?: number;
};

type HandleState = {
  row: HandleInfo | null;
  col: HandleInfo | null;
  table: { rect: DOMRect; dom: HTMLTableElement } | null;
};

const emptyState: HandleState = { row: null, col: null, table: null };

export function TableRowColHandles({ editor }: TableRowColHandlesProps) {
  const [handles, setHandles] = useState<HandleState>(emptyState);
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState<"row" | "col" | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<HandleState>(emptyState);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    handlesRef.current = handles;
  }, [handles]);

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
    if (menuOpen || isDraggingRef.current) return;
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

      // Don't show handles when multiple cells are selected
      try {
        const { selection } = editor.state;
        if (
          selection.constructor.name === "CellSelection" &&
          // @ts-ignore
          !selection.isVirtual
        ) {
          // Check if multiple cells are actually in the selection bounds
          // @ts-ignore
          const isMultiCell = selection.isColSelection || selection.isRowSelection || (selection.$anchorCell && selection.$headCell && selection.$anchorCell.pos !== selection.$headCell.pos);
          if (isMultiCell) {
             scheduleHide();
             return;
          }
        }
      } catch (err) {}

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

      try {
        const pos = editor.view.posAtDOM(cell, 0) - 1;
        const colRect = new DOMRect(
          cellRect.left,
          tableRect.top,
          cellRect.width,
          tableRect.height,
        );

        const newState: HandleState = {
          row: { rect: rowRect, cellPos: pos, index: row.rowIndex },
          col: { rect: colRect, cellPos: pos, index: cell.cellIndex },
          table: { rect: tableRect, dom: table as HTMLTableElement },
        };

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
    return subscribeGlobalScrollActivity((nextSnapshot) => {
      if (!nextSnapshot.isScrolling) return;
      clearHideTimeout();
      setVisible((prev) => (prev ? false : prev));
      setHandles((prev) => (prev.row || prev.col ? emptyState : prev));
    });
  }, [clearHideTimeout]);

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

  const handleBottomDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!handles.table) return;

    isDraggingRef.current = true;
    suppressDragHandle();

    const startY = e.clientY;
    const domTable = handles.table.dom;
    let currentRows = domTable.rows.length;
    const initialRows = currentRows;
    const ROW_HEIGHT = 36;
    let hasDragged = false;

    const onMouseMove = (ev: MouseEvent) => {
      const deltaY = ev.clientY - startY;
      if (Math.abs(deltaY) > 5) hasDragged = true;
      if (!hasDragged) return;

      const targetRows = Math.max(1, initialRows + Math.round(deltaY / ROW_HEIGHT));

      while (targetRows > currentRows) {
        const lastRow = domTable.rows[domTable.rows.length - 1];
        const lastCell = lastRow?.cells[lastRow.cells.length - 1];
        if (!lastCell) break;
        try {
          const pos = editor.view.posAtDOM(lastCell, 0);
          editor.chain().focus().setTextSelection(pos).addRowAfter().run();
          currentRows++;
        } catch { break; }
      }

      while (targetRows < currentRows) {
        const lastRow = domTable.rows[domTable.rows.length - 1];
        const lastCell = lastRow?.cells[lastRow.cells.length - 1];
        if (!lastCell) break;
        try {
          const pos = editor.view.posAtDOM(lastCell, 0);
          editor.chain().focus().setTextSelection(pos).deleteRow().run();
          currentRows--;
        } catch { break; }
      }

      const newRect = domTable.getBoundingClientRect();
      setHandles(prev =>
        prev.table ? { ...prev, table: { ...prev.table!, rect: newRect } } : prev
      );
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      isDraggingRef.current = false;
      restoreDragHandle();

      if (!hasDragged) {
        const lastRow = domTable.rows[domTable.rows.length - 1];
        const lastCell = lastRow?.cells[lastRow.cells.length - 1];
        if (lastCell) {
          try {
            const pos = editor.view.posAtDOM(lastCell, 0);
            editor.chain().focus().setTextSelection(pos).addRowAfter().run();
            setTimeout(() => {
              const newRect = domTable.getBoundingClientRect();
              setHandles(prev =>
                prev.table ? { ...prev, table: { ...prev.table!, rect: newRect } } : prev
              );
            }, 50);
          } catch { /* ignore */ }
        }
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [editor, handles.table, suppressDragHandle, restoreDragHandle]);

  const handleRightDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!handles.table) return;

    isDraggingRef.current = true;
    suppressDragHandle();

    const startX = e.clientX;
    const domTable = handles.table.dom;
    let currentCols = domTable.rows[0]?.cells.length || 1;
    const initialCols = currentCols;
    const COL_WIDTH = 100;
    let hasDragged = false;

    const onMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX;
      if (Math.abs(deltaX) > 5) hasDragged = true;
      if (!hasDragged) return;

      const targetCols = Math.max(1, initialCols + Math.round(deltaX / COL_WIDTH));

      while (targetCols > currentCols) {
        const firstRow = domTable.rows[0];
        const lastCell = firstRow?.cells[firstRow.cells.length - 1];
        if (!lastCell) break;
        try {
          const pos = editor.view.posAtDOM(lastCell, 0);
          editor.chain().focus().setTextSelection(pos).addColumnAfter().run();
          currentCols++;
        } catch { break; }
      }

      while (targetCols < currentCols) {
        const firstRow = domTable.rows[0];
        const lastCell = firstRow?.cells[firstRow.cells.length - 1];
        if (!lastCell) break;
        try {
          const pos = editor.view.posAtDOM(lastCell, 0);
          editor.chain().focus().setTextSelection(pos).deleteColumn().run();
          currentCols--;
        } catch { break; }
      }

      const newRect = domTable.getBoundingClientRect();
      setHandles(prev =>
        prev.table ? { ...prev, table: { ...prev.table!, rect: newRect } } : prev
      );
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      isDraggingRef.current = false;
      restoreDragHandle();

      if (!hasDragged) {
        const firstRow = domTable.rows[0];
        const lastCell = firstRow?.cells[firstRow.cells.length - 1];
        if (lastCell) {
          try {
            const pos = editor.view.posAtDOM(lastCell, 0);
            editor.chain().focus().setTextSelection(pos).addColumnAfter().run();
            setTimeout(() => {
              const newRect = domTable.getBoundingClientRect();
              setHandles(prev =>
                prev.table ? { ...prev, table: { ...prev.table!, rect: newRect } } : prev
              );
            }, 50);
          } catch { /* ignore */ }
        }
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [editor, handles.table, suppressDragHandle, restoreDragHandle]);

  if (!handles.row && !handles.col) return null;

  const rowActions = [
    ...(handles.row?.index === 0
      ? [
          {
            label: "切换标题行",
            icon: LucideIcons.Heading,
            action: (cellPos: number) => {
              editor.chain().focus().setTextSelection(cellPos + 1).toggleHeaderRow().run();
            },
            destructive: false,
          },
        ]
      : []),
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
    ...(handles.col?.index === 0
      ? [
          {
            label: "切换标题列",
            icon: LucideIcons.ArrowRight,
            action: (cellPos: number) => {
              editor.chain().focus().setTextSelection(cellPos + 1).toggleHeaderColumn().run();
            },
            destructive: false,
          },
        ]
      : []),
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

  const buttonBaseClass = "notion-border-handle";
  const isRowVisible = visible || menuOpen === "row";
  const isColVisible = visible || menuOpen === "col";
  const rowButtonClass = cn(
    buttonBaseClass,
    "left-handle",
    isRowVisible ? "" : "opacity-0 pointer-events-none",
    menuOpen === "row" && "is-active"
  );
  const colButtonClass = cn(
    buttonBaseClass,
    "top-handle",
    isColVisible ? "" : "opacity-0 pointer-events-none",
    menuOpen === "col" && "is-active"
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
              type="button"
              style={{
                top: handles.row.rect.top + handles.row.rect.height / 2,
                left: handles.row.rect.left,
              }}
              className={rowButtonClass}
              onMouseEnter={suppressDragHandle}
              onMouseLeave={restoreDragHandle}
            >
              <div className="handle-line" />
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
              type="button"
              style={{
                top: handles.col.rect.top,
                left: handles.col.rect.left + handles.col.rect.width / 2,
              }}
              className={colButtonClass}
              onMouseEnter={suppressDragHandle}
              onMouseLeave={restoreDragHandle}
            >
              <div className="handle-line" />
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

      {/* 底部拖拽把手：点击新增行 / 向下拖增行 / 向上拖减行 */}
      {handles.table && (
        <button
          type="button"
          title="点击以添加新行&#10;拖动以添加或移除行"
          style={{
            position: "fixed",
            zIndex: 60,
            left: handles.table.rect.left,
            top: handles.table.rect.bottom + 4,
            width: handles.table.rect.width,
            height: 14,
            cursor: "row-resize",
          }}
          className={cn(
            "notion-border-handle",
            "rounded-sm",
            visible ? "" : "opacity-0 pointer-events-none"
          )}
          onMouseDown={handleBottomDragStart}
          onMouseEnter={suppressDragHandle}
          onMouseLeave={restoreDragHandle}
        >
          <LucideIcons.Plus className="h-3 w-3" />
        </button>
      )}

      {/* 右侧拖拽把手：点击新增列 / 向右拖增列 / 向左拖减列 */}
      {handles.table && (
        <button
          type="button"
          title="点击以添加新列&#10;拖动以添加或移除列"
          style={{
            position: "fixed",
            zIndex: 60,
            left: handles.table.rect.right + 4,
            top: handles.table.rect.top,
            width: 14,
            height: handles.table.rect.height,
            cursor: "col-resize",
          }}
          className={cn(
            "notion-border-handle",
            "rounded-sm",
            visible ? "" : "opacity-0 pointer-events-none"
          )}
          onMouseDown={handleRightDragStart}
          onMouseEnter={suppressDragHandle}
          onMouseLeave={restoreDragHandle}
        >
          <LucideIcons.Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
