import { useCallback, useEffect, useRef, useState } from "react";
import type { PartialTableContent } from "@blocknote/core";
import { TableHandlesExtension } from "@blocknote/core/extensions";
import {
  CellSelection,
  deleteColumn,
  deleteRow,
  selectedRect,
} from "prosemirror-tables";
import {
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import {
  duplicateTableDimension,
  insertTableDimension,
  tableHandleColumnIndex,
} from "./tableMenuActions";
import {
  createTableDeletionSnapshot,
  isCellSelectionInsideBlock,
  type TableDeletionSnapshot,
} from "./tableDeletion";
import {
  getTableColumnCount,
  getBlockElementWidth,
  getEvenColumnWidths,
} from "./tableHandleSizing";

function deleteTableBlock(editor: any, block: any) {
  const previousBlock = editor.getPrevBlock(block);
  const nextBlock = editor.getNextBlock(block);

  if (!previousBlock && !nextBlock) {
    const [replacement] = editor.replaceBlocks(
      [block],
      [{ type: "paragraph" }],
    );
    if (replacement) editor.setTextCursorPosition(replacement, "start");
    return;
  }

  editor.removeBlocks([block]);
  if (previousBlock) {
    editor.setTextCursorPosition(previousBlock, "end");
  } else if (nextBlock) {
    editor.setTextCursorPosition(nextBlock, "start");
  }
}

export function useGooseTableHandle(
  orientation: "row" | "column",
  hideOtherElements: (hide: boolean) => void,
) {
  const editor = useBlockNoteEditor<any, any, any>();
  const tableHandles = useExtension(TableHandlesExtension);
  const state = useExtensionState(TableHandlesExtension);
  const [open, setOpen] = useState(false);
  const [deletionSnapshot, setDeletionSnapshot] =
    useState<TableDeletionSnapshot>();

  const index = state
    ? orientation === "column"
      ? state.colIndex === undefined
        ? undefined
        : tableHandleColumnIndex(
            editor.prosemirrorState,
            state.block.id,
            state.rowIndex ?? 0,
            state.colIndex,
          )
      : state.rowIndex
    : undefined;
  const isRow = orientation === "row";
  const ownsInteraction = useRef(false);

  const closeMenu = useCallback(() => {
    setOpen(false);
    ownsInteraction.current = false;
    tableHandles?.unfreezeHandles();
    hideOtherElements(false);
    editor.focus();
  }, [editor, hideOtherElements, tableHandles]);

  useEffect(
    () => () => {
      if (!ownsInteraction.current) return;
      tableHandles?.unfreezeHandles();
      hideOtherElements(false);
    },
    [tableHandles, hideOtherElements],
  );

  const insertDimension = (before: boolean) => {
    if (!state?.block || index === undefined) return;
    editor.exec(
      insertTableDimension(state.block.id, orientation, index, before),
    );
  };

  const duplicateDimension = () => {
    if (!state?.block || index === undefined) return;
    editor.updateBlock(state.block, {
      type: "table",
      content: duplicateTableDimension(state.block.content, orientation, index),
    });
  };

  const captureDeletionSnapshot = useCallback(() => {
    if (!state?.block || index === undefined) return;

    const block = state.block;
    const content = block.content as PartialTableContent<any, any>;
    const selection = editor.prosemirrorState.selection;
    let selectionRect;
    if (
      selection instanceof CellSelection &&
      isCellSelectionInsideBlock(
        editor.prosemirrorState.doc,
        block.id,
        selection.$anchorCell.pos,
        selection.$headCell.pos,
      )
    ) {
      const rect = selectedRect(editor.prosemirrorState);
      selectionRect = {
        blockId: block.id,
        anchorCell: selection.$anchorCell.pos,
        headCell: selection.$headCell.pos,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      };
    }

    return createTableDeletionSnapshot({
      blockId: block.id,
      orientation,
      handleIndex: index,
      rowCount: content.rows.length,
      columnCount: getTableColumnCount(content),
      selection: selectionRect,
    });
  }, [editor, index, orientation, state]);

  const handleDelete = useCallback(() => {
    // Reuse the displayed target even if menu dismissal changes live selection.
    const snapshot = deletionSnapshot;
    if (!snapshot || !tableHandles) return;
    const block = editor.getBlock(snapshot.blockId);
    if (!block || block.type !== "table") return;

    if (snapshot.plan.kind === "delete-table") {
      deleteTableBlock(editor, block);
      return;
    }

    const { fromIndex, toIndex } = snapshot.plan;
    editor.exec((beforeState, dispatch) => {
      const commandState = snapshot.cellSelection
        ? beforeState.apply(
            beforeState.tr.setSelection(
              CellSelection.create(
                beforeState.doc,
                snapshot.cellSelection.anchorCell,
                snapshot.cellSelection.headCell,
              ),
            ),
          )
        : tableHandles.setCellSelection(
            beforeState,
            isRow ? { row: fromIndex, col: 0 } : { row: 0, col: fromIndex },
            isRow
              ? { row: toIndex - 1, col: snapshot.columnCount - 1 }
              : { row: snapshot.rowCount - 1, col: toIndex - 1 },
          );

      return isRow
        ? deleteRow(commandState, dispatch)
        : deleteColumn(commandState, dispatch);
    });
  }, [deletionSnapshot, editor, isRow, tableHandles]);

  const toggleHeader = (key: "headerRows" | "headerCols") => {
    if (!state?.block) return;
    editor.updateBlock(state.block, {
      type: "table",
      content: {
        ...state.block.content,
        [key]: state.block.content[key] ? undefined : 1,
      },
    });
  };

  const handleEvenColumnWidth = useCallback(() => {
    if (!state?.block) return;
    const content = state.block.content as PartialTableContent<any, any>;
    const columnCount = getTableColumnCount(content);
    const columnWidths = getEvenColumnWidths(
      columnCount,
      getBlockElementWidth(state.block.id),
    );
    if (!columnWidths) return;

    editor.updateBlock(state.block, {
      type: "table",
      content: {
        ...content,
        columnWidths,
      } as any,
    });
    editor.setTextCursorPosition(state.block);
  }, [editor, state?.block]);

  const runMenuAction = useCallback(
    (action: () => void) => {
      action();
      closeMenu();
    },
    [closeMenu],
  );

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    ownsInteraction.current = open;
    if (open) {
      // Capture before focus moves into the menu; label and action share it.
      setDeletionSnapshot(captureDeletionSnapshot());
      tableHandles?.freezeHandles();
      hideOtherElements(true);
    } else {
      tableHandles?.unfreezeHandles();
      hideOtherElements(false);
      editor.focus();
    }
  };
  return {
    editor,
    state,
    index,
    isRow,
    open,
    deletionSnapshot,
    insertDimension,
    duplicateDimension,
    handleDelete,
    toggleHeader,
    handleEvenColumnWidth,
    runMenuAction,
    handleOpenChange,
  };
}
