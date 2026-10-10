import { renderDocxParagraph } from "./docxParagraphs";
import { BorderStyle, ShadingType, TextRun, convertInchesToTwip } from "docx";
import { resolveCalloutIcon } from "@/components/editor/blocks/callout/calloutIcons";
import { alignmentFromBlock, emptyRun, inlineContentToChildren, runFont } from "./docxStyles";
import { accentBorders, blockBox, blockGap, markerBox, tightParagraph, type DocxBlockChild } from "./docxLayout";
import { DOCX_BLOCK_GAP, DOCX_BODY_SIZE, DOCX_CHECK_MARKER_DXA, DOCX_CHECK_PAD_Y, DOCX_COLORS } from "./docxTheme";
import { asRecord, blockProps, paragraphShading, isCheckedProp, type DocxExportContext } from "./docxBlockContext";
import { imageParagraph, placeholderParagraph, mediaLabel } from "./docxMedia";
import { blockToTable } from "./docxTable";
import { codeBlockToChildren } from "./docxCodeBlock";
export { blockToTable } from "./docxTable";
export type { DocxBlockChild } from "./docxLayout";
export type { DocxNumberingState, DocxExportContext } from "./docxBlockContext";

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
      case "heading":
      case "quote":
      default:
        await renderDocxParagraph(type, block, ctx, {
          props, inline, alignment, shading, result, pushChildren, depth,
        });
        break;
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

    }
    prevType = type;
  }

  return result;
}
