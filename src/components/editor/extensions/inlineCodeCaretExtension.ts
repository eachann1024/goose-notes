import { createExtension } from "@blocknote/core";
import type { MarkType, ResolvedPos } from "@tiptap/pm/model";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  isInsideCode,
  resolveWordDelete,
  storedMarksForCodeEdge,
  towardInlineCode,
  wordDeleteRange,
  wordMoveTarget,
  type WordAxis,
} from "@/components/editor/extensions/inlineCodeWordBoundary";

/**
 * 行内代码的光标进出。
 *
 * 「盒内 / 盒外」不是插件自己的状态，而是直接读 ProseMirror 的
 * storedMarks（缺省时读 `$pos.marks()`）：含 code 即盒内。code mark
 * inclusive: false，右边界缺省在盒外、左边界缺省在盒外；盒内两端由
 * storedMarks 带上 code。盒外不写 storedMarks，避免 compositionstart
 * 把 truthy storedMarks 当成 markCursor 重启、打断拼音。
 */

export type InlineCodeEdge = "start" | "end";

export type InlineCodeEdgeArrowAction =
  | "step-inward"
  | "enter"
  | "leave"
  | null;

/** prosemirror-view 未导出 domObserver 类型，但版本已在 package.json 里锁死。 */
type EditorViewInternals = EditorView & {
  domObserver: { setCurSelection: () => void };
};

const CODE_SELECTOR = "code[data-goose-inline-code]";
const CONTENT_SELECTOR = "[data-goose-inline-code-content]";

function segmentGraphemes(text: string): string[] {
  const Segmenter = (
    Intl as typeof Intl & {
      Segmenter?: new (
        locales?: string | string[],
        options?: { granularity: "grapheme" },
      ) => { segment: (value: string) => Iterable<{ segment: string }> };
    }
  ).Segmenter;

  if (!Segmenter) {
    // 旧版 Electron Chromium 没有 Intl.Segmenter 时，至少正确处理代理对。
    return Array.from(text);
  }
  const values: string[] = [];
  for (const value of new Segmenter(undefined, {
    granularity: "grapheme",
  }).segment(text)) {
    values.push(value.segment);
  }
  return values;
}

/** 文本靠 edge 一侧的首个字素占多少个 UTF-16 码元。 */
export function edgeGraphemeLength(
  text: string,
  edge: InlineCodeEdge,
): number {
  if (!text) return 0;
  const graphemes = segmentGraphemes(text);
  const grapheme =
    edge === "start" ? graphemes[0] : graphemes[graphemes.length - 1];
  return grapheme?.length ?? 0;
}

/** 该文档位置是否正好压在某段行内代码的左右边界上。 */
export function inlineCodeEdgeAt(
  $pos: ResolvedPos,
  codeType: MarkType,
): InlineCodeEdge | null {
  const before = $pos.nodeBefore;
  const after = $pos.nodeAfter;
  const beforeCode = !!before?.isText && !!codeType.isInSet(before.marks);
  const afterCode = !!after?.isText && !!codeType.isInSet(after.marks);
  if (afterCode && !beforeCode) return "start";
  if (beforeCode && !afterCode) return "end";
  return null;
}

/**
 * 光标停在边界上时方向键的语义：
 * 朝代码内部按 → 盒外先进盒内、盒内再走一个字素；朝外按 → 盒内先出盒、盒外交给浏览器。
 */
export function inlineCodeEdgeArrowAction(
  edge: InlineCodeEdge,
  inside: boolean,
  direction: "left" | "right",
): InlineCodeEdgeArrowAction {
  const inward = edge === "start" ? "right" : "left";
  if (direction === inward) return inside ? "step-inward" : "enter";
  return inside ? "leave" : null;
}

/**
 * 边界上的 DOM 选区是否已经落在「看得见光标」的那一侧。
 * 落在零宽 boundary 节点里、或盒内/盒外和 storedMarks 不一致时，必须重钉。
 */
export function shouldKeepInlineCodeDomCaret(options: {
  wantInside: boolean;
  contentContainsAnchor: boolean;
  anchorInBoundary: boolean;
  atContentInnerEdge: boolean;
  atCodeOuterEdge: boolean;
  codeContainsAnchor: boolean;
}): boolean {
  if (options.anchorInBoundary) return false;
  if (options.wantInside) {
    return options.contentContainsAnchor || options.atContentInnerEdge;
  }
  if (options.contentContainsAnchor) return false;
  if (options.codeContainsAnchor && !options.atCodeOuterEdge) return false;
  return true;
}

