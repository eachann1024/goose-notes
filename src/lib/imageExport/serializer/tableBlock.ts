import type { CardTheme } from "../themes";
import { escapeHtml } from "./utils";
import { renderInline, extractCellTextForHtml } from "./inline";
import { buildBlockStyleAttr } from "./blockStyles";

function tableCellProps(cell: any): Record<string, unknown> {
  if (cell && typeof cell === "object" && !Array.isArray(cell) && cell.props) {
    return cell.props as Record<string, unknown>;
  }
  return {};
}

function buildTableCellTagAttr(cell: any, theme: CardTheme): string {
  const props = tableCellProps(cell);
  const parts: string[] = [];
  const colspan = Number(props.colspan ?? props.colSpan);
  const rowspan = Number(props.rowspan ?? props.rowSpan);
  if (Number.isInteger(colspan) && colspan > 1) parts.push(`colspan="${colspan}"`);
  if (Number.isInteger(rowspan) && rowspan > 1) parts.push(`rowspan="${rowspan}"`);
  const styleAttr = buildBlockStyleAttr({ props }, theme).trim();
  if (styleAttr) parts.push(styleAttr);
  return parts.length ? ` ${parts.join(" ")}` : "";
}


function renderTableCellContent(cell: any, theme: CardTheme): string {
  if (cell == null) return "";
  if (typeof cell === "string") return escapeHtml(cell).replace(/\n/g, "<br>");
  // BlockNote tableCell: { type, content: InlineContent[] | paragraph[] }
  if (typeof cell === "object" && !Array.isArray(cell) && Array.isArray(cell.content)) {
    return renderTableCellContent(cell.content, theme);
  }
  if (Array.isArray(cell)) {
    // 可能是 inline 数组，或内嵌 paragraph 块
    const hasParagraph = cell.some(
      (c: any) => c && typeof c === "object" && c.type === "paragraph",
    );
    if (hasParagraph) {
      return cell
        .map((c: any) => {
          if (c?.type === "paragraph") return renderInline(c.content, theme);
          return renderInline([c], theme);
        })
        .join("<br>");
    }
    return renderInline(cell, theme);
  }
  if (typeof cell === "object" && cell.text) {
    return escapeHtml(String(cell.text)).replace(/\n/g, "<br>");
  }
  return escapeHtml(extractCellTextForHtml(cell)).replace(/\n/g, "<br>");
}


export function renderTableBlock(block: any, theme: CardTheme, styleAttr: string): string {
      const rows = block.content?.rows || [];
      if (!rows.length) return "";
      const headerRowsRaw = Number(block.content?.headerRows);
      const headerRows =
        Number.isFinite(headerRowsRaw) && headerRowsRaw >= 0 ? Math.floor(headerRowsRaw) : 1;
      const headerColsRaw = Number(block.content?.headerCols);
      const headerCols =
        Number.isFinite(headerColsRaw) && headerColsRaw > 0 ? Math.floor(headerColsRaw) : 0;
      const htmlRows = rows.map((row: any, i: number) => {
        const cells = row.cells || [];
        return `<tr>${cells
          .map((cell: any, j: number) => {
            const tag = i < headerRows || j < headerCols ? "th" : "td";
            return `<${tag}${buildTableCellTagAttr(cell, theme)}>${renderTableCellContent(cell, theme)}</${tag}>`;
          })
          .join("")}</tr>`;
      });
      return `<table${styleAttr}><tbody>${htmlRows.join("")}</tbody></table>`;
}
