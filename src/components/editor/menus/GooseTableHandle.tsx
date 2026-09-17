import { useCallback, useEffect, useRef, useState, useId } from "react";
import * as LucideIcons from "lucide-react";
import {
  EMPTY_CELL_HEIGHT,
  EMPTY_CELL_WIDTH,
  type PartialTableContent,
} from "@blocknote/core";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/editor/ui/dropdown-menu";
import { Dropdown, Header } from "@heroui/react";
import {
  duplicateTableDimension,
  editTableDimension,
  hasMergedTableCells,
  insertTableDimension,
  tableHandleColumnIndex,
  tableDimensionColor,
} from "./tableMenuActions";
import { cn } from "@/components/editor/utils/cn";
import { useEditorSettings } from "@/components/editor/platform/hostContext";
import {
  createTableDeletionSnapshot,
  getTableDeletionLabel,
  isCellSelectionInsideBlock,
  type TableDeletionSnapshot,
} from "./tableDeletion";
import { isTableExtendPointerClick } from "./tableExtendClick";

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
      <LucideIcons.Plus className="h-3.5 w-3.5" />
    </button>
  );
}

type TableHandleProps = {
  orientation: "row" | "column";
  hideOtherElements: (hide: boolean) => void;
};

function getTableColumnCount(content: PartialTableContent<any, any>) {
  return Math.max(
    0,
    ...content.rows.map((row) =>
      row.cells.reduce((count, cell) => {
        if (
          typeof cell === "object" &&
          cell !== null &&
          "type" in cell &&
          cell.type === "tableCell"
        ) {
          return count + Math.max(1, Number(cell.props?.colspan) || 1);
        }
        return count + 1;
      }, 0),
    ),
  );
}

function getBlockElementWidth(blockId: string | undefined) {
  if (!blockId) return 0;
  const blockElement = document.querySelector<HTMLElement>(
    `.bn-block[data-id="${blockId}"]`,
  );
  return blockElement?.getBoundingClientRect().width ?? 0;
}

function getEvenColumnWidths(columnCount: number, tableWidth: number) {
  if (columnCount <= 0 || tableWidth <= 0) return undefined;
  const baseWidth = Math.floor(tableWidth / columnCount);
  const widths = Array.from({ length: columnCount }, () => baseWidth);
  widths[widths.length - 1] += Math.round(tableWidth - baseWidth * columnCount);
  return widths;
}

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