function moveCaret(
  view: EditorView,
  target: number,
  codeType: MarkType,
  inside: boolean,
): boolean {
  const { state } = view;
  const $target = state.doc.resolve(target);
  const edge = inlineCodeEdgeAt($target, codeType);
  view.dispatch(
    state.tr
      .setSelection(TextSelection.create(state.doc, target))
      .setStoredMarks(
        edge ? storedMarksForCodeEdge($target, codeType, inside) : null,
      ),
  );
  return true;
}

function stepTarget(
  $pos: ResolvedPos,
  from: number,
  direction: "left" | "right",
): number | null {
  const text =
    direction === "right" ? ($pos.nodeAfter?.text ?? "") : ($pos.nodeBefore?.text ?? "");
  const length = edgeGraphemeLength(text, direction === "right" ? "start" : "end");
  if (!length) return null;
  return direction === "right" ? from + length : from - length;
}

function handleArrow(view: EditorView, direction: "left" | "right"): boolean {
  const { state } = view;
  const codeType = state.schema.marks.code;
  if (!codeType) return false;

  const selection = state.selection;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const $pos = selection.$from;
  const edge = inlineCodeEdgeAt($pos, codeType);

  if (!edge) {
    // 不在边界：浏览器只会把光标停在盒外，落点是左边界时要改成盒内。
    const target = stepTarget($pos, selection.from, direction);
    if (target === null) return false;
    if (inlineCodeEdgeAt(state.doc.resolve(target), codeType) !== "start") {
      return false;
    }
    return moveCaret(view, target, codeType, true);
  }

  const action = inlineCodeEdgeArrowAction(
    edge,
    isInsideCode(state, $pos, codeType),
    direction,
  );
  if (!action) return false;

  if (action === "step-inward") {
    const target = stepTarget($pos, selection.from, direction);
    if (target === null) return false;
    return moveCaret(view, target, codeType, true);
  }

  view.dispatch(
    state.tr.setStoredMarks(
      storedMarksForCodeEdge($pos, codeType, action === "enter"),
    ),
  );
  return true;
}

/**
 * 边界上的删除必须自己做：浏览器会把紧邻的零宽 boundary span 当成要删的东西，
 * 删完文档没变化，ProseMirror 也就不会重绘补回那个 span。
 */
function handleDelete(
  view: EditorView,
  direction: "backward" | "forward",
): boolean {
  const { state } = view;
  const codeType = state.schema.marks.code;
  if (!codeType) return false;

  const selection = state.selection;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const $pos = selection.$from;
  if (!inlineCodeEdgeAt($pos, codeType)) return false;

  const node = direction === "backward" ? $pos.nodeBefore : $pos.nodeAfter;
  if (!node?.isText) return false;
  const length = edgeGraphemeLength(
    node.text ?? "",
    direction === "backward" ? "end" : "start",
  );
  if (!length) return false;

  const inside = isInsideCode(state, $pos, codeType);
  const tr =
    direction === "backward"
      ? state.tr.delete(selection.from - length, selection.from)
      : state.tr.delete(selection.from, selection.from + length);

  const $after = tr.selection.$from;
  if (inlineCodeEdgeAt($after, codeType)) {
    tr.setStoredMarks(storedMarksForCodeEdge($after, codeType, inside));
  }
  view.dispatch(tr.scrollIntoView());
  queueCaretSync(view);
  return true;
}

let lastWordEditAt = 0;

function sameStroke(): boolean {
  const now = Date.now();
  if (now - lastWordEditAt < 50) return true;
  lastWordEditAt = now;
  return false;
}

function handleWordDelete(
  view: EditorView,
  direction: WordAxis,
): boolean {
  const { state } = view;
  const codeType = state.schema.marks.code;
  if (!codeType) return false;

  const selection = state.selection;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const $pos = selection.$from;
  const inside = isInsideCode(state, $pos, codeType);
  const plan = resolveWordDelete(
    $pos,
    direction,
    codeType,
    inside,
    inlineCodeEdgeAt($pos, codeType),
  );
  if (!plan) return false;
  if (sameStroke()) return true;
  if (plan === "swallow") {
    queueCaretSync(view);
    return true;
  }

  const tr = state.tr.delete(plan.from, plan.to);
  const $after = tr.selection.$from;
  const edge = inlineCodeEdgeAt($after, codeType);
  if (edge) {
    tr.setStoredMarks(storedMarksForCodeEdge($after, codeType, inside));
  }
  view.dispatch(tr.scrollIntoView());
  queueCaretSync(view);
  return true;
}

