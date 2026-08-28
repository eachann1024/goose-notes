/** 任意 heading 块（含尚未 isToggleable 的普通标题）。 */
export function isHeadingBlock(block: {
  type?: string;
} | null | undefined): boolean {
  return block?.type === "heading";
}

/** 可折叠 heading：非文档首块（page title / document[0]）。 */
export function isFoldableHeadingBlock(
  block: { id?: string; type?: string } | null | undefined,
  firstBlockId: string | undefined,
): boolean {
  if (block?.type !== "heading" || !block.id) return false;
  if (!firstBlockId) return true;
  return block.id !== firstBlockId;
}

export function queryHeadingTextRect(blockId: string): DOMRect | null {
  const blockEl = document.querySelector(`[data-id="${blockId}"]`);
  if (!blockEl) return null;
  const textEl = blockEl.querySelector("h1, h2, h3, .bn-inline-content");
  if (!textEl) return null;
  return textEl.getBoundingClientRect();
}

export function queryHeadingToggleWrapper(blockId: string): Element | null {
  return document.querySelector(
    `[data-id="${blockId}"] .bn-toggle-wrapper`,
  );
}

export function readHeadingToggleExpanded(blockId: string): boolean {
  return (
    queryHeadingToggleWrapper(blockId)?.getAttribute("data-show-children") ===
    "true"
  );
}

/** 点 BlockNote 行内折叠按钮（无公开 API；与 searchHighlightLocate 同一选择器）。 */
export function clickHeadingToggleButton(blockId: string): boolean {
  const button = document.querySelector(
    `[data-id="${blockId}"] .bn-toggle-button`,
  );
  if (!(button instanceof HTMLElement)) return false;
  button.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }),
  );
  return true;
}
