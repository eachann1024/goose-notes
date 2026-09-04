/**
 * mention / 图片 / Skill chip 的边界探测与 beforeinput 删除决策。
 * 被 AiComposerInput 原生删除/方向键处理使用。
 * 依赖 useSkillCommands 的 ZWSP 工具。
 */
import {
  isComposerZwspOnlyText,
  stripComposerCaretZwsp,
} from "./useSkillCommands";
import { isComposerDeleteInputType } from "./composerInputGuards";

export const COMPOSER_CHIP_SELECTOR =
  "[data-ai-mention-attrs], [data-ai-image-attrs], [data-ai-skill-attrs], [data-ai-selection-quote-attrs]";

export function isComposerChipElement(node: Node | null): node is HTMLElement {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as HTMLElement;
  return (
    el.dataset.aiMentionAttrs != null ||
    el.dataset.aiImageAttrs != null ||
    el.dataset.aiSkillAttrs != null ||
    el.dataset.aiSelectionQuoteAttrs != null
  );
}

export function editorHasComposerChips(editor: HTMLElement): boolean {
  return Boolean(editor.querySelector(COMPOSER_CHIP_SELECTOR));
}

/** selection 是否覆盖编辑器全部内容（全选删除） */
export function selectionCoversEntireEditor(
  editor: HTMLElement,
  range: Range,
): boolean {
  try {
    const full = document.createRange();
    full.selectNodeContents(editor);
    return (
      range.compareBoundaryPoints(Range.START_TO_START, full) <= 0 &&
      range.compareBoundaryPoints(Range.END_TO_END, full) >= 0
    );
  } catch {
    return false;
  }
}

/** 选区是否与任一 mention/image chip 相交 */
export function rangeContainsComposerChip(
  range: Range,
  editor?: HTMLElement | null,
): boolean {
  const root =
    editor ??
    (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as HTMLElement)
      : range.commonAncestorContainer.parentElement);
  if (!root) return false;
  const scope =
    (root.closest?.("[data-ai-composer-editor]") as HTMLElement | null) ?? root;
  const chips = scope.querySelectorAll?.(COMPOSER_CHIP_SELECTOR);
  if (!chips) return false;
  for (const chip of chips) {
    try {
      if (range.intersectsNode(chip)) return true;
    } catch {
      // detached / invalid boundary
    }
  }
  return false;
}

function skipEmptyTextSiblings(
  node: Node | null,
  direction: "previous" | "next",
): Node | null {
  let current = node;
  while (current && current.nodeType === Node.TEXT_NODE) {
    const text = current.textContent ?? "";
    // 空节点或纯 ZWSP 锚点：对 chip 边界探测视为“无内容”
    if (text.length > 0 && !isComposerZwspOnlyText(text)) break;
    current =
      direction === "previous" ? current.previousSibling : current.nextSibling;
  }
  return current;
}

/** 折叠光标紧贴 chip 左侧边界时，返回该 chip（Backspace / ← 目标） */
export function getComposerChipBeforeCaret(
  editor: HTMLElement,
  range?: Range | null,
): HTMLElement | null {
  const live =
    range ??
    (window.getSelection()?.rangeCount
      ? window.getSelection()!.getRangeAt(0)
      : null);
  if (!live || !live.collapsed || !editor.contains(live.startContainer)) {
    return null;
  }
  const { startContainer, startOffset } = live;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent ?? "";
    const onlyZwsp = isComposerZwspOnlyText(text);
    // 普通文本中间：不算紧贴 chip
    if (startOffset > 0 && !onlyZwsp) return null;
    // 纯 ZWSP 内任意 offset，或 offset===0：向左跳过空/ZWSP 找 chip
    let node: Node | null = startContainer;
    while (node && node !== editor) {
      const prev = skipEmptyTextSiblings(node.previousSibling, "previous");
      if (isComposerChipElement(prev)) return prev;
      if (prev) return null;
      node = node.parentNode;
    }
    return null;
  }

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const el = startContainer as HTMLElement;
    let i = startOffset - 1;
    while (i >= 0) {
      const child = el.childNodes[i];
      if (isComposerChipElement(child)) return child;
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent ?? "";
        if (!t.length || isComposerZwspOnlyText(t)) {
          i -= 1;
          continue;
        }
      }
      return null;
    }
  }
  return null;
}

