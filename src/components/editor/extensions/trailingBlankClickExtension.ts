import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * 点击空白时光标跳到行首。
 *
 * Chromium 对 flex 容器的 caretRangeFromPoint 会落到块首；BlockNote 的
 * `.bn-block-content` 是 flex。块间距用的是 margin，点在两块中间的空隙
 * 会落到下一块顶部；ProseMirror 默认把光标钉在下一块行首。旧逻辑又把
 * 空隙判给上方块并钉到行尾。mousedown 微任务与 click 默认处理互抢，
 * 光标和当前行高亮会在两块之间来回跳。
 *
 * 块间空隙：不改选区，并拦住默认点击。
 * 行尾空白：仍钉到该行行尾。点在字上仍交给默认。
 */

export const TRAILING_BLANK_CLICK_SLOP_PX = 2;

const INTERACTIVE_CLICK_SELECTOR = [
  "input",
  "button",
  "textarea",
  "select",
  "a",
  ".bn-side-menu",
  ".bn-toggle-button",
  ".bn-table-handle",
  ".bn-table-cell-handle",
  ".goose-table-extend-button",
  "[data-file-block]",
].join(",");

export type CaretCoords = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function isInteractiveCaretClickTarget(
  target: EventTarget | null,
): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(INTERACTIVE_CLICK_SELECTOR));
}

export function isClickPastTextRight(
  clientX: number,
  textRight: number,
  slop = TRAILING_BLANK_CLICK_SLOP_PX,
): boolean {
  return clientX > textRight + slop;
}

export function isClickOnVisualLine(
  clientY: number,
  lineTop: number,
  lineBottom: number,
  slop = TRAILING_BLANK_CLICK_SLOP_PX,
): boolean {
  return clientY >= lineTop - slop && clientY <= lineBottom + slop;
}

function wrappedToNextLine(curr: CaretCoords, next: CaretCoords): boolean {
  return next.top >= curr.bottom - 1 && next.left < curr.left;
}

/** 从 `from` 沿同一视觉行走到最后一个文档位置。 */
export function extendToVisualLineEnd(
  coordsAtPos: (pos: number) => CaretCoords,
  from: number,
  textblockEnd: number,
): number {
  let pos = from;
  while (pos < textblockEnd) {
    let curr: CaretCoords;
    let next: CaretCoords;
    try {
      curr = coordsAtPos(pos);
      next = coordsAtPos(pos + 1);
    } catch {
      break;
    }
    if (wrappedToNextLine(curr, next)) break;
    pos += 1;
  }
  return pos;
}

/** 从 `from` 沿同一视觉行走到第一个文档位置。 */
export function extendToVisualLineStart(
  coordsAtPos: (pos: number) => CaretCoords,
  from: number,
  textblockStart: number,
): number {
  let pos = from;
  while (pos > textblockStart) {
    let curr: CaretCoords;
    let prev: CaretCoords;
    try {
      curr = coordsAtPos(pos);
      prev = coordsAtPos(pos - 1);
    } catch {
      break;
    }
    if (wrappedToNextLine(prev, curr)) break;
    pos -= 1;
  }
  return pos;
}

/** 二分找到 `clientY` 所在视觉行上的一个文档位置。 */
export function findPosOnVisualLine(
  coordsAtPos: (pos: number) => CaretCoords,
  start: number,
  end: number,
  clientY: number,
): number | null {
  let lo = start;
  let hi = end;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let coords: CaretCoords;
    try {
      coords = coordsAtPos(mid);
    } catch {
      return null;
    }
    if (clientY < coords.top - TRAILING_BLANK_CLICK_SLOP_PX) {
      hi = mid - 1;
    } else if (clientY > coords.bottom + TRAILING_BLANK_CLICK_SLOP_PX) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  return null;
}

/** 行高留白 / 折行缝里取离 `clientY` 最近的视觉行。 */
function findNearestPosOnVisualLine(
  coordsAtPos: (pos: number) => CaretCoords,
  start: number,
  end: number,
  clientY: number,
): number | null {
  const exact = findPosOnVisualLine(coordsAtPos, start, end, clientY);
  if (exact != null) return exact;

  let lo = start;
  let hi = end;
  let best: number | null = null;
  let bestDist = Infinity;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let coords: CaretCoords;
    try {
      coords = coordsAtPos(mid);
    } catch {
      return best;
    }
    let dist = 0;
    if (clientY < coords.top) dist = coords.top - clientY;
    else if (clientY > coords.bottom) dist = clientY - coords.bottom;
    if (dist < bestDist) {
      bestDist = dist;
      best = mid;
    }
    if (clientY < coords.top) hi = mid - 1;
    else if (clientY > coords.bottom) lo = mid + 1;
    else return mid;
  }
  return best;
}

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

