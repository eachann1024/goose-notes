/** 可序列化选区引用及去重、标签和展示策略。 */
export const APPEND_COMPOSER_SELECTION_EVENT =
  "goose-note:append-composer-selection";
export const OPEN_AI_PANEL_EVENT = "goose-note:open-ai-panel";
export const FOCUS_AI_COMPOSER_EVENT = "goose-note:focus-ai-composer";

export const SELECTION_QUOTE_SUMMARY_MAX = 16;
export const SELECTION_QUOTE_DUPLICATE_TOAST = "该选区已在输入框中";
export const SELECTION_QUOTE_LIVE_ANNOUNCEMENT = "已加入选区引用";
export const SELECTION_QUOTE_ADD_SHORTCUT = "Mod+Shift+U";
export const AI_PANEL_ACTIVE_ATTR = "data-goose-ai-panel-active";

export interface AiSelectionQuoteAttrs {
  pageId: string;
  pageTitle: string;
  text: string;
  textHash: string;
}

export interface AppendComposerSelectionDetail {
  pageId: string;
  pageTitle: string;
  text: string;
  /** 点击路径可入场淡入；快捷键必须 false */
  animate?: boolean;
}

export type AppendSelectionQuoteResult = "appended" | "duplicate" | "skipped";

export function readAiPanelActive(
  body:
    | { hasAttribute: (name: string) => boolean }
    | null
    | undefined = typeof document === "undefined" ? null : document.body,
): boolean {
  return Boolean(body?.hasAttribute(AI_PANEL_ACTIVE_ATTR));
}

export function isEligibleSelectionQuoteText(
  text: string | null | undefined,
): boolean {
  return (text ?? "").trim().length > 0;
}

export function canShowAddToChatButton(params: {
  aiEnabled: boolean;
  isCompact: boolean;
  selectedText: string | null | undefined;
  isImageNodeSelection: boolean;
}): boolean {
  if (params.isCompact) return false;
  if (!params.aiEnabled) return false;
  if (params.isImageNodeSelection) return false;
  return isEligibleSelectionQuoteText(params.selectedText);
}

export function canDispatchAppendComposerSelection(params: {
  aiEnabled: boolean;
  isCompact: boolean;
  selectedText: string | null | undefined;
  isImageNodeSelection: boolean;
}): boolean {
  return canShowAddToChatButton(params);
}

/** 会话正在切换时，当前 Composer 实例先别消费队列，留给随后挂载的输入框。 */
export function shouldDeferPendingSelectionQuote(params: {
  composerConversationId: string | null | undefined;
  activeConversationId: string | null | undefined;
}): boolean {
  const composerId = params.composerConversationId;
  const activeId = params.activeConversationId;
  return Boolean(composerId && activeId && composerId !== activeId);
}

/** FNV-1a 32-bit，去重键用，不求加密强度 */
export function hashSelectionQuoteText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function summarizeSelectionQuote(
  text: string,
  max = SELECTION_QUOTE_SUMMARY_MAX,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(normalized);
  if (chars.length <= max) return normalized;
  return `${chars.slice(0, max).join("")}…`;
}

export function buildSelectionQuoteAttrs(params: {
  pageId: string;
  pageTitle: string;
  text: string;
}): AiSelectionQuoteAttrs | null {
  const text = params.text.trim();
  if (!text) return null;
  return {
    pageId: params.pageId,
    pageTitle: params.pageTitle,
    text,
    textHash: hashSelectionQuoteText(text),
  };
}

export function selectionQuoteDedupeKey(
  pageId: string,
  textHash: string,
): string {
  return `${pageId}:${textHash}`;
}

export function hasDuplicateSelectionQuote(
  existing: Array<{ pageId: string; textHash: string }>,
  next: { pageId: string; textHash: string },
): boolean {
  const key = selectionQuoteDedupeKey(next.pageId, next.textHash);
  return existing.some(
    (item) => selectionQuoteDedupeKey(item.pageId, item.textHash) === key,
  );
}

export function formatSelectionQuotePromptLabel(
  attrs: AiSelectionQuoteAttrs,
): string {
  return summarizeSelectionQuote(attrs.text);
}

export function formatSelectionQuoteModelBlock(
  quotes: AiSelectionQuoteAttrs[],
): string {
  if (!quotes.length) return "";
  return quotes
    .map((quote, index) =>
      [
        `[选区引用 ${index + 1}]`,
        `来源页：${quote.pageTitle}`,
        quote.text,
      ].join("\n"),
    )
    .join("\n\n");
}

export function parseSelectionQuoteAttrs(
  raw: string | unknown,
): AiSelectionQuoteAttrs | null {
  if (raw == null || raw === "") return null;
  let parsed: Partial<AiSelectionQuoteAttrs>;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as Partial<AiSelectionQuoteAttrs>;
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    parsed = raw as Partial<AiSelectionQuoteAttrs>;
  } else {
    return null;
  }
  const pageId = typeof parsed.pageId === "string" ? parsed.pageId : "";
  const pageTitle =
    typeof parsed.pageTitle === "string" ? parsed.pageTitle : "";
  const text = typeof parsed.text === "string" ? parsed.text : "";
  const textHash =
    typeof parsed.textHash === "string"
      ? parsed.textHash
      : hashSelectionQuoteText(text.trim());
  if (!pageId || !text.trim()) return null;
  return { pageId, pageTitle, text, textHash };
}
