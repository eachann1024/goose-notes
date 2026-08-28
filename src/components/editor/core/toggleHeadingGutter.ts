/** 任意 heading 块。 */
export function isHeadingBlock(block: {
  type?: string;
} | null | undefined): boolean {
  return block?.type === "heading";
}

export function queryHeadingTextRect(blockId: string): DOMRect | null {
  const blockEl = document.querySelector(`[data-id="${blockId}"]`);
  if (!blockEl) return null;
  const textEl = blockEl.querySelector("h1, h2, h3, .bn-inline-content");
  if (!textEl) return null;
  return textEl.getBoundingClientRect();
}

export {
  isFoldableHeadingBlock,
  readHeadingCollapsed,
  toggleHeadingCollapsed,
} from "@/components/editor/core/headingSectionFold";
