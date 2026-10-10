import { BorderStyle, ShadingType, Table, TableCell, TableRow, VerticalAlign, WidthType } from "docx";
import { alignmentFromBlock, inlineContentToChildren, emptyRun } from "./docxStyles";
import { tightParagraph } from "./docxLayout";
import { DOCX_COLORS, DOCX_BACKGROUND_COLORS, resolveNamedColor } from "./docxTheme";
import { asRecord, type DocxExportContext } from "./docxBlockContext";

function cellInline(cell: unknown): unknown {
  if (cell == null) return [];
  if (typeof cell === "string") return [{ type: "text", text: cell, styles: {} }];
  if (Array.isArray(cell)) return cell;
  const rec = asRecord(cell);
  if (!rec) return [];
  if (Array.isArray(rec.content)) return rec.content;
  if (typeof rec.text === "string") return [{ type: "text", text: rec.text, styles: rec.styles }];
  return [];
}

function cellProps(cell: unknown): Record<string, unknown> {
  return asRecord(asRecord(cell)?.props) ?? {};
}

export function blockToTable(block: unknown, ctx: DocxExportContext): Table | null {
  const rec = asRecord(block);
  const content = asRecord(rec?.content);
  const rows = Array.isArray(content?.rows)
    ? content.rows
    : Array.isArray(rec?.content)
      ? rec.content
      : [];
  if (!rows.length) return null;

  const headerRowsRaw = Number(content?.headerRows);
  const headerRows =
    Number.isFinite(headerRowsRaw) && headerRowsRaw >= 0 ? Math.floor(headerRowsRaw) : 1;
  const headerColsRaw = Number(content?.headerCols);
  const headerCols =
    Number.isFinite(headerColsRaw) && headerColsRaw > 0 ? Math.floor(headerColsRaw) : 0;
  const columnWidths = Array.isArray(content?.columnWidths)
    ? content.columnWidths.map((width) => {
        const n = Number(width);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })
    : [];

  const tableRows: TableRow[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = asRecord(rows[i]);
    const cells = Array.isArray(row?.cells)
      ? row.cells
      : Array.isArray(row?.content)
        ? row.content
        : [];
    const tableCells: TableCell[] = cells.map((cell: unknown, j: number) => {
      const isHeader = i < headerRows || j < headerCols;
      const props = cellProps(cell);
      const fill =
        resolveNamedColor(props.backgroundColor, DOCX_BACKGROUND_COLORS) ||
        (isHeader ? DOCX_COLORS.tableHeader : undefined);
      const width = columnWidths[j];
      const colspan = Number(props.colspan ?? props.colSpan);
      const rowspan = Number(props.rowspan ?? props.rowSpan);
      return new TableCell({
        children: [
          tightParagraph({
            alignment: alignmentFromBlock(props.textAlignment),
            children: (() => {
              const runs = inlineContentToChildren(cellInline(cell), ctx.font);
              return runs.length ? runs : [emptyRun(ctx.font)];
            })(),
          }),
        ],
        width:
          typeof width === "number"
            ? { size: Math.round(width * 15), type: WidthType.DXA }
            : undefined,
        columnSpan: Number.isInteger(colspan) && colspan > 1 ? colspan : undefined,
        rowSpan: Number.isInteger(rowspan) && rowspan > 1 ? rowspan : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.tableBorder },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.tableBorder },
          left: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.tableBorder },
          right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.tableBorder },
        },
      });
    });
    if (tableCells.length) {
      tableRows.push(new TableRow({ children: tableCells }));
    }
  }
  if (!tableRows.length) return null;
  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: "fixed",
  });
}
