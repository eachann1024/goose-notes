import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * 点击空白时光标跳到行首。
 *
 * Chromium 对 flex 容器的 caretRangeFromPoint 会落到块首；BlockNote 的
 * `.bn-block-content` 是 flex。更关键的是块间距用的是 margin，点在两块
 * 中间的空隙会落到下一块顶部 padding，ProseMirror 默认把光标钉在行首。
 *
 * Notion：整行（含右侧空白）和块间空隙都算上方块的点击区，点空白落到
 * 该块最近一行的行尾，而不是下一块行首。这里按 Y 把空隙判给上方块，
 * 再把光标钉到该块行尾。点在字上仍交给默认，保证点哪里落到哪个字。
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

export type BlockHitRect = { top: number; bottom: number };

/**
 * Notion：点在块盒子里用最内层块；点在两块之间的空隙归上方块。
 * `blocks` 按 DOM 顺序（父先于子），含住时取最后一个即最内层。
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
  } catch {
    return end;
  }
  return end;
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

function isTextBlockContent(el: HTMLElement): boolean {
  return Boolean(
    el.querySelector(":scope > .bn-inline-content") ||
      el.querySelector(
        ":scope > :is(h1, h2, h3, h4, h5, h6) .bn-inline-content",
      ) ||
      el.querySelector(":scope > blockquote .bn-inline-content") ||
      el.querySelector(":scope > pre") ||
      el.getAttribute("data-content-type") === "codeBlock",
  );
}

function collectInlineBlockContents(editorDom: Element): HTMLElement[] {
  return [...editorDom.querySelectorAll<HTMLElement>(".bn-block-content")].filter(
    isTextBlockContent,
  );
}

function textblockRangeFromContentEl(
  view: EditorView,
  contentEl: HTMLElement,
): { start: number; end: number } | null {
  const inline =
    contentEl.querySelector(":scope > .bn-inline-content") ??
    contentEl.querySelector(
      ":scope > :is(h1, h2, h3, h4, h5, h6) .bn-inline-content",
    ) ??
    contentEl.querySelector(":scope > blockquote .bn-inline-content") ??
    contentEl.querySelector(":scope > pre") ??
    contentEl;
  try {
    const pos = view.posAtDOM(inline, 0);
    return textblockRangeAt(view, pos);
  } catch {
    return null;
  }
}

export function resolveTrailingBlankClickPos(
  view: EditorView,
  event: MouseEvent,
): number | null {
  const contents = collectInlineBlockContents(view.dom);
  if (contents.length === 0) return null;

  const index = pickOwningBlockIndex(
    contents.map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }),
    event.clientY,
  );
  if (index == null) return null;

  const range = textblockRangeFromContentEl(view, contents[index]);
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
        handleClick: handleTrailingBlankClick,
      },
    }),
  ],
});
