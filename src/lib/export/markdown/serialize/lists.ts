import { blockNoteInlineToText } from "./inline";
import { wrapLocalBlockPropsMarkdown } from "../localBlockPropsWrappers";

export const LIST_ITEM_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
]);

/** 这些类型在自身 case 内消化 children，不走通用 children 追加 */
export const CHILDREN_CONSUMED_TYPES = new Set([
  "toggleListItem",
  "details",
  "bulletList",
  "orderedList",
  "taskList",
]);

/**
 * 序列化单个 BlockNote 列表项（含 children 子列表缩进递归）。
 * num: numberedListItem 的实际编号（由 serializeBlocks 的 run 计数器推得）。
 *
 * 子缩进按 CommonMark 标记宽度对齐：`- ` → 2 空格，`1. ` → 3，`10. ` → 4。
 * checkbox 的 `[x]` 属于内容而非标记，继续行对齐 `- ` 之后（2 空格）。
 */
export function serializeListItemBlock(
  item: any,
  indent: string,
  num: number | null,
  serializeBlocks: (blocks: any[], indent: string) => string,
): string {
  const text = blockNoteInlineToText(item.content);
  let marker: string;
  let childIndentWidth: number;
  if (item.type === "checkListItem") {
    marker = `- [${item.props?.checked ? "x" : " "}] `;
    childIndentWidth = 2;
  } else if (item.type === "numberedListItem") {
    marker = `${num ?? 1}. `;
    childIndentWidth = marker.length;
  } else {
    marker = "- ";
    childIndentWidth = 2;
  }
  let line = wrapLocalBlockPropsMarkdown(item, `${indent}${marker}${text}`);
  if (Array.isArray(item.children) && item.children.length > 0) {
    const childMd = serializeBlocks(
      item.children,
      indent + " ".repeat(childIndentWidth),
    );
    if (childMd) line += "\n" + childMd;
  }
  return line;
}
