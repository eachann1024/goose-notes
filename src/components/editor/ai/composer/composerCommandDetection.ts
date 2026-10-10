export interface DetectedCommand {
  query: string;
  range: Range;
}

/**
 * 当前 text node 内 `/query` 探测（与 @ 一致：任意位置，前一字符须为空白、零宽字符或行首）。
 * query 中不能有空白。
 */
export function parseSlashCommandBeforeCaret(beforeCaret: string): {
  query: string;
  slashIndex: number;
} | null {
  const slashIndex = beforeCaret.lastIndexOf("/");
  if (slashIndex === -1) return null;
  // 前置字符若不是空白、换行、零宽字符且不是行首，则不算合法命令
  if (slashIndex > 0) {
    const prevChar = beforeCaret[slashIndex - 1];
    if (!/[\s\n\u200B\uFEFF]/.test(prevChar)) {
      // 进一步检查 slashIndex 之前是否全部是零宽字符（等效于行首）
      const textBefore = beforeCaret.slice(0, slashIndex);
      if (textBefore.replace(/[\u200B\uFEFF]/g, "").length > 0) {
        return null;
      }
    }
  }
  const rawQuery = beforeCaret.slice(slashIndex + 1);
  if (/[\s\n]/.test(rawQuery)) return null;
  const query = rawQuery.replace(/[\u200B\uFEFF]/g, "");
  return { query, slashIndex };
}

/**
 * 空输入框在旧 Chromium 里 caret 常落在 contenteditable 元素上，不是 TEXT_NODE。
 * 只认文本节点时，本地文件夹空会话（没有默认 @chip）输入 @ / 会探测失败。
 */
export function getComposerCaretTextContext(container: HTMLElement): {
  textNode: Text;
  beforeCaret: string;
} | null {
  const selection = window.getSelection();
  if (!selection?.isCollapsed) return null;
  const anchor = selection.anchorNode;
  if (!anchor || !container.contains(anchor)) return null;

  if (anchor.nodeType === Node.TEXT_NODE) {
    const textNode = anchor as Text;
    return {
      textNode,
      beforeCaret: (textNode.textContent ?? "").slice(
        0,
        selection.anchorOffset,
      ),
    };
  }

  if (anchor.nodeType !== Node.ELEMENT_NODE) return null;
  const offset = selection.anchorOffset;
  const prev = anchor.childNodes[offset - 1];
  if (prev?.nodeType === Node.TEXT_NODE) {
    const textNode = prev as Text;
    return { textNode, beforeCaret: textNode.textContent ?? "" };
  }
  const next = anchor.childNodes[offset];
  if (next?.nodeType === Node.TEXT_NODE) {
    return { textNode: next as Text, beforeCaret: "" };
  }
  const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
  const first = walker.nextNode();
  if (first && container.contains(first)) {
    const textNode = first as Text;
    return { textNode, beforeCaret: textNode.textContent ?? "" };
  }
  return null;
}

export function detectCommandAtCaret(
  container: HTMLElement,
): DetectedCommand | null {
  const caret = getComposerCaretTextContext(container);
  if (!caret) return null;
  const parsed = parseSlashCommandBeforeCaret(caret.beforeCaret);
  if (!parsed) return null;
  const range = document.createRange();
  range.setStart(caret.textNode, parsed.slashIndex);
  range.setEnd(caret.textNode, caret.beforeCaret.length);
  return { query: parsed.query, range };
}
