import type { PartialBlock } from "@blocknote/core";
import type { BlockNoteContent } from "./emptyContent";
import { createEmptyLocalPageContent } from "./emptyContent";
import { hasStructuredBlocks, simpleExtractText } from "./normalize";
import {
  getBlockSpecs,
  isPlainObject,
  sanitizeProps,
  sanitizeTableCellProps,
  type BlockSpecLike,
} from "./safeContentProps";
import { normalizeInlineContent } from "./safeInlineContent";
function sanitizeTableCell(cell: unknown): unknown {
  if (isPlainObject(cell) && cell.type === "tableCell") {
    const content = normalizeInlineContent(cell.content);
    const props = sanitizeTableCellProps(cell.props);
    return {
      type: "tableCell",
      ...(props ? { props } : {}),
      ...(content !== "" ? { content } : {}),
    };
  }
  return normalizeInlineContent(cell);
}

function sanitizeTableContent(
  content: unknown,
): PartialBlock["content"] | null {
  const rows = (content as { rows?: unknown } | undefined)?.rows;
  if (!Array.isArray(rows)) return null;

  const sanitizedRows: Array<{ cells: unknown[] }> = [];
  for (const row of rows) {
    const cells = (row as { cells?: unknown } | undefined)?.cells;
    if (!Array.isArray(cells)) continue;
    const sanitizedCells = cells.map(sanitizeTableCell);
    if (sanitizedCells.length > 0) {
      sanitizedRows.push({ cells: sanitizedCells });
    }
  }

  if (sanitizedRows.length === 0) return null;

  const tableContent = content as {
    columnWidths?: unknown;
    headerRows?: unknown;
    headerCols?: unknown;
  };
  const columnWidths = Array.isArray(tableContent.columnWidths)
    ? tableContent.columnWidths.map((width) => {
        const numberWidth = Number(width);
        return Number.isFinite(numberWidth) && numberWidth > 0
          ? numberWidth
          : undefined;
      })
    : undefined;
  const headerRows = Number(tableContent.headerRows);
  const headerCols = Number(tableContent.headerCols);

  return {
    type: "tableContent",
    ...(columnWidths ? { columnWidths } : {}),
    ...(Number.isFinite(headerRows) && headerRows > 0
      ? { headerRows: Math.floor(headerRows) }
      : {}),
    ...(Number.isFinite(headerCols) && headerCols > 0
      ? { headerCols: Math.floor(headerCols) }
      : {}),
    rows: sanitizedRows,
  } as PartialBlock["content"];
}

function fallbackBlocksFromUnsupported(
  block: Record<string, unknown>,
  specs: Record<string, BlockSpecLike>,
): PartialBlock[] {
  const nested = [
    ...(hasStructuredBlocks(block.content) ? block.content : []),
    ...(Array.isArray(block.children) ? block.children : []),
  ];
  const children = sanitizeBlocks(nested, specs);
  const text =
    simpleExtractText(block).trim() ||
    String(
      (block.props as Record<string, unknown> | undefined)?.url ?? "",
    ).trim();

  if (!text) return children;

  return [
    {
      type: "paragraph",
      content: text,
      ...(children.length > 0 ? { children } : {}),
    } as PartialBlock,
  ];
}

function sanitizeBlock(
  block: unknown,
  specs: Record<string, BlockSpecLike>,
): PartialBlock[] {
  if (!isPlainObject(block)) return [];

  const rawType = typeof block.type === "string" ? block.type : "";
  const spec = specs[rawType];
  if (!rawType || !spec) {
    return fallbackBlocksFromUnsupported(block, specs);
  }

  const contentKind = spec.config?.content;
  const next = { type: rawType } as PartialBlock;
  const props = sanitizeProps(rawType, block.props ?? block.attrs, spec);
  if (props) next.props = props;

  if (contentKind === "table") {
    const tableContent = sanitizeTableContent(block.content);
    if (!tableContent) return fallbackBlocksFromUnsupported(block, specs);
    next.content = tableContent;
  } else if (contentKind !== "none" && block.content !== undefined) {
    next.content =
      rawType === "codeBlock"
        ? simpleExtractText(block)
        : normalizeInlineContent(block.content);
  }

  const children = sanitizeBlocks(block.children, specs);
  if (children.length > 0) next.children = children;

  return [next];
}

function sanitizeBlocks(
  blocks: unknown,
  specs: Record<string, BlockSpecLike>,
): PartialBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.flatMap((block) => sanitizeBlock(block, specs));
}

export function createEditorSafeContent(
  content: unknown,
  schema: unknown,
): BlockNoteContent {
  const sanitized = sanitizeBlocks(content, getBlockSpecs(schema));
  return sanitized.length > 0
    ? (sanitized as BlockNoteContent)
    : createEmptyLocalPageContent();
}
