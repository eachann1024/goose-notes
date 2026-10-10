import type { JSONContent, Page } from "@/types";
import { UNTITLED_PAGE_TITLE } from "@/components/editor/utils/page-title";
import type { QuickNoteSlot, QuickNoteDrafts } from "./types";
import { createEmptyLocalPageContent } from "@/components/editor/utils/blocknote-content";
import { DEFAULT_NOTEBOOK } from "@/stores/useNotebooks";

// 可承载 inline 文本、且空内容即视为「空白」的块类型。结构化块（image/table/
// codeBlock/file/video/audio…）即使没有 inline text 也是真实内容，不能被当空白清掉。
export const TEXTUAL_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "quote",
  "callout",
]);

export function inlineContentHasText(content: unknown): boolean {
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as { text?: unknown; content?: unknown };
    return (
      (typeof candidate.text === "string" &&
        candidate.text.trim().length > 0) ||
      inlineContentHasText(candidate.content)
    );
  });
}

export function blockHasMeaningfulContent(block: unknown): boolean {
  if (!block || typeof block !== "object") return false;
  const candidate = block as {
    type?: unknown;
    content?: unknown;
    children?: unknown;
  };
  const type = typeof candidate.type === "string" ? candidate.type : "";
  if (!type || !TEXTUAL_BLOCK_TYPES.has(type)) return true;
  if (inlineContentHasText(candidate.content)) return true;
  return (
    Array.isArray(candidate.children) &&
    candidate.children.some(blockHasMeaningfulContent)
  );
}

/** 判断草稿是否为空白，供保存门控与槽位占用提示共用。 */
export function isQuickNoteDraftEmpty(content: JSONContent | null): boolean {
  if (!content) return true;
  if (Array.isArray(content)) return !content.some(blockHasMeaningfulContent);
  if (typeof content !== "object") return true;
  const root = content as { type?: unknown; content?: unknown };
  if (root.type === "doc" && Array.isArray(root.content)) {
    return !root.content.some(blockHasMeaningfulContent);
  }
  return !blockHasMeaningfulContent(root);
}

export function collectInlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let text = "";
  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { text?: unknown; content?: unknown };
    if (typeof candidate.text === "string") text += candidate.text;
    else text += collectInlineText(candidate.content);
  }
  return text;
}

export function extractFirstBlockText(block: unknown): string {
  if (!block || typeof block !== "object") return "";
  const candidate = block as { content?: unknown; children?: unknown };
  const inline = collectInlineText(candidate.content).trim();
  if (inline) return inline.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (!Array.isArray(candidate.children)) return "";
  for (const child of candidate.children) {
    const nested = extractFirstBlockText(child);
    if (nested) return nested;
  }
  return "";
}

export function getDraftBlocks(content: JSONContent | null): unknown[] {
  if (!content) return [];
  if (Array.isArray(content)) return content;
  if (typeof content !== "object") return [];
  const root = content as { type?: unknown; content?: unknown };
  if (root.type === "doc" && Array.isArray(root.content)) return root.content;
  return [content];
}

/** 用草稿第一行可见文字做新笔记文件名；没有文字时回退「未命名」。 */
export function extractQuickNoteDraftTitle(
  content: JSONContent | null,
): string {
  for (const block of getDraftBlocks(content)) {
    const text = extractFirstBlockText(block);
    if (text) return text.slice(0, 80);
  }
  return UNTITLED_PAGE_TITLE;
}

/** 读取当前激活槽位的草稿内容。 */
export function getActiveDraftContent(state: {
  activeSlot: QuickNoteSlot;
  drafts: QuickNoteDrafts;
}): JSONContent | null {
  return state.drafts[state.activeSlot] ?? null;
}

/**
 * 草稿是否为「空白单块」：null / 空数组 / 仅含一个无可见文本的块（如空段落、空标题）。
 * 用于把这类草稿归一成不带标题的空段落，覆盖存量脏数据（早期被强转的空 H1）。
 * 只看首块有无 inline 文本，不碰块类型 props——避免 isDraftEmpty 那种按 JSON 文本
 * 糊匹配、被 props 里 "default"/"left" 等拉丁字母值误判的问题。
 */
