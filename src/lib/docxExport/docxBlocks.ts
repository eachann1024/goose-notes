import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ImageRun,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertInchesToTwip,
} from "docx";
import { resolveCalloutIcon } from "@/components/editor/blocks/callout/calloutIcons";
import { getCodeBlockText, resolveCodeBlockVisual } from "@/lib/pdfExport/visualAssets";
import {
  alignmentFromBlock,
  emptyRun,
  inlineContentToChildren,
  runFont,
  type DocxFontConfig,
} from "./docxStyles";
import { resolveDocxImage } from "./docxImages";
import {
  accentBorders,
  blockBox,
  blockGap,
  markerBox,
  tightParagraph,
  type DocxBlockChild,
} from "./docxLayout";
import {
  DOCX_BACKGROUND_COLORS,
  DOCX_BLOCK_GAP,
  DOCX_BODY_SIZE,
  DOCX_CAPTION_SIZE,
  DOCX_CHECK_MARKER_DXA,
  DOCX_CHECK_PAD_Y,
  DOCX_CODE_SIZE,
  DOCX_COLORS,
  DOCX_CONTENT_WIDTH_PX,
  DOCX_HEADING_GAP,
  DOCX_HEADING_PAD_X,
  DOCX_HEADING_PAD_Y,
  DOCX_HEADING_SIZES,
  DOCX_TEXT_COLORS,
  resolveNamedColor,
} from "./docxTheme";

export type { DocxBlockChild };

export type DocxNumberingState = {
  numbered: number;
};

export type DocxExportContext = {
  font: DocxFontConfig;
  pageLocalFilePath?: string | null;
  numbering: DocxNumberingState;
};

const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function blockProps(block: unknown): Record<string, unknown> {
  return asRecord(asRecord(block)?.props) ?? {};
}

function paragraphShading(block: unknown) {
  const fill = resolveNamedColor(blockProps(block).backgroundColor, DOCX_BACKGROUND_COLORS);
  if (!fill) return undefined;
  return { type: ShadingType.CLEAR, fill };
}

function scaleImage(
  width: number,
  height: number,
  previewWidth?: number,
): { width: number; height: number } {
  const maxWidth =
    Number.isFinite(previewWidth) && previewWidth && previewWidth > 0
      ? Math.min(previewWidth, DOCX_CONTENT_WIDTH_PX)
      : DOCX_CONTENT_WIDTH_PX;
  if (width <= maxWidth) return { width, height };
  const ratio = maxWidth / width;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function isCheckedProp(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function mediaLabel(block: Record<string, unknown>, fallback: string): string {
  const props = blockProps(block);
  const name = typeof props.name === "string" ? props.name.trim() : "";
  const caption = typeof props.caption === "string" ? props.caption.trim() : "";
  return name || caption || fallback;
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

async function imageParagraph(
  src: string,
  ctx: DocxExportContext,
  options?: {
    caption?: string;
    alignment?: unknown;
    previewWidth?: number;
  },
): Promise<DocxBlockChild[]> {
  const image = await resolveDocxImage(src, ctx.pageLocalFilePath);
  if (!image) {
    if (!options?.caption) return [];
    return blockBox({
      inner: tightParagraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: options.caption,
            italics: true,
            color: DOCX_COLORS.muted,
            font: runFont(ctx.font.body),
            size: DOCX_CAPTION_SIZE,
          }),
        ],
      }),
      padY: 60,
      padX: 0,
    });
  }
  const size = scaleImage(image.width, image.height, options?.previewWidth);
  const paragraphs: Paragraph[] = [
    tightParagraph({
      alignment: alignmentFromBlock(options?.alignment) ?? AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: image.type,
          data: image.buffer,
          transformation: { width: size.width, height: size.height },
          altText: options?.caption
            ? { name: options.caption, title: options.caption, description: options.caption }
            : undefined,
        }),
      ],
    }),
  ];
  if (options?.caption) {
    paragraphs.push(
      tightParagraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: options.caption,
            italics: true,
            color: DOCX_COLORS.muted,
            font: runFont(ctx.font.body),
            size: DOCX_CAPTION_SIZE,
          }),
        ],
      }),
    );
  }
  return blockBox({ inner: paragraphs, padY: 60, padX: 0, gapAfter: DOCX_BLOCK_GAP });
}

