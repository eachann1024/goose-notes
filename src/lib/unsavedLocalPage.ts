import { extractPlainText } from "@/components/editor/utils/blocknote-content";
import type { JSONContent, Page } from "@/types";

const EMPTY_TEXT_BLOCK_TYPES = new Set(["paragraph", "heading"]);

function asBlocks(content: JSONContent | null | undefined): unknown[] {
  if (Array.isArray(content)) return content;
  if (content && typeof content === "object" && Array.isArray(content.content)) {
    return content.content;
  }
  return [];
}

function blockHasPersistableContent(block: unknown): boolean {
  if (!block || typeof block !== "object") return false;
  const node = block as {
    type?: string;
    children?: unknown[];
  };
  if (node.type && !EMPTY_TEXT_BLOCK_TYPES.has(node.type)) return true;
  if (extractPlainText([block as never]).trim()) return true;
  return (node.children ?? []).some(blockHasPersistableContent);
}

/** 空白未落盘页：只有空段落/空标题，关闭时丢弃、不写磁盘。 */
export function localPageHasPersistableContent(
  content: JSONContent | null | undefined,
): boolean {
  return asBlocks(content).some(blockHasPersistableContent);
}

export function isUnsavedLocalPage(
  page: Page | null | undefined,
): page is Page & { localUnsaved: true } {
  return Boolean(page?.localUnsaved && !page.localFilePath && !page.isFolder);
}