function handleWordMove(
  view: EditorView,
  direction: WordAxis,
  extend: boolean,
): boolean {
  const { state } = view;
  const codeType = state.schema.marks.code;
  if (!codeType) return false;

  const selection = state.selection;
  if (!(selection instanceof TextSelection)) return false;
  if (!selection.empty && !extend) return false;

  const $pos = selection.$head;
  const inside = isInsideCode(state, $pos, codeType);
  const edgeHere = inlineCodeEdgeAt($pos, codeType);
  const clamped = wordDeleteRange($pos, direction, codeType, inside, true);
  const raw = wordDeleteRange($pos, direction, codeType, inside, false);
  const crosses =
    !!raw &&
    !!clamped &&
    (raw.from !== clamped.from || raw.to !== clamped.to);
  const target = wordMoveTarget($pos, direction, codeType, inside);

  if (target !== null && (inside || edgeHere || crosses)) {
    const next = extend
      ? TextSelection.create(state.doc, selection.anchor, target)
      : TextSelection.create(state.doc, target);
    const $target = state.doc.resolve(target);
    const edge = inlineCodeEdgeAt($target, codeType);
    view.dispatch(
      state.tr
        .setSelection(next)
        .setStoredMarks(
          edge ? storedMarksForCodeEdge($target, codeType, inside) : null,
        ),
    );
    return true;
  }

  if (!edgeHere) return false;
  if (towardInlineCode(edgeHere, direction)) {
    if (inside) return false;
    view.dispatch(
      state.tr.setStoredMarks(storedMarksForCodeEdge($pos, codeType, true)),
    );
    return true;
  }
  if (inside) {
    view.dispatch(
      state.tr.setStoredMarks(storedMarksForCodeEdge($pos, codeType, false)),
    );
    return true;
  }
  return false;
}

function inlineCodeElementAt(
  view: EditorView,
  pos: number,
  edge: InlineCodeEdge,
): HTMLElement | null {
  let dom: { node: Node; offset: number };
  try {
    dom = view.domAtPos(pos, edge === "start" ? 1 : -1);
  } catch {
    return null;
  }

  let candidate: Node | null = dom.node;
  if (candidate.nodeType === Node.ELEMENT_NODE) {
    candidate =
      candidate.childNodes[edge === "start" ? dom.offset : dom.offset - 1] ??
      candidate;
  }
  const element =
    candidate.nodeType === Node.ELEMENT_NODE
      ? (candidate as HTMLElement)
      : candidate.parentElement;
  return element?.closest<HTMLElement>(CODE_SELECTOR) ?? null;
}

function collapsedRangeAt(
  doc: Document,
  place: (range: Range) => void,
): { node: Node; offset: number } {
  const range = doc.createRange();
  place(range);
  range.collapse(true);
  return { node: range.startContainer, offset: range.startOffset };
}

function selectionMatchesPoint(
  selection: Selection,
  point: { node: Node; offset: number },
): boolean {
  return (
    selection.isCollapsed &&
    selection.anchorNode === point.node &&
    selection.anchorOffset === point.offset
  );
}

function isBoundaryAnchor(node: Node | null): boolean {
  if (!node) return false;
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return !!el?.closest("[data-goose-inline-code-boundary]");
}

function queueCaretSync(view: EditorView): void {
  syncCaretSide(view);
  requestAnimationFrame(() => {
    if (view.dom.isConnected) syncCaretSide(view);
  });
}

