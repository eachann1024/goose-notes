import { ensureComposerCaretAnchors } from "./composerCaret";
import {
  parseSelectionQuoteAttrs,
  formatSelectionQuotePromptLabel,
  hasDuplicateSelectionQuote,
  SELECTION_QUOTE_LIVE_ANNOUNCEMENT,
  type AiSelectionQuoteAttrs,
  type AppendSelectionQuoteResult,
} from "./selectionQuoteData";

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
  if (hasDuplicateSelectionQuote(listSelectionQuotesFromDom(editor), attrs)) {
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
