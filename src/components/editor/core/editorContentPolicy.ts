import {
  getContentSignature,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
/**
 * 原始文档内容 → 编辑器可用块数组（不做任何页面级规范化改写）。
 * BlockNote 的 initialContent / replaceBlocks 不接受空数组，
 * 空文件 / 解析失败时兜底为单个空段落（仅编辑器呈现层，不回写 store）。
 */
export function toEditorBlocks(content: unknown): BlockNoteContent {
  const blocks = Array.isArray(content) ? (content as BlockNoteContent) : [];
  if (blocks.length > 0) return blocks;
  return [{ type: "paragraph", content: "" }] as BlockNoteContent;
}

const contentSigCache = new WeakMap<object, string>();
export function getCachedContentSignature(content: unknown): string {
  if (content && typeof content === "object") {
    const key = content as object;
    const hit = contentSigCache.get(key);
    if (hit) return hit;
    const sig = getContentSignature(content);
    contentSigCache.set(key, sig);
    return sig;
  }
  return getContentSignature(content);
}
