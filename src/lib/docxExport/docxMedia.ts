import { AlignmentType, ImageRun, Paragraph, ShadingType, TextRun } from "docx";
import { alignmentFromBlock, inlineContentToChildren, runFont } from "./docxStyles";
import { resolveDocxImage } from "./docxImages";
import { blockBox, tightParagraph, type DocxBlockChild } from "./docxLayout";
import { DOCX_CONTENT_WIDTH_PX, DOCX_BLOCK_GAP, DOCX_BODY_SIZE, DOCX_CAPTION_SIZE, DOCX_COLORS } from "./docxTheme";
import { blockProps, type DocxExportContext } from "./docxBlockContext";

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


export function mediaLabel(block: Record<string, unknown>, fallback: string): string {
  const props = blockProps(block);
  const name = typeof props.name === "string" ? props.name.trim() : "";
  const caption = typeof props.caption === "string" ? props.caption.trim() : "";
  return name || caption || fallback;
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export async function imageParagraph(
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

export function placeholderParagraph(
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
