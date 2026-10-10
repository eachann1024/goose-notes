import { useCallback, useEffect, useRef, useState } from "react";
import * as GooseIcons from "@/components/ui/icons";
import {
  EMPTY_CELL_HEIGHT,
  EMPTY_CELL_WIDTH,
  type PartialTableContent,
} from "@blocknote/core";
import { TableHandlesExtension } from "@blocknote/core/extensions";
import {
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { cn } from "@/components/editor/utils/cn";
import { isTableExtendPointerClick } from "./tableExtendClick";
import { getTableColumnCount } from "./tableHandleSizing";

type TableExtendButtonProps = {
  orientation: "addOrRemoveRows" | "addOrRemoveColumns";
  hideOtherElements: (hide: boolean) => void;
};

const roundTableExtendDelta = (value: number, margin = 0.3) => {
  const lowerBound = Math.floor(value) + margin;
  const upperBound = Math.ceil(value) - margin;

  if (value >= lowerBound && value <= upperBound) return Math.round(value);
  return value < lowerBound ? Math.floor(value) : Math.ceil(value);
};

export function GooseTableExtendButton({
  orientation,
  hideOtherElements,
}: TableExtendButtonProps) {
  const editor = useBlockNoteEditor<any, any, any>();
  const tableHandles = useExtension(TableHandlesExtension);
  const block = useExtensionState(TableHandlesExtension, {
    selector: (state) => state?.block,
  });
  const movedMouse = useRef(false);
  const extending = useRef(false);
  const [editingState, setEditingState] = useState<
    | {
        originalContent: PartialTableContent<any, any>;
        originalCroppedContent: PartialTableContent<any, any>;
        startPos: number;
      }
    | undefined
  >();
  const isColumnHandle = orientation === "addOrRemoveColumns";

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!block || event.button !== 0) return;
      extending.current = true;
      tableHandles.freezeHandles();
      hideOtherElements(true);

      setEditingState({
        originalContent: structuredClone(block.content) as any,
        originalCroppedContent: {
          ...block.content,
          rows: tableHandles.cropEmptyRowsOrColumns(
            block,
            isColumnHandle ? "columns" : "rows",
          ),
        } as PartialTableContent<any, any>,
        startPos: isColumnHandle ? event.clientX : event.clientY,
      });
      movedMouse.current = false;
      event.preventDefault();
    },
    [block, hideOtherElements, isColumnHandle, tableHandles],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!block || (event.detail !== 0 && movedMouse.current)) return;

      editor.updateBlock(block, {
        type: "table",
        content: {
          ...block.content,
          rows: isColumnHandle
            ? tableHandles.addRowsOrColumns(block, "columns", 1)
            : tableHandles.addRowsOrColumns(block, "rows", 1),
        } as any,
      });
    },
    [block, editor, isColumnHandle, tableHandles],
  );

  useEffect(() => {
    if (!editingState || !block) return;

    const handleMouseMove = (event: MouseEvent) => {
      const diff =
        (isColumnHandle ? event.clientX : event.clientY) -
        editingState.startPos;
      if (isTableExtendPointerClick(diff)) return;

      movedMouse.current = true;
      const croppedCount = isColumnHandle
        ? getTableColumnCount(editingState.originalCroppedContent)
        : editingState.originalCroppedContent.rows.length;
      const originalCount = isColumnHandle
        ? getTableColumnCount(editingState.originalContent)
        : editingState.originalContent.rows.length;
      const currentCount = isColumnHandle
        ? getTableColumnCount(block.content)
        : block.content.rows.length;
      const nextCount =
        originalCount +
        roundTableExtendDelta(
          diff / (isColumnHandle ? EMPTY_CELL_WIDTH : EMPTY_CELL_HEIGHT),
        );

      if (
        nextCount < croppedCount ||
        nextCount <= 0 ||
        nextCount === currentCount
      ) {
        return;
      }

      editor.updateBlock(block, {
        type: "table",
        content: {
          ...editingState.originalContent,
          columnWidths: isColumnHandle
            ? Array.from(
                { length: nextCount },
                (_, i) => editingState.originalContent.columnWidths?.[i],
              )
            : editingState.originalContent.columnWidths,
          rows: isColumnHandle
            ? tableHandles.addRowsOrColumns(
                {
                  type: "table",
                  content: editingState.originalCroppedContent,
                } as any,
                "columns",
                nextCount - croppedCount,
              )
            : tableHandles.addRowsOrColumns(
                {
                  type: "table",
                  content: editingState.originalCroppedContent,
                } as any,
                "rows",
                nextCount - croppedCount,
              ),
        } as any,
      });

      editor.setTextCursorPosition(block);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [block, editingState, editor, isColumnHandle, tableHandles]);

  useEffect(() => {
    if (!editingState) return;

    const handleMouseUp = () => {
      extending.current = false;
      hideOtherElements(false);
      tableHandles.unfreezeHandles();
      setEditingState(undefined);
    };

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
    };
  }, [editingState, hideOtherElements, tableHandles]);

  useEffect(
    () => () => {
      if (!extending.current) return;
      tableHandles.unfreezeHandles();
      hideOtherElements(false);
    },
    [tableHandles, hideOtherElements],
  );

  if (!editor.isEditable) return null;

  return (
    <button
      type="button"
      className={cn(
        "goose-editor-inline-context-ui goose-table-extend-button",
        isColumnHandle
          ? "goose-table-extend-button-columns"
          : "goose-table-extend-button-rows",
        editingState && "is-editing",
      )}
      aria-label={isColumnHandle ? "添加列" : "添加行"}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <GooseIcons.Plus className="h-3.5 w-3.5" />
    </button>
  );
}
