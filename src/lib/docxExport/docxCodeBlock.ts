import { BorderStyle, ShadingType, TextRun } from "docx";
import { getCodeBlockText, resolveCodeBlockVisual } from "@/lib/pdfExport/visualAssets";
import { runFont } from "./docxStyles";
import { blockBox, tightParagraph, type DocxBlockChild } from "./docxLayout";
import { DOCX_CODE_SIZE, DOCX_COLORS } from "./docxTheme";
import { imageParagraph } from "./docxMedia";
import type { DocxExportContext } from "./docxBlockContext";

export async function codeBlockToChildren(
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
