import {
  extractPlainText,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";

function normalizeTitleText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isMatchingPageH1(
  block: BlockNoteContent[number] | undefined,
  pageTitle: string,
): boolean {
  if (!block || (block as { type?: string }).type !== "heading") return false;
  const headingLevel = Number((block as { props?: { level?: number } }).props?.level) || 1;
  if (headingLevel !== 1) return false;
  const selectedTitle = normalizeTitleText(extractPlainText([block]));
  const generatedTitle = normalizeTitleText(pageTitle);
  return Boolean(selectedTitle && selectedTitle === generatedTitle);
}

/**
 * 选区包含页面 H1 时，“显示标题”已经会在卡片头部渲染同一标题，
 * 因此跳过选区里的重复 H1；普通章节标题仍按原样保留。
 */
export function getSelectionBlocksToRender(
  selectionBlocks: BlockNoteContent,
  pageTitle: string,
  showTitle: boolean,
): BlockNoteContent {
  if (!showTitle || selectionBlocks.length === 0) return selectionBlocks;
  return isMatchingPageH1(selectionBlocks[0], pageTitle)
    ? selectionBlocks.slice(1)
    : selectionBlocks;
}

/**
 * 整页导出：首块是 heading 时提升到卡片标题（任意 level，兼容只有 H2 的页）。
 * 选区导出：仅去掉与页面标题重复的 H1。
 * 调用方用 titleBlock.props 把对齐/背景色写到 `.gooseshot-title`。
 */
export function splitImageExportTitle(params: {
  blocks: BlockNoteContent;
  pageTitle: string;
  showTitle: boolean;
  mode: "page" | "selection";
}): { blocks: BlockNoteContent; titleBlock: BlockNoteContent[number] | null } {
  const { blocks, pageTitle, showTitle, mode } = params;
  if (!showTitle || blocks.length === 0) {
    return { blocks, titleBlock: null };
  }

  const first = blocks[0];
  if (mode === "selection") {
    if (!isMatchingPageH1(first, pageTitle)) {
      return { blocks, titleBlock: null };
    }
    return { blocks: blocks.slice(1), titleBlock: first };
  }

  if ((first as { type?: string } | undefined)?.type !== "heading") {
    return { blocks, titleBlock: null };
  }
  return { blocks: blocks.slice(1), titleBlock: first };
}