/** 折叠光标紧贴 chip 右侧边界时，返回该 chip（Delete / → 目标） */
export function getComposerChipAfterCaret(
  editor: HTMLElement,
  range?: Range | null,
): HTMLElement | null {
  const live =
    range ??
    (window.getSelection()?.rangeCount
      ? window.getSelection()!.getRangeAt(0)
      : null);
  if (!live || !live.collapsed || !editor.contains(live.startContainer)) {
    return null;
  }
  const { startContainer, startOffset } = live;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent ?? "";
    const len = text.length;
    const onlyZwsp = isComposerZwspOnlyText(text);
    // 普通文本中间：不算紧贴 chip
    if (startOffset < len && !onlyZwsp) return null;
    let node: Node | null = startContainer;
    while (node && node !== editor) {
      const next = skipEmptyTextSiblings(node.nextSibling, "next");
      if (isComposerChipElement(next)) return next;
      if (next) return null;
      node = node.parentNode;
    }
    return null;
  }

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const el = startContainer as HTMLElement;
    let i = startOffset;
    while (i < el.childNodes.length) {
      const child = el.childNodes[i];
      if (isComposerChipElement(child)) return child;
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent ?? "";
        if (!t.length || isComposerZwspOnlyText(t)) {
          i += 1;
          continue;
        }
      }
      return null;
    }
  }
  return null;
}

export type ComposerBeforeInputDeleteAction =
  | "ignore"
  | "clear-editor"
  | "delete-selection-chips"
  | "remove-chip-before"
  | "remove-chip-after";

/**
 * beforeinput 删除决策（纯函数，便于单测）。
 * IME 会话中必须 ignore，绝不自定义删。
 */
export function resolveComposerBeforeInputDelete(options: {
  inputType: string | undefined;
  imeActive: boolean;
  hasChips: boolean;
  selectionCoversEntire: boolean;
  rangeCollapsed: boolean;
  rangeContainsChip: boolean;
  chipBeforeCaret: boolean;
  chipAfterCaret: boolean;
}): ComposerBeforeInputDeleteAction {
  if (options.imeActive) return "ignore";
  if (!isComposerDeleteInputType(options.inputType)) return "ignore";
  if (!options.hasChips) return "ignore";

  if (options.selectionCoversEntire) return "clear-editor";

  if (!options.rangeCollapsed && options.rangeContainsChip) {
    return "delete-selection-chips";
  }

  if (options.rangeCollapsed) {
    const type = options.inputType ?? "";
    const backward =
      type === "deleteContentBackward" ||
      type === "deleteWordBackward" ||
      type === "deleteSoftLineBackward" ||
      type === "deleteHardLineBackward";
    const forward =
      type === "deleteContentForward" ||
      type === "deleteWordForward" ||
      type === "deleteSoftLineForward" ||
      type === "deleteHardLineForward";

    if (backward && options.chipBeforeCaret) return "remove-chip-before";
    if (forward && options.chipAfterCaret) return "remove-chip-after";
  }

  return "ignore";
}

export function removeComposerChipsIntersectingRange(
  editor: HTMLElement,
  range: Range,
) {
  const chips = Array.from(
    editor.querySelectorAll<HTMLElement>(COMPOSER_CHIP_SELECTOR),
  );
  for (const chip of chips) {
    try {
      if (range.intersectsNode(chip)) {
        chip.remove();
      }
    } catch {
      // ignore
    }
  }
}

/** 清理 chip 移除后残留的孤儿 ZWSP / 空文本节点 */
export function cleanupOrphanComposerZwspNodes(editor: HTMLElement) {
  const hasChips = editorHasComposerChips(editor);
  const rawText = editor.textContent ?? "";
  const visible = stripComposerCaretZwsp(rawText).trim();

  // 如果已经没有任何 chip 且没有可视文本，彻底置空以重置 DOM 状态
  if (!hasChips && visible.length === 0) {
    editor.innerHTML = "";
    return;
  }

  // 清理未与 chip 相邻的纯 ZWSP 节点
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const toRemove: Text[] = [];
  let node = walker.nextNode() as Text | null;
  while (node) {
    const val = node.data;
    if (isComposerZwspOnlyText(val)) {
      const prev = node.previousSibling;
      const next = node.nextSibling;
      const isAdjacentToChip =
        isComposerChipElement(prev) || isComposerChipElement(next);
      if (!isAdjacentToChip) {
        toRemove.push(node);
      }
    }
    node = walker.nextNode() as Text | null;
  }
  for (const n of toRemove) {
    n.remove();
  }
}

export function placeCaretInEditor(editor: HTMLElement, atStart: boolean) {
  const selection = window.getSelection();
  if (!selection) return;
  const caret = document.createRange();
  caret.selectNodeContents(editor);
  caret.collapse(atStart);
  selection.removeAllRanges();
  selection.addRange(caret);
}

/** 是否已无文本且无 chip（只读 DOM，不建 token；ZWSP 锚点不算内容） */
export function isEditorDomEmpty(el: HTMLElement) {
  if (el.querySelector(COMPOSER_CHIP_SELECTOR)) {
    return false;
  }
  return !stripComposerCaretZwsp(el.textContent ?? "").trim();
}