export function GooseTableHandle({
  orientation,
  hideOtherElements,
}: TableHandleProps) {
  const editor = useBlockNoteEditor<any, any, any>();
  const { features } = useEditorSettings();
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
  const mergeNoteId = useId();
  const ownsInteraction = useRef(false);
  const ownsDrag = useRef(false);

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
      if (ownsDrag.current) tableHandles?.dragEnd();
      hideOtherElements(false);
    },
    [tableHandles, hideOtherElements],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!tableHandles || !state?.block) return;
      ownsInteraction.current = true;
      ownsDrag.current = true;
      hideOtherElements(true);
      if (orientation === "column") {
        tableHandles.colDragStart(e);
      } else {
        tableHandles.rowDragStart(e);
      }
    },
    [tableHandles, state, orientation, hideOtherElements],
  );

  const handleDragEnd = useCallback(() => {
    if (!tableHandles) return;
    ownsInteraction.current = false;
    ownsDrag.current = false;
    tableHandles.dragEnd();
    hideOtherElements(false);
  }, [tableHandles, hideOtherElements]);

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

  if (!editor.isEditable) return null;
  if (!state || index === undefined) return null;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(open) => {
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
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="bn-table-handle goose-editor-position-safe-trigger goose-table-handle-btn"
          aria-label={isRow ? "行操作" : "列操作"}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {isRow ? (
            <LucideIcons.GripVertical className="h-4 w-4" />
          ) : (
            <LucideIcons.GripHorizontal className="h-4 w-4" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        editorContext
        variant="menu"
        className="goose-table-menu"
        side={isRow ? "right" : "bottom"}
        align="start"
      >
        <Dropdown.Section aria-label={`第 ${index + 1} ${isRow ? "行" : "列"}`}>
          <Header className="goose-table-menu-heading px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground">
            第 {index + 1} {isRow ? "行" : "列"}
          </Header>
          <DropdownMenuItem
            onSelect={() => runMenuAction(() => insertDimension(true))}
          >
            {isRow ? <LucideIcons.ArrowUp /> : <LucideIcons.ArrowLeft />}{" "}
            {isRow ? "在上方插入行" : "在左侧插入列"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => runMenuAction(() => insertDimension(false))}
          >
            {isRow ? <LucideIcons.ArrowDown /> : <LucideIcons.ArrowRight />}{" "}
            {isRow ? "在下方插入行" : "在右侧插入列"}
          </DropdownMenuItem>
        </Dropdown.Section>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={hasMergedTableCells(state.block.content)}
          aria-describedby={
            hasMergedTableCells(state.block.content) ? mergeNoteId : undefined
          }
          onSelect={() => runMenuAction(duplicateDimension)}
        >
          <LucideIcons.Copy /> 复制{isRow ? "行" : "列"}
        </DropdownMenuItem>
        {hasMergedTableCells(state.block.content) && (
          <DropdownMenuItem
            disabled
            id={mergeNoteId}
            className="goose-table-menu-note"
          >
            含合并单元格，暂不支持复制行列
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() =>
            runMenuAction(() =>
              editor.exec(
                editTableDimension(state.block.id, orientation, index, {
                  type: "clear",
                }),
              ),
            )
          }
        >
          <LucideIcons.Eraser /> 清空内容
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <Dropdown.SubmenuTrigger>
          <DropdownMenuItem textValue="颜色">
            <LucideIcons.Palette /> 颜色{" "}
            <LucideIcons.ChevronRight className="ml-auto" />
          </DropdownMenuItem>
          <DropdownMenuContent
            editorContext
            variant="menu"
            className="goose-table-menu goose-table-color-menu"
            side="right"
          >
            {(["textColor", "backgroundColor"] as const).map((property) => {
              const selectedColor = tableDimensionColor(
                editor.prosemirrorState,
                state.block.id,
                orientation,
                index,
                property,
              );
              return (
                <Dropdown.Section
                  key={property}
                  className="goose-table-color-group"
                  aria-label={
                    property === "textColor" ? "文字颜色" : "背景颜色"
                  }
                  selectionMode="single"
                  selectedKeys={
                    selectedColor ? [`${property}:${selectedColor}`] : []
                  }
                >
                  <Header className="goose-table-menu-heading px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground">
                    {property === "textColor" ? "文字颜色" : "背景颜色"}
                  </Header>
                  {(
                    [
                      ["default", "默认"],
                      ["gray", "灰色"],
                      ["brown", "褐色"],
                      ["green", "绿色"],
                      ["blue", "蓝色"],
                    ] as const
                  ).map(([color, label]) => (
                    <DropdownMenuItem
                      key={color}
                      id={`${property}:${color}`}
                      className="goose-table-color-swatch"
                      aria-label={`${label}${property === "textColor" ? "文字" : "背景"}`}
                      textValue={`${label}${property === "textColor" ? "文字" : "背景"}`}
                      style={
                        {
                          "--goose-table-swatch-fg":
                            property === "textColor" && color !== "default"
                              ? `var(--goose-editor-highlight-${color}-text)`
                              : "hsl(var(--foreground))",
                          "--goose-table-swatch-bg":
                            property === "backgroundColor" &&
                            color !== "default"
                              ? `var(--goose-editor-highlight-${color}-bg)`
                              : "hsl(var(--background))",
                        } as React.CSSProperties
                      }
                      onSelect={() =>
                        runMenuAction(() =>
                          editor.exec(
                            editTableDimension(
                              state.block.id,
                              orientation,
                              index,
                              { type: "color", property, color },
                            ),
                          ),
                        )
                      }
                    >
                      <span aria-hidden="true">A</span>
                    </DropdownMenuItem>
                  ))}
                </Dropdown.Section>
              );
            })}
          </DropdownMenuContent>
        </Dropdown.SubmenuTrigger>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="goose-menu-item-danger"
          onSelect={handleDelete}
        >
          <LucideIcons.Trash2 />{" "}
          {deletionSnapshot
            ? getTableDeletionLabel(deletionSnapshot.plan)
            : isRow
              ? "删除行"
              : "删除列"}
        </DropdownMenuItem>
        {features.tablePresentationControls && (
          <>
            <DropdownMenuSeparator />
            <Dropdown.SubmenuTrigger>
              <DropdownMenuItem textValue="表格选项">
                <LucideIcons.Table2 /> 表格选项{" "}
                <LucideIcons.ChevronRight className="ml-auto" />
              </DropdownMenuItem>
              <DropdownMenuContent
                editorContext
                variant="menu"
                className="goose-table-menu"
                side="right"
              >
                {(["headerRows", "headerCols"] as const).map((key) => (
                  <DropdownMenuItem
                    key={key}
                    textValue={`${key === "headerRows" ? "标题行" : "标题列"}，${state.block.content[key] ? "已启用" : "未启用"}`}
                    onSelect={() => runMenuAction(() => toggleHeader(key))}
                  >
                    {key === "headerRows" ? (
                      <LucideIcons.PanelTop />
                    ) : (
                      <LucideIcons.PanelLeft />
                    )}
                    {key === "headerRows" ? "标题行" : "标题列"}
                    <span className="sr-only">
                      {state.block.content[key] ? "已启用" : "未启用"}
                    </span>
                    {Boolean(state.block.content[key]) && (
                      <LucideIcons.Check className="ml-auto" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  onSelect={() => runMenuAction(handleEvenColumnWidth)}
                >
                  <LucideIcons.AlignJustify /> 两端对齐
                </DropdownMenuItem>
              </DropdownMenuContent>
            </Dropdown.SubmenuTrigger>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
