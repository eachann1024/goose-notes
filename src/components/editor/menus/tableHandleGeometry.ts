export function tableHandleRect(
  table: Pick<DOMRect, "x" | "y" | "width" | "height">,
  cell: Pick<DOMRect, "x" | "y" | "width" | "height">,
  axis: "row" | "column",
  dragging?: { draggedCellOrientation: "row" | "col"; mousePos: number },
) {
  return axis === "row"
    ? {
        x: table.x,
        y:
          dragging?.draggedCellOrientation === "row"
            ? dragging.mousePos - cell.height / 2
            : cell.y,
        width: table.width,
        height: cell.height,
      }
    : {
        x:
          dragging?.draggedCellOrientation === "col"
            ? dragging.mousePos - cell.width / 2
            : cell.x,
        y: table.y,
        width: cell.width,
        height: table.height,
      };
}

/** An unmount/close may only release its own controller slot. */
export function releaseTableChrome<T extends string>(
  current: T | undefined,
  owner: T,
): T | undefined {
  return current === owner ? undefined : current;
}