export const isBlankSingleBlockDraft = (
  content: JSONContent | null,
): boolean => {
  if (!content) return true;
  if (!Array.isArray(content)) return false;
  if (content.length === 0) return true;
  if (content.length > 1) return false;
  const only = content[0] as {
    type?: string;
    content?: unknown;
    children?: unknown[];
  };
  if (Array.isArray(only.children) && only.children.length > 0) return false;
  // 仅对文本类块判空；结构化块一律保留（视为有内容）。
  if (!only.type || !TEXTUAL_BLOCK_TYPES.has(only.type)) return false;
  const inline = only.content;
  if (inline == null) return true; // 空段落/空标题：content 为 undefined
  if (typeof inline === "string") return inline.length === 0;
  if (Array.isArray(inline)) {
    return inline.every(
      (n) =>
        typeof (n as { text?: unknown })?.text !== "string" ||
        (n as { text: string }).text.length === 0,
    );
  }
  return false;
};

/**
 * 把草稿首块的 heading 降级为 paragraph（保留 inline 文字与通用排版属性，仅去掉 level）。
 *
 * 「小窗首块永远从正文起手、绝不是标题一」是产品红线（[[title-heading-is-sacred]] 的反面：
 * 主窗首块恒 H1，小窗首块恒非标题）。运行期路径（normalize/firstTitleGuard）已全部豁免草稿页，
 * 不会再主动把首块转 H1；但**存量持久化**里可能残留早期被强转的 H1 首块——用户在那个 H1 块里
 * 继续编辑，onChange 又原样存回 H1，形成「重开即标题1」的死循环（isBlankSingleBlockDraft 只清
 * 空白块、清不掉有内容的 H1）。这里在加载构造 draftPage 时一次性把首块掰回正文，打破循环。
 *
 * 只动**首块**、只把 **heading→paragraph**：第二行起的标题、其它块类型一律原样保留。
 */
export function demoteFirstHeadingToParagraph(
  content: JSONContent,
): JSONContent {
  if (!Array.isArray(content) || content.length === 0) return content;
  const first = content[0] as {
    type?: string;
    props?: Record<string, unknown>;
  };
  if (first?.type !== "heading") return content;
  const props = first.props ?? {};
  // paragraph 仅保留通用排版属性（颜色/对齐），丢弃 heading 专属的 level / isToggleable。
  const paragraphProps: Record<string, unknown> = {};
  for (const key of ["textColor", "backgroundColor", "textAlignment"]) {
    if (props[key] !== undefined) paragraphProps[key] = props[key];
  }
  const demoted = { ...first, type: "paragraph", props: paragraphProps };
  return [demoted, ...content.slice(1)] as JSONContent;
}

/** 造一个用于驱动编辑器的草稿 page（不入 pages map、不持久化为 page 快照）。 */
export function buildQuickNoteDraftPage(content: JSONContent | null): Page {
  const now = Date.now();
  // 空白草稿一律从空段落起手，不预置任何标题块——小窗是「草稿便签」，不走主窗
  // 「首块恒为 H1」约定。这里对「无可见文本」的草稿（null / 单个空块，含早期 normalize
  // 未豁免时把空段落强转空 H1 回写持久化所留下的存量脏数据）统一归一成空段落：
  // 既保证新草稿不冒空标题1，也清掉存量脏数据。注意此处用结构化判空而非 isDraftEmpty
  // ——后者按 JSON 文本糊匹配，块 props 里的 "default"/"left" 等值含拉丁字母会被误判为非空。
  // 非空草稿再额外把「有内容的 H1 首块」降级为正文：覆盖存量脏数据，确保小窗首行永不是标题一。
  const draftContent = isBlankSingleBlockDraft(content)
    ? createEmptyLocalPageContent()
    : demoteFirstHeadingToParagraph(content as JSONContent);
  return {
    id: "__quicknote_draft__",
    workspaceId: DEFAULT_NOTEBOOK,
    parentId: undefined,
    content: draftContent,
    isFolder: false,
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: now,
    updatedAt: now,
    order: now,
  };
}