export function resolveLineEndIfClickPastText(args: {
  clientX: number;
  clientY: number;
  start: number;
  end: number;
  coordsAtPos: (pos: number) => CaretCoords;
}): number | null {
  const { clientX, clientY, start, end, coordsAtPos } = args;
  if (start === end) return null;

  const onLine = findPosOnVisualLine(coordsAtPos, start, end, clientY);
  if (onLine == null) return null;

  const lineEnd = extendToVisualLineEnd(coordsAtPos, onLine, end);
  let endCoords: CaretCoords;
  try {
    endCoords = coordsAtPos(lineEnd);
  } catch {
    return null;
  }

  if (!isClickOnVisualLine(clientY, endCoords.top, endCoords.bottom)) {
    if (lineEnd === start) return null;
    try {
      endCoords = coordsAtPos(lineEnd - 1);
    } catch {
      return null;
    }
    if (!isClickOnVisualLine(clientY, endCoords.top, endCoords.bottom)) {
      return null;
    }
  }

  if (!isClickPastTextRight(clientX, endCoords.right)) return null;
  return lineEnd;
}

/** 点在字上不改；点行尾空白或块间/块内 padding 空隙则落到最近一行行尾。 */
export function resolveBlockEmptyClickPos(args: {
  clientX: number;
  clientY: number;
  start: number;
  end: number;
  coordsAtPos: (pos: number) => CaretCoords;
}): number | null {
  const { clientY, start, end, coordsAtPos } = args;
  if (start === end) return start;

  const onLine = findPosOnVisualLine(coordsAtPos, start, end, clientY);
  if (onLine != null) return resolveLineEndIfClickPastText(args);

  try {
    const first = coordsAtPos(start);
    if (clientY < first.top) {
      return extendToVisualLineEnd(coordsAtPos, start, end);
    }
    const last = coordsAtPos(end);
    if (clientY > last.bottom) {
      return end;
    }
  } catch {
    return null;
  }

  // 文字垂直范围内但没贴到 caret 带：行高留白 / 折行缝。
  // 按最近视觉行处理，不要当成块间空隙拽到段尾。
  const nearest = findNearestPosOnVisualLine(coordsAtPos, start, end, clientY);
  if (nearest == null) return null;
  try {
    const coords = coordsAtPos(nearest);
    return resolveLineEndIfClickPastText({
      ...args,
      clientY: (coords.top + coords.bottom) / 2,
    });
  } catch {
    return null;
  }
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

function collectInlineBlockContents(editorDom: Element): HTMLElement[] {
  return [...editorDom.querySelectorAll<HTMLElement>(".bn-block-content")].filter(
    isTextBlockContent,
  );
}

function closestBlockContentEl(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof target !== "object") return null;
  const closest = (target as { closest?: (selector: string) => unknown })
    .closest;
  if (typeof closest !== "function") return null;
  const el = closest.call(target, ".bn-block-content");
  if (!el || typeof (el as { querySelector?: unknown }).querySelector !== "function") {
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
  if (!cell || typeof (cell as { querySelector?: unknown }).querySelector !== "function") {
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
    return (
      contentEl.querySelector<HTMLElement>(":scope pre") ?? contentEl
    );
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

function textblockRangeFromContentEl(
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

function textBandForContent(
  view: EditorView,
  el: HTMLElement,
  fallback: BlockHitRect,
): BlockHitRect {
  const range = textblockRangeFromContentEl(view, el);
  if (!range) return fallback;
  try {
    const first = view.coordsAtPos(range.start);
    const last = view.coordsAtPos(range.end);
    return {
      top: Math.min(first.top, last.top),
      bottom: Math.max(first.bottom, last.bottom),
    };
  } catch {
    return fallback;
  }
}

/**
 * 两块文字行带之间的垂直空隙（含块 padding / margin）。
 * 点在某块文字行带内（含行尾空白）不算空隙。
 */
function isPointerInInterBlockGap(
  view: EditorView,
  clientY: number,
): boolean {
  const contents = collectInlineBlockContents(view.dom);
  if (contents.length < 2) return false;

  let hasAbove = false;
  let hasBelow = false;
  for (const el of contents) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < clientY) {
      hasAbove = true;
      continue;
    }
    if (rect.top > clientY) {
      hasBelow = true;
      if (hasAbove) return true;
      continue;
    }
    const band = textBandForContent(view, el, {
      top: rect.top,
      bottom: rect.bottom,
    });
    if (clientY >= band.top && clientY <= band.bottom) return false;
    if (band.bottom < clientY) hasAbove = true;
    if (band.top > clientY) hasBelow = true;
    if (hasAbove && hasBelow) return true;
  }
  return hasAbove && hasBelow;
}

export function resolveTrailingBlankClickPos(
  view: EditorView,
  event: MouseEvent,
): number | null {
  if (isPointerInInterBlockGap(view, event.clientY)) return null;

  const contentEl = pickTrailingBlankContentEl(
    event.target,
    collectInlineBlockContents(view.dom),
    event.clientY,
  );
  if (!contentEl) return null;

  const range = textblockRangeFromContentEl(view, contentEl);
  if (!range) return null;

  return resolveBlockEmptyClickPos({
    clientX: event.clientX,
    clientY: event.clientY,
    start: range.start,
    end: range.end,
    coordsAtPos: (pos) => view.coordsAtPos(pos),
  });
}

function shouldIgnoreTrailingBlankEvent(
  view: EditorView,
  event: MouseEvent,
): boolean {
  if (event.button !== 0) return true;
  if (event.shiftKey || event.altKey) return true;
  if (view.composing) return true;
  if (!view.editable) return true;
  return isInteractiveCaretClickTarget(event.target);
}

function isInterBlockGapEvent(view: EditorView, event: MouseEvent): boolean {
  if (tableCellInlineFromEventTarget(event.target)) return false;
  const closest = closestBlockContentEl(event.target);
  if (closest && !isTextBlockContent(closest)) return false;
  return isPointerInInterBlockGap(view, event.clientY);
}

/** 拦住块间空隙上的默认选区，避免光标在相邻块之间来回跳。 */
function swallowInterBlockGapClick(
  view: EditorView,
  event: MouseEvent,
): boolean {
  if (shouldIgnoreTrailingBlankEvent(view, event)) return false;
  if (!isInterBlockGapEvent(view, event)) return false;
  if (!view.hasFocus()) view.focus();
  return true;
}

function applyTrailingBlankSelection(view: EditorView, pos: number): boolean {
  if (!view.dom.isConnected) return false;
  if (!view.state.selection.empty) return false;
  if (view.state.selection.from === pos) return false;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)),
  );
  return true;
}

