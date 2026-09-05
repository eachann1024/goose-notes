export type TableSelectionRect = {
  blockId: string;
  anchorCell?: number;
  headCell?: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type TableDeletionPlan =
  | { kind: "delete-table" }
  | {
      kind: "delete-rows" | "delete-columns";
      fromIndex: number;
      toIndex: number;
    };

export type TableDeletionSnapshot = {
  blockId: string;
  orientation: "row" | "column";
  rowCount: number;
  columnCount: number;
  plan: TableDeletionPlan;
  cellSelection?: { anchorCell: number; headCell: number };
};

type CreateTableDeletionSnapshotInput = {
  blockId: string;
  orientation: "row" | "column";
  handleIndex: number;
  rowCount: number;
  columnCount: number;
  selection?: TableSelectionRect;
};

function clampIndex(index: number, count: number) {
  return Math.max(0, Math.min(Math.trunc(index), Math.max(0, count - 1)));
}

export function findBlockDocumentRange(
  doc: ProseMirrorNode,
  blockId: string,
): { from: number; to: number } | null {
  let range: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (node.type.name === "blockContainer" && node.attrs.id === blockId) {
      range = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return range === null;
  });

  return range;
}

/** Checks CellSelection positions without calling BlockNote cursor APIs. */
export function isCellSelectionInsideBlock(
  doc: ProseMirrorNode,
  blockId: string,
  anchorCell: number,
  headCell: number,
) {
  const range = findBlockDocumentRange(doc, blockId);
  if (!range) return false;

  return (
    anchorCell > range.from &&
    anchorCell < range.to &&
    headCell > range.from &&
    headCell < range.to
  );
}

/**
 * Freezes the row/column range that a table-menu delete action targets.
 *
 * A multi-row or multi-column CellSelection wins over the hovered handle. A
 * one-cell selection keeps the handle semantics. Removing the final dimension
 * deletes the table block because prosemirror-tables intentionally rejects
 * deleting every row or every column.
 */
export function createTableDeletionSnapshot({
  blockId,
  orientation,
  handleIndex,
  rowCount,
  columnCount,
  selection,
}: CreateTableDeletionSnapshotInput): TableDeletionSnapshot {
  const dimensionCount = orientation === "row" ? rowCount : columnCount;
  const sameTableSelection =
    selection?.blockId === blockId ? selection : undefined;
  const selectionFrom =
    orientation === "row" ? sameTableSelection?.top : sameTableSelection?.left;
  const selectionTo =
    orientation === "row"
      ? sameTableSelection?.bottom
      : sameTableSelection?.right;
  const hasMultiSelection =
    selectionFrom !== undefined &&
    selectionTo !== undefined &&
    selectionTo - selectionFrom > 1;
  const fromIndex = hasMultiSelection
    ? Math.max(0, Math.min(selectionFrom, dimensionCount))
    : clampIndex(handleIndex, dimensionCount);
  const toIndex = hasMultiSelection
    ? Math.max(fromIndex, Math.min(selectionTo, dimensionCount))
    : Math.min(dimensionCount, fromIndex + 1);

  const plan: TableDeletionPlan =
    dimensionCount <= 1 || (fromIndex === 0 && toIndex >= dimensionCount)
      ? { kind: "delete-table" }
      : {
          kind: orientation === "row" ? "delete-rows" : "delete-columns",
          fromIndex,
          toIndex,
        };
  const cellSelection =
    hasMultiSelection &&
    sameTableSelection?.anchorCell !== undefined &&
    sameTableSelection.headCell !== undefined
      ? {
          anchorCell: sameTableSelection.anchorCell,
          headCell: sameTableSelection.headCell,
        }
      : undefined;

  return {
    blockId,
    orientation,
    rowCount,
    columnCount,
    plan,
    cellSelection,
  };
}
import type { Node as ProseMirrorNode } from "prosemirror-model";