/** 把浏览器光标钉到 boundary span 的正确一侧；两侧映射回的文档位置相同。 */
function syncCaretSide(view: EditorView): void {
  const { state } = view;
  const codeType = state.schema.marks.code;
  if (!codeType || view.composing || !view.hasFocus()) return;

  const selection = state.selection;
  if (!(selection instanceof TextSelection) || !selection.empty) return;

  const $pos = selection.$from;
  const edge = inlineCodeEdgeAt($pos, codeType);
  if (!edge) return;

  const code = inlineCodeElementAt(view, selection.from, edge);
  if (!code) return;

  const content = code.querySelector(CONTENT_SELECTOR);
  if (!content) return;

  const doc = view.dom.ownerDocument;
  const domSelection = doc.getSelection();
  if (!domSelection?.isCollapsed || !domSelection.anchorNode) return;

  const wantInside = isInsideCode(state, $pos, codeType);
  const innerPoint = collapsedRangeAt(doc, (range) => {
    if (edge === "start") range.setStartBefore(content);
    else range.setStartAfter(content);
  });
  const outerPoint = collapsedRangeAt(doc, (range) => {
    const sibling = edge === "start" ? code.previousSibling : code.nextSibling;
    if (sibling?.nodeType === Node.TEXT_NODE) {
      range.setStart(
        sibling,
        edge === "start" ? (sibling.nodeValue?.length ?? 0) : 0,
      );
    } else if (edge === "start") {
      range.setStartBefore(code);
    } else {
      range.setStartAfter(code);
    }
  });

  if (
    shouldKeepInlineCodeDomCaret({
      wantInside,
      contentContainsAnchor: content.contains(domSelection.anchorNode),
      anchorInBoundary: isBoundaryAnchor(domSelection.anchorNode),
      atContentInnerEdge: selectionMatchesPoint(domSelection, innerPoint),
      atCodeOuterEdge: selectionMatchesPoint(domSelection, outerPoint),
      codeContainsAnchor: code.contains(domSelection.anchorNode),
    })
  ) {
    return;
  }

  const range = doc.createRange();
  const point = wantInside ? innerPoint : outerPoint;
  range.setStart(point.node, point.offset);
  range.collapse(true);
  domSelection.removeAllRanges();
  domSelection.addRange(range);
  // 不同步 DOMObserver 的话，它会把这次改动当成用户选区变化，
  // 在 flush 里用 selectionToDOM 把光标画回 ProseMirror 的缺省一侧。
  (view as EditorViewInternals).domObserver.setCurSelection();
}

function inlineCodeCaretPlugin() {
  return new Plugin({
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        if (event.isComposing || view.composing) return false;
        // Cmd+Backspace 等整行删除保持浏览器 / PM 默认，可连同行内代码一起删。
        if (event.metaKey) return false;

        if (event.altKey && !event.ctrlKey) {
          if (event.key === "Backspace" || event.keyCode === 8) {
            return handleWordDelete(view, "backward");
          }
          if (event.key === "Delete" || event.keyCode === 46) {
            return handleWordDelete(view, "forward");
          }
          if (event.key === "ArrowLeft" || event.keyCode === 37) {
            return handleWordMove(view, "backward", event.shiftKey);
          }
          if (event.key === "ArrowRight" || event.keyCode === 39) {
            return handleWordMove(view, "forward", event.shiftKey);
          }
        }

        if (event.shiftKey || event.ctrlKey || event.altKey) return false;
        if (event.key === "ArrowLeft" || event.keyCode === 37) {
          return handleArrow(view, "left");
        }
        if (event.key === "ArrowRight" || event.keyCode === 39) {
          return handleArrow(view, "right");
        }
        if (event.key === "Backspace" || event.keyCode === 8) {
          return handleDelete(view, "backward");
        }
        if (event.key === "Delete" || event.keyCode === 46) {
          return handleDelete(view, "forward");
        }
        return false;
      },
      handleDOMEvents: {
        beforeinput(view: EditorView, event: Event): boolean {
          if (view.composing) return false;
          const input = event as InputEvent;
          if (input.inputType === "deleteWordBackward") {
            if (!handleWordDelete(view, "backward")) return false;
            event.preventDefault();
            return true;
          }
          if (input.inputType === "deleteWordForward") {
            if (!handleWordDelete(view, "forward")) return false;
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
      /** 点在盒子矩形内落盒内、点在左右留白里落盒外。 */
      handleClick(view: EditorView, pos: number, event: MouseEvent): boolean {
        if (event.button !== 0) return false;

        const { state } = view;
        const codeType = state.schema.marks.code;
        if (!codeType) return false;

        const $pos = state.doc.resolve(pos);
        const edge = inlineCodeEdgeAt($pos, codeType);
        if (!edge) return false;

        const code = inlineCodeElementAt(view, pos, edge);
        if (!code) return false;

        const rect = code.getBoundingClientRect();
        const inside =
          event.clientX > rect.left && event.clientX < rect.right;
        view.dispatch(
          state.tr
            .setSelection(TextSelection.create(state.doc, pos))
            .setStoredMarks(storedMarksForCodeEdge($pos, codeType, inside)),
        );
        return true;
      },
    },
    view() {
      return { update: syncCaretSide };
    },
  });
}

export const gooseInlineCodeCaretExtension = createExtension({
  key: "goose-inline-code-caret",
  prosemirrorPlugins: [inlineCodeCaretPlugin()],
});
