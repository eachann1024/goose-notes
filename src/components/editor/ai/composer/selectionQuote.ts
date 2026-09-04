/**
 * 选区引用 token：把编辑器选区以 chip 追加到 AI 输入框末尾。
 * 不与 @页面引用混用。侧栏已开时插入必须静默（不 focus composer）；
 * 侧栏未开时先打开为并排侧栏，再把 chip 交给随后挂载的输入框。
 */
import { ensureComposerCaretAnchors } from "./useSkillCommands";

export const APPEND_COMPOSER_SELECTION_EVENT =
  "goose-note:append-composer-selection";
export const OPEN_AI_PANEL_EVENT = "goose-note:open-ai-panel";

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
  body: { hasAttribute: (name: string) => boolean } | null | undefined = typeof document ===
  "undefined"
    ? null
    : document.body,
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
      [`[选区引用 ${index + 1}]`, `来源页：${quote.pageTitle}`, quote.text].join(
        "\n",
      ),
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

export function listSelectionQuotesFromDom(
  editor: HTMLElement,
): AiSelectionQuoteAttrs[] {
  const quotes: AiSelectionQuoteAttrs[] = [];
  editor
    .querySelectorAll<HTMLElement>("[data-ai-selection-quote-attrs]")
    .forEach((node) => {
      const attrs = parseSelectionQuoteAttrs(
        node.dataset.aiSelectionQuoteAttrs,
      );
      if (attrs) quotes.push(attrs);
    });
  return quotes;
}

export function createSelectionQuoteChipElement(
  attrs: AiSelectionQuoteAttrs,
  options?: { animate?: boolean },
): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.aiSelectionQuoteAttrs = JSON.stringify(attrs);
  span.dataset.aiSelectionQuoteChip = "";
  span.className =
    "ai-composer-chip inline-flex items-center justify-center rounded text-[11px] font-medium" +
    " bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] border border-[var(--goose-inline-code-border-hover)]" +
    " select-none";
  const label = formatSelectionQuotePromptLabel(attrs);
  span.textContent = label;
  span.title = attrs.text;
  span.setAttribute("aria-label", `选区引用，来自${attrs.pageTitle}`);
  if (options?.animate) {
    span.dataset.aiSelectionQuoteEnter = "";
  }
  return span;
}

function captureComposerCaret(
  editor: HTMLElement,
): { node: Node; offset: number } | null {
  const selection = window.getSelection?.();
  if (!selection) return null;
  const node = selection.anchorNode;
  if (!node || (node !== editor && !editor.contains(node))) return null;
  return { node, offset: selection.anchorOffset };
}

function restoreComposerCaret(snapshot: { node: Node; offset: number } | null) {
  if (!snapshot?.node) return;
  const selection = window.getSelection?.();
  if (!selection) return;
  try {
    if (typeof selection.collapse === "function") {
      selection.collapse(snapshot.node, snapshot.offset);
      return;
    }
  } catch {
    // fall through to Range
  }
  try {
    const range = document.createRange();
    range.setStart(snapshot.node, snapshot.offset);
    range.collapse(true);
    selection.removeAllRanges?.();
    selection.addRange?.(range);
  } catch {
    // linkedom / 失效节点：保持不抢光标
  }
}

export function appendSelectionQuoteToDom(
  editor: HTMLElement,
  attrs: AiSelectionQuoteAttrs,
  options?: {
    animate?: boolean;
    restoreCaret?: boolean;
    liveRegion?: HTMLElement | null;
  },
): AppendSelectionQuoteResult {
  if (
    hasDuplicateSelectionQuote(listSelectionQuotesFromDom(editor), attrs)
  ) {
    return "duplicate";
  }

  const restoreCaret = options?.restoreCaret === true;
  const saved = restoreCaret ? captureComposerCaret(editor) : null;

  const chip = createSelectionQuoteChipElement(attrs, {
    animate: options?.animate === true,
  });
  editor.appendChild(chip);
  ensureComposerCaretAnchors(editor);

  if (restoreCaret) {
    restoreComposerCaret(saved);
  }

  const live = options?.liveRegion;
  if (live) {
    live.textContent = "";
    live.textContent = SELECTION_QUOTE_LIVE_ANNOUNCEMENT;
  }

  return "appended";
}

const pendingAppendComposerSelections: AppendComposerSelectionDetail[] = [];

export function takePendingAppendComposerSelections(): AppendComposerSelectionDetail[] {
  return pendingAppendComposerSelections.splice(
    0,
    pendingAppendComposerSelections.length,
  );
}

/** 消费成功（true）才出队；失败留在队列里等输入框挂载后再试。 */
export function consumePendingAppendComposerSelections(
  consume: (detail: AppendComposerSelectionDetail) => boolean,
): number {
  let i = 0;
  while (i < pendingAppendComposerSelections.length) {
    const detail = pendingAppendComposerSelections[i];
    if (!detail || consume(detail)) {
      pendingAppendComposerSelections.splice(i, 1);
      continue;
    }
    i += 1;
  }
  return pendingAppendComposerSelections.length;
}

export function dispatchAppendComposerSelection(
  detail: AppendComposerSelectionDetail,
): void {
  pendingAppendComposerSelections.push(detail);
  if (!readAiPanelActive()) {
    window.dispatchEvent(
      new CustomEvent(OPEN_AI_PANEL_EVENT, {
        detail: { layout: "side-panel" },
      }),
    );
  }
  window.dispatchEvent(
    new CustomEvent(APPEND_COMPOSER_SELECTION_EVENT, { detail }),
  );
}