function placeholderParagraph(
  ctx: DocxExportContext,
  icon: string,
  label: string,
  url?: string,
): DocxBlockChild[] {
  const text = `${icon} ${label}`;
  const run = new TextRun({
    text,
    font: runFont(ctx.font.body),
    size: DOCX_BODY_SIZE,
    color: DOCX_COLORS.text,
  });
  return blockBox({
    inner: tightParagraph({
      children:
        url && isHttpUrl(url)
          ? inlineContentToChildren(
              [{ type: "link", href: url, content: [{ type: "text", text, styles: {} }] }],
              ctx.font,
            )
          : [run],
    }),
    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.fileBg },
    padY: 100,
    padX: 140,
  });
}

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

async function codeBlockToChildren(
  block: Record<string, unknown>,
  ctx: DocxExportContext,
): Promise<DocxBlockChild[]> {
  const visual = await resolveCodeBlockVisual(block, {});
  if (visual.kind === "png") {
    return imageParagraph(visual.src, ctx, { alignment: "center" });
  }
  if (visual.kind === "empty") return [];
  const text =
    visual.kind === "source-fallback" ? visual.text : getCodeBlockText(block);
  const lines = (text || " ").split("\n");
  const paras = lines.map((line) =>
    tightParagraph({
      children: [
        new TextRun({
          text: line.length ? line : " ",
          font: runFont(ctx.font.mono),
          size: DOCX_CODE_SIZE,
          color: DOCX_COLORS.text,
        }),
      ],
    }),
  );
  return blockBox({
    inner: paras,
    shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.codeBg },
    padY: 100,
    padX: 140,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.codeBorder },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.codeBorder },
      left: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.codeBorder },
      right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_COLORS.codeBorder },
    },
  });
}

