import { getNodeById, type PartialTableContent } from "@blocknote/core";
import type { Command, EditorState } from "prosemirror-state";
import { addColumn, addRow, TableMap } from "prosemirror-tables";

type Axis = "row" | "column";
type Content = PartialTableContent<any, any>;

export function hasMergedTableCells(content: Content) {
  return content.rows.some((row) =>
    row.cells.some(
      (cell) =>
        typeof cell === "object" &&
        cell !== null &&
        "type" in cell &&
        cell.type === "tableCell" &&
        ((cell.props?.colspan ?? 1) > 1 || (cell.props?.rowspan ?? 1) > 1),
    ),
  );
}

export function duplicateTableDimension(
  content: Content,
  axis: Axis,
  index: number,
): Content {
  // ponytail: merged tables are disabled in the menu; upgrade with span-aware duplication.
  if (hasMergedTableCells(content))
    throw new Error("含合并单元格，暂不支持复制行列");
  const count =
    axis === "row" ? content.rows.length : (content.rows[0]?.cells.length ?? 0);
  if (!Number.isInteger(index) || index < 0 || index >= count)
    throw new RangeError("Invalid table handle index");
  const next = structuredClone(content);
  if (axis === "row") {
    next.rows.splice(index + 1, 0, structuredClone(next.rows[index]));
  } else {
    for (const row of next.rows)
      row.cells.splice(
        index + 1,
        0,
        structuredClone(row.cells[index]) as never,
      );
    next.columnWidths?.splice(index + 1, 0, next.columnWidths[index]);
  }
  return next;
}

function tableDimension(
  state: EditorState,
  blockId: string,
  axis: Axis,
  index: number,
) {
  const block = getNodeById(blockId, state.doc);
  const table = block?.node.firstChild;
  if (!block || table?.type.spec.tableRole !== "table") return;
  const map = TableMap.get(table);
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= (axis === "row" ? map.height : map.width)
  )
    return;
  // Include cells spanning into the target and deduplicate merged cells.
  const offsets = new Set<number>();
  for (let i = 0; i < (axis === "row" ? map.width : map.height); i++) {
    offsets.add(
      map.map[axis === "row" ? index * map.width + i : i * map.width + index],
    );
  }
  return { table, map, start: block.posBeforeNode + 2, offsets: [...offsets] };
}

/** Only a uniform dimension has a checked swatch; mixed colors leave all unchecked. */
export function tableDimensionColor(
  state: EditorState,
  blockId: string,
  axis: Axis,
  index: number,
  property: "textColor" | "backgroundColor",
) {
  const target = tableDimension(state, blockId, axis, index);
  if (!target) return;
  const colors = new Set(
    target.offsets.map(
      (offset) => target.table.nodeAt(offset)!.attrs[property] ?? "default",
    ),
  );
  return colors.size === 1
    ? (colors.values().next().value as string)
    : undefined;
}

/** Plugin colIndex is a DOM cell index, not a grid column when earlier cells span. */
export function tableHandleColumnIndex(
  state: EditorState,
  blockId: string,
  rowIndex: number,
  cellIndex: number,
) {
  const table = getNodeById(blockId, state.doc)?.node.firstChild;
  const row = table?.maybeChild(rowIndex);
  if (!table || !row || !row.maybeChild(cellIndex)) return cellIndex;
  let offset = 1;
  for (let i = 0; i < rowIndex; i++) offset += table.child(i).nodeSize;
  for (let i = 0; i < cellIndex; i++) offset += row.child(i).nodeSize;
  return TableMap.get(table).findCell(offset).left;
}

export function insertTableDimension(
  blockId: string,
  axis: Axis,
  index: number,
  before: boolean,
): Command {
  return (state, dispatch) => {
    const target = tableDimension(state, blockId, axis, index);
    if (!target) return false;
    const rect = {
      table: target.table,
      map: target.map,
      tableStart: target.start,
      left: 0,
      top: 0,
      right: target.map.width,
      bottom: target.map.height,
    };
    const tr = (axis === "row" ? addRow : addColumn)(
      state.tr,
      rect,
      index + (before ? 0 : 1),
    );
    dispatch?.(tr);
    return true;
  };
}

export function editTableDimension(
  blockId: string,
  axis: Axis,
  index: number,
  action:
    | { type: "clear" }
    | {
        type: "color";
        property: "textColor" | "backgroundColor";
        color: string;
      },
): Command {
  return (state, dispatch) => {
    const target = tableDimension(state, blockId, axis, index);
    if (!target) return false;
    const tr = state.tr;
    for (const offset of target.offsets.sort((a, b) => b - a)) {
      const cell = target.table.nodeAt(offset)!;
      const pos = target.start + offset;
      if (action.type === "clear") {
        const empty = cell.type.contentMatch.defaultType?.createAndFill();
        if (!empty) return false;
        tr.replaceWith(pos + 1, pos + cell.nodeSize - 1, empty);
      } else {
        tr.setNodeMarkup(pos, undefined, {
          ...cell.attrs,
          [action.property]: action.color,
        });
      }
    }
    dispatch?.(tr);
    return true;
  };
}
