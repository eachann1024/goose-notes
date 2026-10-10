import { HeadingLevel } from "docx";
import { inlineContentToChildren, emptyRun, type alignmentFromBlock } from "./docxStyles";
import { blockBox, tightParagraph, accentBorders, type DocxBlockChild } from "./docxLayout";
import { HEADING_LEVELS, type DocxExportContext, type paragraphShading } from "./docxBlockContext";
import { DOCX_COLORS, DOCX_HEADING_SIZES, DOCX_TEXT_COLORS, DOCX_HEADING_PAD_Y, DOCX_HEADING_PAD_X, DOCX_HEADING_GAP, resolveNamedColor } from "./docxTheme";

export async function renderDocxParagraph(
  type: string,
  block: Record<string, unknown>,
  ctx: DocxExportContext,
  state: {
    props: Record<string, unknown>;
    inline: ReturnType<typeof inlineContentToChildren>;
    alignment: ReturnType<typeof alignmentFromBlock>;
    shading: ReturnType<typeof paragraphShading>;
    result: DocxBlockChild[];
    pushChildren: (nextDepth?: number) => Promise<void>;
    depth: number;
  },
): Promise<void> {
  const { props, inline, alignment, shading, result, pushChildren, depth } = state;
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
}
