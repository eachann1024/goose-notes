import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { isBlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { LIST_ITEM_TYPES, serializeListItemBlock } from "./serialize/lists";
import { blockNoteBlockToMarkdown } from "./serialize/block";


/**
 * 序列化块数组（顶层或任意嵌套层）。
 * - 连续的列表项块合并为一个列表（"\n" 相接）；有序编号从 props.start（或 1）递增。
 * - 其余块之间以空行（"\n\n"）分隔。
 * - 空段落（spacer）会自然断开两段列表，对应 md 里的 loose list 空行。
 */
function serializeBlocks(blocks: any[], indent: string): string {
  const segments: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    if (!block || typeof block !== "object") {
      i++;
      continue;
    }

    if (LIST_ITEM_TYPES.has(block.type)) {
      const lines: string[] = [];
      let counter: number | null = null;
      while (i < blocks.length && LIST_ITEM_TYPES.has(blocks[i]?.type)) {
        const item = blocks[i];
        if (item.type === "numberedListItem") {
          const explicitStart = item.props?.start;
          counter =
            typeof explicitStart === "number"
              ? explicitStart
              : counter == null
                ? 1
                : counter + 1;
        } else {
          counter = null;
        }
        lines.push(serializeListItemBlock(item, indent, counter, serializeBlocks));
        i++;
      }
      segments.push(lines.join("\n"));
      continue;
    }

    const md = blockNoteBlockToMarkdown(block, indent, serializeBlocks);
    if (md !== "") segments.push(md);
    i++;
  }

  return segments.join("\n\n");
}

export function jsonContentToMarkdown(
  content: BlockNoteContent,
  skipFirstH1 = false,
): string {
  if (isBlockNoteContent(content)) {
    let blocks = content as any[];
    if (skipFirstH1 && blocks[0]?.type === "heading") {
      blocks = blocks.slice(1);
    }
    return serializeBlocks(blocks, "");
  }

  return "";
}
