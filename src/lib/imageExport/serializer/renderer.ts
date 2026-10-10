import type { CardTheme } from "../themes";
import { buildBlockStyleAttr } from "./blockStyles";
import { renderMediaBlock } from "./mediaBlocks";
import { renderTableBlock } from "./tableBlock";
import { renderTextBlock } from "./textBlocks";
export { collectBlockInlineStyles } from "./blockStyles";
export { renderInline, extractInlineText, extractCellTextForHtml } from "./inline";

/**
 * 将连续顶层 bullet/numbered 列表项合并为 ul/ol，避免裸 li。
 * checkListItem 保持独立 task-item，不并入 ul。
 */
export function renderBlocks(blocks: any[], theme: CardTheme): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";
  const parts: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block?.type === "bulletListItem") {
      const items: any[] = [];
      while (i < blocks.length && blocks[i]?.type === "bulletListItem") {
        items.push(blocks[i]);
        i += 1;
      }
      parts.push(
        `<ul class="bn-list">${items.map((item) => renderBlock(item, theme)).join("")}</ul>`,
      );
      continue;
    }
    if (block?.type === "numberedListItem") {
      const items: any[] = [];
      while (i < blocks.length && blocks[i]?.type === "numberedListItem") {
        items.push(blocks[i]);
        i += 1;
      }
      const start = Number(items[0]?.props?.start);
      const startAttr =
        Number.isInteger(start) && start > 1 ? ` start="${start}"` : "";
      parts.push(
        `<ol class="bn-list"${startAttr}>${items.map((item) => renderBlock(item, theme)).join("")}</ol>`,
      );
      continue;
    }
    parts.push(renderBlock(block, theme));
    i += 1;
  }
  return parts.join("\n");
}

export function renderBlock(block: any, theme: CardTheme): string {
  if (!block || typeof block !== "object") return "";
  if (["image", "imageResize", "file", "video", "audio"].includes(block.type)) {
    return renderMediaBlock(block, theme, buildBlockStyleAttr(block, theme));
  }
  if (block.type === "table") {
    return renderTableBlock(block, theme, buildBlockStyleAttr(block, theme));
  }
  return renderTextBlock(block, theme, renderBlock, renderBlocks);
}
