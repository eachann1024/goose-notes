import { Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useScrollHide } from "@/hooks/useScrollHide";

interface TableHoverControlsProps {
  editor: Editor;
}

type HoverType = "row" | "col" | "both" | "none";

type HoverState = {
  type: HoverType;
  tableRect: DOMRect;
  pos: number;
};

const RECT_EPSILON = 0.5;

const isSameRect = (a: DOMRect, b: DOMRect) => {
  return (
    Math.abs(a.left - b.left) <= RECT_EPSILON &&
    Math.abs(a.top - b.top) <= RECT_EPSILON &&
    Math.abs(a.width - b.width) <= RECT_EPSILON &&
    Math.abs(a.height - b.height) <= RECT_EPSILON
  );
};

const isSameHoverState = (a: HoverState | null, b: HoverState | null) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.pos === b.pos && isSameRect(a.tableRect, b.tableRect);
};

export function TableHoverControls({ editor }: TableHoverControlsProps) {
  const isHidden = useScrollHide(editor);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [visible, setVisible] = useState(false);

  const controlsRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverStateRef = useRef<HoverState | null>(null);

  useEffect(() => {
    hoverStateRef.current = hoverState;
  }, [hoverState]);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const setHoverStateIfChanged = useCallback((nextState: HoverState | null) => {
    setHoverState((prev) => (isSameHoverState(prev, nextState) ? prev : nextState));
  }, []);

  useEffect(() => {
    if (!editor) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!editor.isEditable || isHidden) return;
      const target = e.target as HTMLElement;

      if (controlsRef.current?.contains(target)) {
        clearHideTimeout();
        return;
      }

      const currentHoverState = hoverStateRef.current;
      const cell = target.closest("td, th") as HTMLTableCellElement | null;
      const table = cell?.closest("table");
      const currentTableRect =
        table?.getBoundingClientRect() ?? currentHoverState?.tableRect;

      if (!cell || !table || !editor.view.dom.contains(table)) {
        const isNearRowBar =
          !!currentHoverState &&
          currentHoverState.type !== "none" &&
          !!currentTableRect &&
          Math.abs(
            e.clientX - (currentTableRect.left + currentTableRect.width / 2),
          ) <
            currentTableRect.width / 2 + 20 &&
          Math.abs(e.clientY - (currentTableRect.bottom + 16)) < 30;

        const isNearColBar =
          !!currentHoverState &&
          currentHoverState.type !== "none" &&
          !!currentTableRect &&
          Math.abs(e.clientX - (currentTableRect.right + 16)) < 30 &&
          Math.abs(
            e.clientY - (currentTableRect.top + currentTableRect.height / 2),
          ) <
            currentTableRect.height / 2 + 20;

        if (!isNearRowBar && !isNearColBar && !hideTimeoutRef.current && currentHoverState) {
          setVisible((prev) => (prev ? false : prev));
          hideTimeoutRef.current = setTimeout(() => {
            hideTimeoutRef.current = null;
            setHoverStateIfChanged(null);
          }, 50);
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
        setVisible((prev) => (prev ? false : prev));
        setHoverStateIfChanged(null);
        return;
      }

      const tableRect = currentTableRect!;

      try {
        const pos = editor.view.posAtDOM(cell, 0);
        let type: HoverType = "none";

        if (isLastRow && isLastCol) type = "both";
        else if (isLastRow) type = "row";
        else if (isLastCol) type = "col";

        const nextHoverState: HoverState = {
          type,
          tableRect,
          pos: pos - 1,
        };

        setHoverStateIfChanged(nextHoverState);
        setVisible((prev) => (prev ? prev : true));
      } catch (err) {
        console.warn("Failed to get pos for table cell", err);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      clearHideTimeout();
    };
  }, [editor, clearHideTimeout, setHoverStateIfChanged, isHidden]);

  useEffect(() => {
    if (!isHidden) return;
    clearHideTimeout();
    setVisible((prev) => (prev ? false : prev));
    setHoverStateIfChanged(null);
  }, [isHidden, clearHideTimeout, setHoverStateIfChanged]);

  useEffect(() => {
    return subscribeGlobalScrollActivity((nextSnapshot) => {
      if (!nextSnapshot.isScrolling) return;
      clearHideTimeout();
      setVisible((prev) => (prev ? false : prev));
      setHoverStateIfChanged(null);
    });
  }, [clearHideTimeout, setHoverStateIfChanged]);

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

  if (!hoverState || isHidden) return null;

  const { type, tableRect, pos } = hoverState;

  const baseBarStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "opacity 0.1s ease-out, background-color 0.1s",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
  };

  const barClasses =
    "bg-gradient-to-br from-muted/85 to-muted/78 hover:from-primary/25 hover:to-primary/15 text-muted-foreground border border-border/50 rounded-sm backdrop-blur-[1px] table-add-control transition-all duration-100";

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
    setVisible((prev) => (prev ? false : prev));
    setTimeout(() => setHoverStateIfChanged(null), 200);
  };

  const handleAddCol = () => {
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1)
      .addColumnAfter()
      .run();
    setVisible((prev) => (prev ? false : prev));
    setTimeout(() => setHoverStateIfChanged(null), 200);
  };

  const suppressDragHandle = () => {
    document.body.classList.add("drag-handle-suppressed");
  };

  const restoreDragHandle = () => {
    document.body.classList.remove("drag-handle-suppressed");
  };

  return (
    <div ref={controlsRef}>

    </div>
  );
}
