import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { isInsideCode } from "./inlineCodeWordBoundary";
import {
  inlineCodeEdgeAt,
  shouldKeepInlineCodeDomCaret,
  type InlineCodeEdge,
} from "./inlineCodeCaretModel";

/** prosemirror-view 未导出 domObserver 类型，但版本已在 package.json 里锁死。 */
type EditorViewInternals = EditorView & {
  domObserver: { setCurSelection: () => void };
};

const CODE_SELECTOR = "code[data-goose-inline-code]";
const CONTENT_SELECTOR = "[data-goose-inline-code-content]";

export function inlineCodeElementAt(
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

export function queueCaretSync(view: EditorView): void {
  syncCaretSide(view);
  requestAnimationFrame(() => {
    if (view.dom.isConnected) syncCaretSide(view);
  });
}

/** 把浏览器光标钉到 boundary span 的正确一侧；两侧映射回的文档位置相同。 */
export function syncCaretSide(view: EditorView): void {
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
    else {
      // ponytail: 普通行内代码钉在末尾文本节点；复杂嵌套内容仍回退到内容盒边界。
      const last = content.lastChild;
      if (last?.nodeType === Node.TEXT_NODE)
        range.setStart(last, last.textContent?.length ?? 0);
      else range.setStartAfter(content);
    }
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
