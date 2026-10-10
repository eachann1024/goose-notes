import type { EditorView } from "@tiptap/pm/view";

export type BlockHitRect = { top: number; bottom: number };

/**
 * 点在块盒子里用最内层块；点在首块之上或末块之下时归最近的那一块。
 * `blocks` 按 DOM 顺序（父先于子），含住时取最后一个即最内层。
 * 两块之间的空隙由 `isClickInInterBlockGap` 单独吞掉，不走这里。
 */
export function pickOwningBlockIndex(
  blocks: BlockHitRect[],
  clientY: number,
): number | null {
  if (blocks.length === 0) return null;

  let containing = -1;
  for (let i = 0; i < blocks.length; i += 1) {
    if (clientY >= blocks[i].top && clientY <= blocks[i].bottom) {
      containing = i;
    }
  }
  if (containing >= 0) return containing;

  let above = -1;
  let aboveBottom = -Infinity;
  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i].bottom <= clientY && blocks[i].bottom >= aboveBottom) {
      above = i;
      aboveBottom = blocks[i].bottom;
    }
  }
  if (above >= 0) return above;
  return 0;
}

/** 点在两块内容盒子之间的垂直空隙：不改光标。首块之上、末块之下不算。 */
export function isClickInInterBlockGap(
  blocks: BlockHitRect[],
  clientY: number,
): boolean {
  if (blocks.length < 2) return false;
  for (const block of blocks) {
    if (clientY >= block.top && clientY <= block.bottom) return false;
  }
  let hasAbove = false;
  let hasBelow = false;
  for (const block of blocks) {
    if (block.bottom < clientY) hasAbove = true;
    if (block.top > clientY) hasBelow = true;
    if (hasAbove && hasBelow) return true;
  }
  return false;
}

function textblockRangeAt(
  view: EditorView,
  pos: number,
): { start: number; end: number } | null {
  const $pos = view.state.doc.resolve(pos);
  if ($pos.parent.isTextblock) {
    return { start: $pos.start(), end: $pos.end() };
  }
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!node.isTextblock) continue;
    const start = $pos.start(depth);
    return { start, end: start + node.content.size };
  }
  return null;
}

/**
 * 表格/媒体外壳不是可编辑文本块。
 * 点在这些块上时不能按 Y 把光标判给上方标题；单元格走自己的 inline 容器。
 */
const NON_TEXT_BLOCK_CONTENT_TYPES = new Set([
  "table",
  "image",
  "imageResize",
  "video",
  "file",
  "audio",
  "divider",
]);

/**
 * 标准块的 `.bn-inline-content` 是 `.bn-block-content` 的直接子级；
 * 标题/引用隔了一层 `h1`/`blockquote`；callout 等 React 自定义块则嵌在
 * `.react-renderer` 里。漏掉后者时，点击会被判给上方块（常见为标题 H1）。
 */
export function isTextBlockContent(el: HTMLElement): boolean {
  const type = el.getAttribute("data-content-type");
  if (type && NON_TEXT_BLOCK_CONTENT_TYPES.has(type)) return false;
  if (type === "codeBlock" || type === "callout") return true;
  return Boolean(
    el.querySelector(":scope > .bn-inline-content") ||
    el.querySelector(
      ":scope > :is(h1, h2, h3, h4, h5, h6) .bn-inline-content",
    ) ||
    el.querySelector(":scope > blockquote .bn-inline-content") ||
    el.querySelector(":scope > pre") ||
    el.querySelector(":scope .bn-inline-content"),
  );
}

export function collectInlineBlockContents(editorDom: Element): HTMLElement[] {
  return [
    ...editorDom.querySelectorAll<HTMLElement>(".bn-block-content"),
  ].filter(isTextBlockContent);
}

export function closestBlockContentEl(
  target: EventTarget | null,
): HTMLElement | null {
  if (!target || typeof target !== "object") return null;
  const closest = (target as { closest?: (selector: string) => unknown })
    .closest;
  if (typeof closest !== "function") return null;
  const el = closest.call(target, ".bn-block-content");
  if (
    !el ||
    typeof (el as { querySelector?: unknown }).querySelector !== "function"
  ) {
    return null;
  }
  return el as HTMLElement;
}

/**
 * 表格单元格的可编辑面是 td/th 里的 `.bn-inline-content`，
 * 不是外层 `data-content-type="table"`。点格内文字或格内空白时用这一层。
 */
export function tableCellInlineFromEventTarget(
  target: EventTarget | null,
): HTMLElement | null {
  if (!target || typeof target !== "object") return null;
  const closest = (target as { closest?: (selector: string) => unknown })
    .closest;
  if (typeof closest !== "function") return null;
  const cell = closest.call(target, "td, th");
  if (
    !cell ||
    typeof (cell as { querySelector?: unknown }).querySelector !== "function"
  ) {
    return null;
  }
  const tableBlock = closestBlockContentEl(target);
  if (!tableBlock || tableBlock.getAttribute("data-content-type") !== "table") {
    return null;
  }
  const htmlCell = cell as HTMLElement;
  return (
    htmlCell.querySelector<HTMLElement>(":scope > .bn-inline-content") ??
    htmlCell.querySelector<HTMLElement>(".bn-inline-content") ??
    htmlCell
  );
}

function inlineContentEl(contentEl: HTMLElement): HTMLElement {
  const type = contentEl.getAttribute("data-content-type");
  if (type === "codeBlock") {
    return contentEl.querySelector<HTMLElement>(":scope pre") ?? contentEl;
  }
  return (
    contentEl.querySelector<HTMLElement>(":scope > .bn-inline-content") ??
    contentEl.querySelector<HTMLElement>(
      ":scope > :is(h1, h2, h3, h4, h5, h6) .bn-inline-content",
    ) ??
    contentEl.querySelector<HTMLElement>(
      ":scope > blockquote .bn-inline-content",
    ) ??
    contentEl.querySelector<HTMLElement>(".callout-content") ??
    contentEl.querySelector<HTMLElement>(":scope .bn-inline-content") ??
    contentEl.querySelector<HTMLElement>(":scope > pre") ??
    contentEl
  );
}

export function textblockRangeFromContentEl(
  view: EditorView,
  contentEl: HTMLElement,
): { start: number; end: number } | null {
  const inline = contentEl.classList.contains("bn-block-content")
    ? inlineContentEl(contentEl)
    : contentEl;
  try {
    const pos = view.posAtDOM(inline, 0);
    return textblockRangeAt(view, pos);
  } catch {
    return null;
  }
}

/** 点在某个块内部时，用该块，不要按 Y 把点击判给上方标题。 */
export function contentBlockFromEventTarget(
  target: EventTarget | null,
): HTMLElement | null {
  const htmlEl = closestBlockContentEl(target);
  return htmlEl && isTextBlockContent(htmlEl) ? htmlEl : null;
}

/**
 * 点在表格/图片等结构化块内部时，不要按 Y 把点击判给上方标题。
 * 表格单元格返回该格 inline；图片/视频/文件/分割线返回 null（交给默认点击）。
 */
export function pickTrailingBlankContentEl(
  target: EventTarget | null,
  contents: HTMLElement[],
  clientY: number,
): HTMLElement | null {
  const closest = closestBlockContentEl(target);
  if (closest && !isTextBlockContent(closest)) {
    return tableCellInlineFromEventTarget(target);
  }
  if (closest && isTextBlockContent(closest)) return closest;
  if (contents.length === 0) return null;
  return (
    contents[
      pickOwningBlockIndex(
        contents.map((el) => {
          const rect = el.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom };
        }),
        clientY,
      ) ?? -1
    ] ?? null
  );
}
