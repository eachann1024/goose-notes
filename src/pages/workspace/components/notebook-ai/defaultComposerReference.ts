import type { JSONContent } from "@/types";
import { composerDraftHasContent } from "@/stores/useNotebookAiChats";
import { buildComposerDraftFromReference } from "@/components/editor/ai/composer/composerTokens";
import type { AiFileReferenceAttrs } from "@/components/editor/ai/composer/referenceLookup";

export { buildComposerDraftFromReference };

function isNonEmptyText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * 空会话的默认 @ 当前页：无内容，或只有一条文件引用（可带空白）。
 * 用户一旦打字、加 Skill / 图片 / 第二条引用，就不再自动改。
 */
export function getSoleFileReferencePageId(
  draft: JSONContent | null | undefined,
): string | null {
  if (!draft?.content?.length) return null;

  let pageId: string | null = null;
  for (const block of draft.content) {
    if (!block || typeof block !== "object") continue;
    const nodes = Array.isArray((block as { content?: unknown }).content)
      ? ((block as { content: unknown[] }).content ?? [])
      : [];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const type = (node as { type?: string }).type;
      if (type === "text") {
        if (isNonEmptyText((node as { text?: unknown }).text)) return null;
        continue;
      }
      if (type === "aiSkillCommand" || type === "aiImageAttachment") {
        return null;
      }
      if (type === "aiFileReference") {
        const attrs = (node as { attrs?: { pageId?: unknown } }).attrs;
        const nextPageId =
          typeof attrs?.pageId === "string" ? attrs.pageId : "";
        if (!nextPageId || (pageId && pageId !== nextPageId)) return null;
        pageId = nextPageId;
        continue;
      }
      return null;
    }
  }
  return pageId;
}

export interface SeedCurrentPageReferenceOptions {
  /** /new 或工具栏新建：空白会话，不要再种默认 @ */
  suppress?: boolean;
}

/**
 * 当前笔记只用于帮助空会话起步。
 * 历史会话、用户草稿（含手动改过的 @）都必须保持原样。
 * 若空会话里仍是自动植入的那一条 @，切页 / 切笔记本后应跟到最新当前页。
 * 用户显式新开会话时 suppress，避免把刚清掉的 tag 种回去。
 */
export function shouldSeedCurrentPageReference(
  messageCount: number,
  draft: JSONContent | null | undefined,
  currentPageId?: string | null,
  options?: SeedCurrentPageReferenceOptions,
) {
  if (options?.suppress) return false;
  if (messageCount !== 0) return false;
  if (!composerDraftHasContent(draft)) return true;
  if (!currentPageId) return false;
  const solePageId = getSoleFileReferencePageId(draft);
  return solePageId !== null && solePageId !== currentPageId;
}

export function resolveEmptySessionComposerSeed(
  messageCount: number,
  draft: JSONContent | null | undefined,
  currentReference: AiFileReferenceAttrs | null,
  options?: SeedCurrentPageReferenceOptions,
): JSONContent | null {
  if (
    currentReference &&
    shouldSeedCurrentPageReference(
      messageCount,
      draft,
      currentReference.pageId,
      options,
    )
  ) {
    return buildComposerDraftFromReference(currentReference);
  }
  return draft ?? null;
}
