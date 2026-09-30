/**
 * contenteditable 换行与光标滚入可视区。
 * 被 AiComposerInput 的 Shift+Enter / 换行后滚动使用。
 * 无外部模块依赖。
 */

/**
 * Scroll the contenteditable composer so the current caret stays in view.
 * Uses Selection/Range client rects and adjusts editor.scrollTop only
 * (avoids page-level scrollIntoView).
 */
export function scrollComposerCaretIntoView(editor: HTMLElement): void {
  if (editor.scrollHeight <= editor.clientHeight + 1) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    editor.scrollTop = editor.scrollHeight;
    return;
  }

  const range = selection.getRangeAt(0);
  if (
    editor !== range.commonAncestorContainer &&
    !editor.contains(range.commonAncestorContainer)
  ) {
    return;
  }

  let caretTop: number | null = null;
  let caretBottom: number | null = null;

  const acceptRect = (rect: DOMRect | ClientRect): boolean => {
    // Collapsed carets often report 0×0 at (0,0) — treat as missing.
    if (
      rect.width === 0 &&
      rect.height === 0 &&
      rect.top === 0 &&
      rect.left === 0
    ) {
      return false;
    }
    caretTop = rect.top;
    caretBottom = rect.bottom;
    return true;
  };

  const rects = range.getClientRects();
  if (rects.length > 0) {
    acceptRect(rects[rects.length - 1]!);
  }
  if (caretTop === null) {
    acceptRect(range.getBoundingClientRect());
  }

  if (caretTop === null) {
    // Temporary marker when collapsed caret has no geometry (common after <br>).
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    marker.style.cssText =
      "display:inline-block;width:0;height:1em;padding:0;margin:0;border:0;overflow:hidden;vertical-align:baseline;";

    const probe = range.cloneRange();
    probe.collapse(true);
    probe.insertNode(marker);
    acceptRect(marker.getBoundingClientRect());
    const parent = marker.parentNode;
    parent?.removeChild(marker);
    try {
      parent?.normalize();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // Range may be stale after DOM probe; fall through to scrollHeight.
    }
  }

  if (caretTop === null || caretBottom === null) {
    editor.scrollTop = editor.scrollHeight;
    return;
  }

  const editorRect = editor.getBoundingClientRect();
  const overflowBottom = caretBottom - editorRect.bottom;
  const overflowTop = editorRect.top - caretTop;

  if (overflowBottom > 0) {
    editor.scrollTop += overflowBottom;
  } else if (overflowTop > 0) {
    editor.scrollTop -= overflowTop;
  }
}

/**
 * Insert a soft line break into the contenteditable composer.
 * Prefer native insertLineBreak / insertText; fall back to a trailing-safe <br>.
 * A lone trailing <br> often fails to create a visible new line in Chromium.
 */
export function insertComposerLineBreak(editor: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  const selectionInsideEditor =
    selection.rangeCount > 0 &&
    (editor === selection.anchorNode ||
      editor.contains(selection.anchorNode));

  if (!selectionInsideEditor) {
    editor.focus();
    const endRange = document.createRange();
    endRange.selectNodeContents(editor);
    endRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(endRange);
  }

  const finish = (ok: boolean): boolean => {
    if (ok) {
      // Layout after insert may not be flushed yet; scroll now and once after paint.
      scrollComposerCaretIntoView(editor);
      requestAnimationFrame(() => {
        scrollComposerCaretIntoView(editor);
      });
    }
    return ok;
  };

  try {
    if (document.execCommand("insertLineBreak")) return finish(true);
  } catch {
    // fall through
  }

  // whitespace-pre-wrap makes a real newline text node render correctly
  try {
    if (document.execCommand("insertText", false, "\n")) return finish(true);
  } catch {
    // fall through
  }

  if (!selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (
    editor !== range.commonAncestorContainer &&
    !editor.contains(range.commonAncestorContainer)
  ) {
    return false;
  }

  range.deleteContents();
  const br = document.createElement("br");
  range.insertNode(br);

  // Trailing <br> needs a following anchor node so the caret can sit on the new line
  if (!br.nextSibling) {
    const anchor = document.createElement("br");
    br.parentNode?.insertBefore(anchor, br.nextSibling);
  }

  const nextRange = document.createRange();
  nextRange.setStartAfter(br);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  return finish(true);
}