export async function processBlockChildren(
  blocks: unknown[],
  depth: number,
  ctx: DocxExportContext,
  extras?: { callout?: boolean },
): Promise<DocxBlockChild[]> {
  const result: DocxBlockChild[] = [];
  if (!Array.isArray(blocks)) return result;
  let prevType: string | null = null;

  for (const raw of blocks) {
    const block = asRecord(raw);
    if (!block) continue;
    const props = blockProps(block);
    const type = typeof block.type === "string" ? block.type : "paragraph";
    const inline = inlineContentToChildren(block.content, ctx.font);
    const children = Array.isArray(block.children) ? block.children : [];
    const alignment = alignmentFromBlock(props.textAlignment);
    const shading = extras?.callout
      ? { type: ShadingType.CLEAR, fill: DOCX_COLORS.calloutBg }
      : paragraphShading(block);

    const pushChildren = async (nextDepth = depth + 1) => {
      if (!children.length) return;
      result.push(...(await processBlockChildren(children, nextDepth, ctx, extras)));
    };

    switch (type) {
      case "heading": {
        const level = Number(props.level) || 1;
        const headingSize = DOCX_HEADING_SIZES[level] || DOCX_HEADING_SIZES[1];
        const headingInline = inlineContentToChildren(block.content, ctx.font, {
          size: headingSize,
          bold: true,
          color: resolveNamedColor(props.textColor, DOCX_TEXT_COLORS) || DOCX_COLORS.text,
        });
        result.push(
          ...blockBox({
            inner: tightParagraph({
              heading: HEADING_LEVELS[level] || HeadingLevel.HEADING_1,
              alignment,
              children: headingInline.length ? headingInline : [emptyRun(ctx.font)],
            }),
            shading,
            padY: shading ? DOCX_HEADING_PAD_Y : 40,
            padX: shading ? DOCX_HEADING_PAD_X : 0,
            gapAfter: DOCX_HEADING_GAP,
          }),
        );
        await pushChildren(depth);
        break;
      }
      case "bulletListItem":
      case "toggleListItem": {
        result.push(
          ...markerBox({
            marker: tightParagraph({
              children: [
                new TextRun({
                  text: "•",
                  font: runFont(ctx.font.body),
                  size: DOCX_BODY_SIZE,
                }),
              ],
            }),
            content: tightParagraph({
              alignment,
              children: inline.length ? inline : [emptyRun(ctx.font)],
            }),
            shading,
            padY: DOCX_CHECK_PAD_Y,
            markerWidth: DOCX_CHECK_MARKER_DXA,
            indent: convertInchesToTwip(0.18 * depth),
          }),
        );
        await pushChildren(depth + 1);
        break;
      }
      case "numberedListItem": {
        if (depth === 0 && prevType !== "numberedListItem") {
          ctx.numbering.numbered += 1;
        }
        result.push(
          ...blockBox({
            inner: tightParagraph({
              numbering: {
                reference: "goose-numbered-list",
                level: Math.min(depth, 5),
                instance: ctx.numbering.numbered,
              },
              alignment,
              children: inline.length ? inline : [emptyRun(ctx.font)],
            }),
            shading,
            padY: DOCX_CHECK_PAD_Y,
            padX: 0,
            indent: convertInchesToTwip(0.18 * depth),
          }),
        );
        await pushChildren(depth + 1);
        break;
      }
      case "checkListItem": {
        const checked = isCheckedProp(props.checked);
        const contentRuns = inlineContentToChildren(block.content, ctx.font, {
          color: checked ? DOCX_COLORS.muted : undefined,
          strike: checked,
        });
        result.push(
          ...blockBox({
            inner: tightParagraph({
              alignment,
              children: [
                new TextRun({
                  text: checked ? "☑ " : "☐ ",
                  font: runFont(ctx.font.body),
                  size: DOCX_BODY_SIZE,
                  color: checked ? DOCX_COLORS.muted : DOCX_COLORS.text,
                }),
                ...(contentRuns.length ? contentRuns : [emptyRun(ctx.font)]),
              ],
            }),
            shading,
            padY: DOCX_CHECK_PAD_Y,
            padX: 0,
            indent: convertInchesToTwip(0.18 * depth),
          }),
        );
        await pushChildren(depth + 1);
        break;
      }
      case "codeBlock": {
        result.push(...(await codeBlockToChildren(block, ctx)));
        break;
      }
      case "quote": {
        const quoteInline = inlineContentToChildren(block.content, ctx.font, {
          italics: true,
          color: DOCX_COLORS.quote,
        });
        result.push(
          ...blockBox({
            inner: tightParagraph({
              alignment,
              children: quoteInline.length ? quoteInline : [emptyRun(ctx.font)],
            }),
            shading,
            padY: 100,
            padX: 140,
            borders: accentBorders(DOCX_COLORS.quoteBorder),
          }),
        );
        await pushChildren(depth);
        break;
      }
      case "image":
      case "imageResize": {
        const src = String(props.url || props.src || "");
        const caption = String(props.caption || props.alt || "");
        const previewWidth = Number(props.previewWidth ?? props.width);
        if (src) {
          result.push(
            ...(await imageParagraph(src, ctx, {
              caption,
              alignment: props.textAlignment,
              previewWidth: Number.isFinite(previewWidth) ? previewWidth : undefined,
            })),
          );
        }
        break;
      }
      case "table": {
        const table = blockToTable(block, ctx);
        if (table) {
          result.push(table, blockGap(DOCX_BLOCK_GAP));
        }
        break;
      }
      case "divider": {
        result.push(
          ...blockBox({
            inner: tightParagraph({
              border: {
                bottom: {
                  color: DOCX_COLORS.divider,
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
              children: [emptyRun(ctx.font)],
            }),
            padY: 40,
            padX: 0,
          }),
        );
        break;
      }
      case "callout": {
        const emoji = resolveCalloutIcon(
          typeof props.icon === "string"
            ? props.icon
            : typeof props.emoji === "string"
              ? props.emoji
              : undefined,
        );
        result.push(
          ...markerBox({
            marker: tightParagraph({
              children: [
                new TextRun({
                  text: emoji,
                  font: runFont(ctx.font.body),
                  size: DOCX_BODY_SIZE,
                }),
              ],
            }),
            content: tightParagraph({
              children: inline.length ? inline : [emptyRun(ctx.font)],
            }),
            shading: { type: ShadingType.CLEAR, fill: DOCX_COLORS.calloutBg },
            padY: 100,
            markerWidth: 500,
            tableBorders: accentBorders(
              DOCX_COLORS.calloutAccent,
              DOCX_COLORS.calloutBorder,
            ),
          }),
        );
        if (children.length) {
          result.push(
            ...(await processBlockChildren(children, depth, ctx, { callout: true })),
          );
        }
        break;
      }
      case "file":
      case "audio":
      case "video": {
        const icon = type === "video" ? "▶" : type === "audio" ? "♪" : "📎";
        const fallback = type === "video" ? "视频" : type === "audio" ? "音频" : "未命名文件";
        result.push(
          ...placeholderParagraph(
            ctx,
            icon,
            mediaLabel(block, fallback),
            String(props.url || props.src || ""),
          ),
        );
        break;
      }
      default: {
        result.push(
          ...blockBox({
            inner: tightParagraph({
              alignment,
              children: inline.length ? inline : [emptyRun(ctx.font)],
            }),
            shading,
            padY: shading ? 80 : 40,
            padX: shading ? 80 : 0,
          }),
        );
        await pushChildren(depth);
        break;
      }
    }
    prevType = type;
  }

  return result;
}
