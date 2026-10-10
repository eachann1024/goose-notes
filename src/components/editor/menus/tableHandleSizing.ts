import type { PartialTableContent } from "@blocknote/core";

export function getTableColumnCount(content: PartialTableContent<any, any>) {
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

export function getBlockElementWidth(blockId: string | undefined) {
  if (!blockId) return 0;
  const blockElement = document.querySelector<HTMLElement>(
    `.bn-block[data-id="${blockId}"]`,
  );
  return blockElement?.getBoundingClientRect().width ?? 0;
}

export function getEvenColumnWidths(columnCount: number, tableWidth: number) {
  if (columnCount <= 0 || tableWidth <= 0) return undefined;
  const baseWidth = Math.floor(tableWidth / columnCount);
  const widths = Array.from({ length: columnCount }, () => baseWidth);
  widths[widths.length - 1] += Math.round(tableWidth - baseWidth * columnCount);
  return widths;
}
