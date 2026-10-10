import type { JSONContent } from "@/types";

/**
 * 持久化输入草稿时去掉图片 token：File/blob 无法跨进程恢复，
 * 保留残缺 chip 会导致发送时丢图却看似还在。
 */
export function stripComposerDraftImages(
  content: JSONContent | null | undefined,
): JSONContent | null {
  if (!content || typeof content !== "object") return null;
  const blocks = Array.isArray(content.content) ? content.content : null;
  if (!blocks || blocks.length === 0) return null;

  const nextBlocks = blocks
    .map((block: unknown) => {
      if (!block || typeof block !== "object") return null;
      const blockRecord = block as { content?: unknown } & Record<
        string,
        unknown
      >;
      const nodes = Array.isArray(blockRecord.content)
        ? blockRecord.content
        : [];
      const nextNodes = nodes.filter((node: unknown) => {
        if (!node || typeof node !== "object") return false;
        return (node as { type?: string }).type !== "aiImageAttachment";
      });
      if (nextNodes.length === 0) {
        // 保留纯空段落没有意义
        return null;
      }
      return { ...blockRecord, content: nextNodes };
    })
    .filter(Boolean);

  if (nextBlocks.length === 0) return null;
  return { type: "doc", content: nextBlocks };
}

/** 草稿是否包含用户可见内容（文本、引用或 Skill chip） */
export function composerDraftHasContent(
  content: JSONContent | null | undefined,
): boolean {
  const cleaned = stripComposerDraftImages(content);
  if (!cleaned?.content?.length) return false;

  for (const block of cleaned.content) {
    if (!block || typeof block !== "object") continue;
    const nodes = Array.isArray((block as { content?: unknown }).content)
      ? ((block as { content: unknown[] }).content ?? [])
      : [];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const type = (node as { type?: string }).type;
      if (
        type === "aiFileReference" ||
        type === "aiSkillCommand" ||
        type === "aiSelectionQuote"
      )
        return true;
      if (type === "text") {
        const text = (node as { text?: unknown }).text;
        if (typeof text === "string" && text.trim().length > 0) return true;
      }
    }
  }
  return false;
}