function handleTrailingBlankClick(
  view: EditorView,
  _pos: number,
  event: MouseEvent,
): boolean {
  if (shouldIgnoreTrailingBlankEvent(view, event)) return false;
  const nextPos = resolveTrailingBlankClickPos(view, event);
  if (nextPos == null) return false;
  return applyTrailingBlankSelection(view, nextPos);
}

export const gooseTrailingBlankClickExtension = createExtension({
  key: "goose-trailing-blank-click",
  prosemirrorPlugins: [
    new Plugin({
      key: new PluginKey("goose-trailing-blank-click"),
      props: {
        handleDOMEvents: {
          mousedown(view, event) {
            if (swallowInterBlockGapClick(view, event)) return true;
            if (shouldIgnoreTrailingBlankEvent(view, event)) return false;
            const nextPos = resolveTrailingBlankClickPos(view, event);
            if (nextPos == null) return false;
            // 不拦截默认 mousedown（拖选用），在同一轮任务末尾、绘制前把塌缩光标钉到行尾。
            queueMicrotask(() => {
              applyTrailingBlankSelection(view, nextPos);
            });
            return false;
          },
        },
        handleClick(view, pos, event) {
          if (swallowInterBlockGapClick(view, event)) return true;
          return handleTrailingBlankClick(view, pos, event);
        },
      },
    }),
  ],
});
