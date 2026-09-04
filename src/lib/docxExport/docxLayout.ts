import {
  BorderStyle,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ITableBordersOptions,
  type ITableCellBorders,
  type IParagraphOptions,
  type IShadingAttributesProperties,
} from "docx";
import {
  DOCX_BLOCK_GAP,
  DOCX_BLOCK_PAD_Y,
  DOCX_CONTENT_WIDTH_DXA,
  DOCX_LINE_SPACING,
} from "./docxTheme";

export type DocxBlockChild = Paragraph | Table;

const NONE_BORDER = {
  style: BorderStyle.NONE,
  size: 0,
  color: "FFFFFF",
} as const;

export const DOCX_CELL_BORDERS_NONE = {
  top: NONE_BORDER,
  bottom: NONE_BORDER,
  left: NONE_BORDER,
  right: NONE_BORDER,
};

function cellBordersNone() {
  return {
    top: { ...NONE_BORDER },
    bottom: { ...NONE_BORDER },
    left: { ...NONE_BORDER },
    right: { ...NONE_BORDER },
  };
}

export function tightParagraph(options: IParagraphOptions): Paragraph {
  return new Paragraph({
    ...options,
    spacing: {
      line: DOCX_LINE_SPACING,
      lineRule: "auto",
      ...options.spacing,
      before: 0,
      after: 0,
    },
  });
}

export function blockGap(after = DOCX_BLOCK_GAP): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after, line: 20, lineRule: "exact" },
    children: [new TextRun({ text: "", size: 2 })],
  });
}

type BoxBorders = ITableCellBorders | undefined;

export function blockBox(options: {
  inner: Paragraph | Paragraph[];
  shading?: IShadingAttributesProperties;
  padY?: number;
  padX?: number;
  indent?: number;
  gapAfter?: number;
  borders?: BoxBorders;
}): DocxBlockChild[] {
  const inner = Array.isArray(options.inner) ? options.inner : [options.inner];
  const padY = options.padY ?? DOCX_BLOCK_PAD_Y;
  const padX = options.padX ?? 80;
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TableBorders.NONE,
      indent:
        options.indent && options.indent > 0
          ? { size: options.indent, type: WidthType.DXA }
          : undefined,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              verticalAlign: VerticalAlign.CENTER,
              shading: options.shading,
              margins: {
                top: padY,
                bottom: padY,
                left: padX,
                right: padX,
              },
              borders: options.borders ?? cellBordersNone(),
              width: { size: DOCX_CONTENT_WIDTH_DXA, type: WidthType.DXA },
              children: inner,
            }),
          ],
        }),
      ],
    }),
    blockGap(options.gapAfter),
  ];
}

export function markerBox(options: {
  marker: Paragraph;
  content: Paragraph;
  shading?: IShadingAttributesProperties;
  padY?: number;
  markerWidth: number;
  indent?: number;
  gapAfter?: number;
  tableBorders?: ITableBordersOptions;
}): DocxBlockChild[] {
  const padY = options.padY ?? DOCX_BLOCK_PAD_Y;
  const rest = Math.max(1200, DOCX_CONTENT_WIDTH_DXA - options.markerWidth);
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [options.markerWidth, rest],
      borders: options.tableBorders ?? TableBorders.NONE,
      indent:
        options.indent && options.indent > 0
          ? { size: options.indent, type: WidthType.DXA }
          : undefined,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              verticalAlign: VerticalAlign.CENTER,
              width: { size: options.markerWidth, type: WidthType.DXA },
              margins: { top: padY, bottom: padY, left: 80, right: 60 },
              shading: options.shading,
              borders: cellBordersNone(),
              children: [options.marker],
            }),
            new TableCell({
              verticalAlign: VerticalAlign.CENTER,
              width: { size: rest, type: WidthType.DXA },
              margins: { top: padY, bottom: padY, left: 0, right: 80 },
              shading: options.shading,
              borders: cellBordersNone(),
              children: [options.content],
            }),
          ],
        }),
      ],
    }),
    blockGap(options.gapAfter),
  ];
}

export function accentBorders(leftColor: string, restColor?: string): ITableBordersOptions {
  const rest = restColor
    ? { style: BorderStyle.SINGLE, size: 4, color: restColor }
    : NONE_BORDER;
  return {
    left: { style: BorderStyle.SINGLE, size: 24, color: leftColor },
    top: rest,
    right: rest,
    bottom: rest,
  };
}
