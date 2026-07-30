import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export type InlineCodeBoundaryEdge = "start" | "end";
export type InlineCodeBoundaryPhase = "inside" | "outside";

export type InlineCodeBoundaryState = {
  edge: InlineCodeBoundaryEdge;
  phase: InlineCodeBoundaryPhase;
  pos: number;
} | null;

export type InlineCodeBoundaryArrowAction =
  | "advance"
  | "enter"
  | "exit"
  | "to-inside"
  | "to-outside";

type InlineCodeCaret = {
  code: HTMLElement;
  textAfterCaret: string;
  textBeforeCaret: string;
  textNode: Text;
};

type VisualCaretHandle = {
  caret: InlineCodeCaret;
  code: HTMLElement;
  destroy: () => void;
  edge: InlineCodeBoundaryEdge;
  phase: InlineCodeBoundaryPhase;
};

const PLUGIN_KEY = new PluginKey<InlineCodeBoundaryState>(
  "goose-inline-code-boundary-navigation",
);

function getParentElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as HTMLElement)
    : node.parentElement;
}

function firstTextNode(element: HTMLElement): Text | null {
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
  );
  return walker.nextNode() as Text | null;
}

function inlineCodeCaretAtDocumentPosition(
  view: EditorView,
  pos: number,
  textBeforeCaret: string,
): InlineCodeCaret | null {
  for (const bias of [-1, 1] as const) {
    const domPosition = view.domAtPos(pos, bias);
    const candidates = [
      domPosition.node,
      domPosition.node.childNodes[domPosition.offset] ?? null,
      domPosition.node.childNodes[domPosition.offset - 1] ?? null,
    ];

    for (const node of candidates) {
      const parent = getParentElement(node);
      const code = parent?.closest("code");
      if (!(code instanceof HTMLElement)) continue;
      if (!view.dom.contains(code)) continue;
      if (!code.closest(".bn-inline-content") || code.closest("pre")) continue;

      const textNode = firstTextNode(code);
      if (textNode) {
        return {
          code,
          textAfterCaret: code.textContent?.slice(textBeforeCaret.length) ?? "",
          textBeforeCaret,
          textNode,
        };
      }
    }
  }

  return null;
}

function segmentGraphemes(text: string): string[] {
  if (!text) return [];

  const Segmenter = (
    Intl as typeof Intl & {
      Segmenter?: new (
        locales?: string | string[],
        options?: { granularity: "grapheme" },
      ) => {
        segment: (value: string) => Iterable<{ segment: string }>;
      };
    }
  ).Segmenter;

  if (Segmenter) {
    const segments = new Segmenter(undefined, {
      granularity: "grapheme",
    }).segment(text);
    const values: string[] = [];
    for (const value of segments) values.push(value.segment);
    return values;
  }

  // 旧版 uTools Chromium 没有 Intl.Segmenter 时，至少正确处理代理对字符。
  return Array.from(text);
}

function hasGraphemeCount(text: string, expectedCount: number): boolean {
  if (expectedCount < 1) return false;
  return segmentGraphemes(text).length === expectedCount;
}

export function edgeGraphemeLength(
  text: string,
  edge: InlineCodeBoundaryEdge,
): number {
  const graphemes = segmentGraphemes(text);
  if (graphemes.length === 0) return 0;
  const grapheme =
    edge === "start" ? graphemes[0] : graphemes[graphemes.length - 1];
  return grapheme?.length ?? 0;
}

export function isSingleGrapheme(text: string): boolean {
  return hasGraphemeCount(text, 1);
}

export function isTwoGraphemes(text: string): boolean {
  return hasGraphemeCount(text, 2);
}

export function resolveHeldInlineCodeBoundary(
  heldBoundary: InlineCodeBoundaryState,
  visualEdge: InlineCodeBoundaryEdge | null,
  visualPhase: InlineCodeBoundaryPhase | null,
  domEdge: InlineCodeBoundaryEdge | null,
  selectionPos: number,
): Exclude<InlineCodeBoundaryState, null> | null {
  if (!visualEdge || !visualPhase) return null;

  if (
    heldBoundary?.edge === visualEdge &&
    heldBoundary.phase === visualPhase &&
    (heldBoundary.pos === selectionPos ||
      (heldBoundary.phase === "inside" && domEdge === heldBoundary.edge))
  ) {
    return heldBoundary;
  }

  // uTools 旧 Chromium 可能把 code 内末端重新映射到相邻的
  // ProseMirror 位置，导致 edge state 被清空。真实 DOM 光标仍在
  // 同一视觉边界时，恢复该状态以完成第二次方向键。
  if (!heldBoundary && domEdge === visualEdge) {
    return { edge: visualEdge, phase: "inside", pos: selectionPos };
  }

  return null;
}

export function heldInlineCodeBoundaryArrowAction(
  edge: InlineCodeBoundaryEdge,
  phase: InlineCodeBoundaryPhase,
  direction: "left" | "right",
): InlineCodeBoundaryArrowAction {
  if (edge === "end" && phase === "outside") {
    return direction === "right" ? "advance" : "to-inside";
  }
  if (edge === "end" && direction === "right") return "to-outside";
  return edge === "start" && direction === "left" ? "exit" : "enter";
}

export function adjacentInlineCodeTextIndex(
  codeIndexes: number[],
  textNodeCount: number,
  direction: "after" | "before",
): number | null {
  if (codeIndexes.length === 0) return null;
  const index = direction === "after"
    ? codeIndexes[codeIndexes.length - 1] + 1
    : codeIndexes[0] - 1;
  return index >= 0 && index < textNodeCount ? index : null;
}

/**
 * 读取浏览器当前的真实 DOM 光标位置。
 *
 * ProseMirror 会把「code 内首字符前」和「code 外左侧」映射到同一个文档位置，
 * 因此这里必须保留 DOM 侧信息，不能只看 TextSelection.from。
 */
export function getInlineCodeCaret(
  selection: Selection | null,
  editorDom: HTMLElement,
): InlineCodeCaret | null {
  if (
    !selection ||
    !selection.isCollapsed ||
    !selection.anchorNode ||
    selection.anchorNode !== selection.focusNode ||
    selection.anchorOffset !== selection.focusOffset
  ) {
    return null;
  }

  const parent = getParentElement(selection.anchorNode);
  const code = parent?.closest("code");
  if (!(code instanceof HTMLElement)) return null;
  if (!editorDom.contains(code)) return null;
  if (!code.closest(".bn-inline-content") || code.closest("pre")) return null;

  const textNode = firstTextNode(code);
  if (!textNode) return null;

  const range = code.ownerDocument.createRange();
  range.setStart(code, 0);
  try {
    range.setEnd(selection.anchorNode, selection.anchorOffset);
  } catch {
    return null;
  }

  const afterRange = code.ownerDocument.createRange();
  try {
    afterRange.setStart(selection.anchorNode, selection.anchorOffset);
    afterRange.setEnd(code, code.childNodes.length);
  } catch {
    return null;
  }

  return {
    code,
    textAfterCaret: afterRange.toString(),
    textBeforeCaret: range.toString(),
    textNode,
  };
}

function setDomCaretAtCodeStart(view: EditorView, caret: InlineCodeCaret) {
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection || !caret.code.isConnected) return;

  const range = view.dom.ownerDocument.createRange();
  const contentContainer = Array.from(caret.code.childNodes).find(
    (node): node is HTMLElement =>
      node instanceof HTMLElement &&
      node.hasAttribute("data-goose-inline-code-content"),
  );

  // 光标放在 boundary 与内容容器之间，而不是首文本节点的
  // offset=0。后者在 uTools 旧 Chromium 会被画到 code 外侧。
  if (contentContainer) {
    range.setStart(
      caret.code,
      Array.prototype.indexOf.call(caret.code.childNodes, contentContainer),
    );
  } else {
    range.setStart(caret.textNode, 0);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setDomCaretBeforeCode(view: EditorView, code: HTMLElement) {
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection || !code.isConnected) return;

  const range = view.dom.ownerDocument.createRange();
  const textNode = adjacentEditableTextNode(code, "before");
  if (textNode) range.setStart(textNode, textNode.data.length);
  else range.setStartBefore(code);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setDomCaretAtCodeEnd(view: EditorView, caret: InlineCodeCaret) {
  setDomCaretAtTextOffset(view, caret, caret.textNode.data.length);
}

function setDomCaretAtTextOffset(
  view: EditorView,
  caret: InlineCodeCaret,
  offset: number,
) {
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection || !caret.code.isConnected) return;

  const range = view.dom.ownerDocument.createRange();
  range.setStart(caret.textNode, offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setDomCaretAfterCode(view: EditorView, code: HTMLElement) {
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection || !code.isConnected) return;

  const range = view.dom.ownerDocument.createRange();
  const textNode = adjacentEditableTextNode(code, "after");
  if (textNode) range.setStart(textNode, 0);
  else range.setStartAfter(code);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function adjacentEditableTextNode(
  code: HTMLElement,
  direction: "after" | "before",
): Text | null {
  const inlineContent = code.closest(".bn-inline-content");
  if (!(inlineContent instanceof HTMLElement)) return null;

  const textNodes: Text[] = [];
  const walker = code.ownerDocument.createTreeWalker(
    inlineContent,
    NodeFilter.SHOW_TEXT,
  );
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (
      textNode.data.length > 0 &&
      !parent?.closest('[contenteditable="false"]')
    ) {
      textNodes.push(textNode);
    }
    node = walker.nextNode();
  }

  const codeIndexes = textNodes
    .map((textNode, index) => (code.contains(textNode) ? index : -1))
    .filter((index) => index >= 0);
  if (codeIndexes.length === 0) return null;

  const index = adjacentInlineCodeTextIndex(
    codeIndexes,
    textNodes.length,
    direction,
  );
  return index === null ? null : textNodes[index];
}

function edgeCharacterRect(
  textNode: Text,
  edge: InlineCodeBoundaryEdge,
): { height: number; left: number; top: number } | null {
  if (!textNode.data) return null;

  const range = textNode.ownerDocument.createRange();
  if (edge === "start") {
    range.setStart(textNode, 0);
    range.setEnd(textNode, Array.from(textNode.data)[0]?.length ?? 1);
  } else {
    const characters = Array.from(textNode.data);
    const lastCharacterLength =
      characters[characters.length - 1]?.length ?? 1;
    range.setStart(textNode, textNode.data.length - lastCharacterLength);
    range.setEnd(textNode, textNode.data.length);
  }
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (rect.height <= 0) return null;

  return {
    height: rect.height,
    left: edge === "start" ? rect.left : rect.right,
    top: rect.top,
  };
}

/**
 * 浏览器会把同一个 ProseMirror 文档位置画在 code 左侧，无法仅靠 Selection
 * 区分「首字符前」和「code 外」。边界停留期间用首字符的真实矩形绘制可见光标，
 * 原生光标保持透明；下一次左移后立即恢复原生光标。
 */
function showVisualCaret(
  view: EditorView,
  caret: InlineCodeCaret,
  edge: InlineCodeBoundaryEdge,
  phase: InlineCodeBoundaryPhase = "inside",
): VisualCaretHandle {
  const doc = view.dom.ownerDocument;
  const win = doc.defaultView;
  const element = doc.createElement("span");
  element.className = "goose-inline-code-visual-caret";
  element.setAttribute("aria-hidden", "true");
  doc.body.appendChild(element);
  caret.code.setAttribute("data-goose-inline-code-caret-active", "");
  view.dom.setAttribute("data-goose-inline-code-caret-active", "");

  let frameId: number | null = null;
  let destroyed = false;

  const update = () => {
    if (destroyed || !win) return;

    const rect = edgeCharacterRect(caret.textNode, edge);
    const isVisible =
      rect !== null &&
      caret.code.isConnected &&
      doc.hasFocus() &&
      view.hasFocus();

    element.hidden = !isVisible;
    if (rect && isVisible) {
      const codeRect = caret.code.getBoundingClientRect();
      const left = phase === "outside"
        ? edge === "end" ? codeRect.right : codeRect.left
        : rect.left;
      element.style.left = `${left}px`;
      element.style.top = `${rect.top}px`;
      element.style.height = `${rect.height}px`;
      element.style.backgroundColor = win.getComputedStyle(view.dom).color;
    }

    frameId = win.requestAnimationFrame(update);
  };

  update();

  return {
    caret,
    code: caret.code,
    edge,
    phase,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frameId !== null && win) win.cancelAnimationFrame(frameId);
      caret.code.removeAttribute("data-goose-inline-code-caret-active");
      view.dom.removeAttribute("data-goose-inline-code-caret-active");
      element.remove();
    },
  };
}

function inlineCodeBoundaryNavigationPlugin() {
  let visualCaret: VisualCaretHandle | null = null;

  const clearVisualCaret = () => {
    visualCaret?.destroy();
    visualCaret = null;
  };

  const handleHeldBoundaryKeyDown = (
    view: EditorView,
    event: KeyboardEvent,
  ): boolean => {
    const isLeftArrow = event.key === "ArrowLeft" || event.keyCode === 37;
    const isRightArrow = event.key === "ArrowRight" || event.keyCode === 39;
    if (
      (!isLeftArrow && !isRightArrow) ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.isComposing ||
      view.composing
    ) {
      return false;
    }

    const { selection } = view.state;
    if (!(selection instanceof TextSelection) || !selection.empty) return false;

    if (!visualCaret?.code.isConnected) {
      return false;
    }

    const domCaret = getInlineCodeCaret(
      view.dom.ownerDocument.getSelection(),
      view.dom,
    );
    let domEdge: InlineCodeBoundaryEdge | null = null;
    if (domCaret?.code === visualCaret.code) {
      if (domCaret.textBeforeCaret.length === 0) domEdge = "start";
      else if (domCaret.textAfterCaret.length === 0) domEdge = "end";
    }

    const heldBoundary = resolveHeldInlineCodeBoundary(
      PLUGIN_KEY.getState(view.state) ?? null,
      visualCaret.edge,
      visualCaret.phase,
      domEdge,
      selection.from,
    );
    if (!heldBoundary) return false;

    const direction = isLeftArrow ? "left" : "right";
    const action = heldInlineCodeBoundaryArrowAction(
      heldBoundary.edge,
      heldBoundary.phase,
      direction,
    );
    const code = visualCaret.code;
    const caret = visualCaret.caret;
    const codeMark = view.state.schema.marks.code;

    if (action === "to-outside") {
      event.preventDefault();
      const tr = view.state.tr
        .setSelection(TextSelection.create(view.state.doc, heldBoundary.pos))
        .setStoredMarks([])
        .setMeta(PLUGIN_KEY, {
          edge: "end",
          phase: "outside",
          pos: heldBoundary.pos,
        })
        .setMeta("addToHistory", false);
      view.dispatch(tr);
      setDomCaretAfterCode(view, code);
      clearVisualCaret();
      visualCaret = showVisualCaret(view, caret, "end", "outside");
      return true;
    }

    if (action === "to-inside") {
      if (!codeMark) return false;
      event.preventDefault();
      const tr = view.state.tr
        .setSelection(TextSelection.create(view.state.doc, heldBoundary.pos))
        .setStoredMarks([codeMark.create()])
        .setMeta(PLUGIN_KEY, {
          edge: "end",
          phase: "inside",
          pos: heldBoundary.pos,
        })
        .setMeta("addToHistory", false);
      view.dispatch(tr);
      setDomCaretAtCodeEnd(view, caret);
      clearVisualCaret();
      visualCaret = showVisualCaret(view, caret, "end", "inside");
      return true;
    }

    if (action === "advance") {
      event.preventDefault();
      const trailingText = adjacentEditableTextNode(code, "after");
      const firstLength = edgeGraphemeLength(trailingText?.data ?? "", "start");
      const targetPos = heldBoundary.pos + firstLength;
      const tr = view.state.tr
        .setSelection(TextSelection.create(view.state.doc, targetPos))
        .setStoredMarks([])
        .setMeta(PLUGIN_KEY, null)
        .setMeta("addToHistory", false);
      view.dispatch(tr);
      if (trailingText && firstLength > 0) {
        const domSelection = view.dom.ownerDocument.getSelection();
        if (domSelection) {
          const range = view.dom.ownerDocument.createRange();
          range.setStart(trailingText, firstLength);
          range.collapse(true);
          domSelection.removeAllRanges();
          domSelection.addRange(range);
        }
      } else {
        setDomCaretAfterCode(view, code);
      }
      return true;
    }

    if (action === "exit") {
      event.preventDefault();
      const tr = view.state.tr
        .setSelection(
          TextSelection.create(view.state.doc, heldBoundary.pos),
        )
        .setStoredMarks([])
        .setMeta(PLUGIN_KEY, null)
        .setMeta("addToHistory", false);
      view.dispatch(tr);
      setDomCaretBeforeCode(view, code);
      return true;
    }

    const edgeLength = edgeGraphemeLength(
      caret.textNode.data,
      heldBoundary.edge,
    );
    if (!codeMark || edgeLength === 0) return false;

    event.preventDefault();
    const targetPos =
      heldBoundary.edge === "start"
        ? heldBoundary.pos + edgeLength
        : heldBoundary.pos - edgeLength;
    const textOffset =
      heldBoundary.edge === "start"
        ? edgeLength
        : caret.textNode.data.length - edgeLength;
    const tr = view.state.tr
      .setSelection(TextSelection.create(view.state.doc, targetPos))
      .setStoredMarks([codeMark.create()])
      .setMeta(PLUGIN_KEY, null)
      .setMeta("addToHistory", false);
    view.dispatch(tr);
    setDomCaretAtTextOffset(view, caret, textOffset);
    return true;
  };

  const plugin = new Plugin<InlineCodeBoundaryState>({
    key: PLUGIN_KEY,
    state: {
      init: () => null,
      apply(tr, value) {
        const meta = tr.getMeta(PLUGIN_KEY);
        if (meta !== undefined) return meta as InlineCodeBoundaryState;
        if (!value) return null;
        if (tr.docChanged || tr.selection.from !== value.pos) {
          return null;
        }
        return value;
      },
    },
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        if (handleHeldBoundaryKeyDown(view, event)) return true;

        const isLeftArrow = event.key === "ArrowLeft" || event.keyCode === 37;
        const isRightArrow =
          event.key === "ArrowRight" || event.keyCode === 39;
        if (
          (!isLeftArrow && !isRightArrow) ||
          event.shiftKey ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.isComposing ||
          view.composing
        ) {
          return false;
        }

        const { selection } = view.state;
        if (!(selection instanceof TextSelection) || !selection.empty) {
          return false;
        }

        const heldBoundary = PLUGIN_KEY.getState(view.state);

        const domSelection = view.dom.ownerDocument.getSelection();
        const domCaret = getInlineCodeCaret(domSelection, view.dom);

        if (
          isLeftArrow &&
          heldBoundary?.pos === selection.from &&
          domCaret?.textBeforeCaret.length === 0
        ) {
          event.preventDefault();
          const tr = view.state.tr
            .setStoredMarks([])
            .setMeta(PLUGIN_KEY, null)
            .setMeta("addToHistory", false);
          view.dispatch(tr);
          setDomCaretBeforeCode(view, domCaret.code);
          return true;
        }

        const codeMark = view.state.schema.marks.code;
        if (!codeMark) return false;

        if (isRightArrow && !domCaret) {
          const nodeAfter = selection.$from.nodeAfter;
          const codeText = nodeAfter?.isText ? (nodeAfter.text ?? "") : "";
          if (!nodeAfter || !codeMark.isInSet(nodeAfter.marks) || !codeText) {
            return false;
          }

          const firstLength = edgeGraphemeLength(codeText, "start");
          const caret = inlineCodeCaretAtDocumentPosition(
            view,
            selection.from + firstLength,
            "",
          );
          if (!caret || firstLength === 0) return false;

          // 从代码外先进入左边界，下一次右移才越过首字素。
          event.preventDefault();
          const tr = view.state.tr
            .setSelection(TextSelection.create(view.state.doc, selection.from))
            .setStoredMarks([codeMark.create()])
            .setMeta(PLUGIN_KEY, {
              edge: "start",
              phase: "inside",
              pos: selection.from,
            })
            .setMeta("addToHistory", false);
          view.dispatch(tr);
          setDomCaretAtCodeStart(view, caret);
          clearVisualCaret();
          visualCaret = showVisualCaret(view, caret, "start");
          return true;
        }

        if (
          isRightArrow &&
          domCaret?.textBeforeCaret.length === 0
        ) {
          const codeText = domCaret.textNode.data;
          const firstLength = edgeGraphemeLength(codeText, "start");
          if (firstLength === 0) return false;

          event.preventDefault();
          const targetPos = selection.from + firstLength;
          const tr = view.state.tr
            .setSelection(TextSelection.create(view.state.doc, targetPos))
            .setStoredMarks([codeMark.create()])
            .setMeta(PLUGIN_KEY, null)
            .setMeta("addToHistory", false);
          view.dispatch(tr);
          setDomCaretAtTextOffset(view, domCaret, firstLength);
          return true;
        }

        if (isLeftArrow && !domCaret) {
          const nodeBefore = selection.$from.nodeBefore;
          const codeText = nodeBefore?.isText ? (nodeBefore.text ?? "") : "";
          if (!nodeBefore || !codeMark.isInSet(nodeBefore.marks) || !codeText) {
            return false;
          }

          const lastLength = edgeGraphemeLength(codeText, "end");
          const caret = inlineCodeCaretAtDocumentPosition(
            view,
            selection.from - lastLength,
            codeText,
          );
          if (!caret || lastLength === 0) return false;

          // 从代码外先进入右边界，下一次左移才越过末字素。
          event.preventDefault();
          const tr = view.state.tr
            .setSelection(TextSelection.create(view.state.doc, selection.from))
            .setStoredMarks([codeMark.create()])
            .setMeta(PLUGIN_KEY, {
              edge: "end",
              phase: "inside",
              pos: selection.from,
            })
            .setMeta("addToHistory", false);
          view.dispatch(tr);
          setDomCaretAtCodeEnd(view, caret);
          clearVisualCaret();
          visualCaret = showVisualCaret(view, caret, "end");
          return true;
        }

        if (isLeftArrow && domCaret?.textAfterCaret.length === 0) {
          const codeText = domCaret.textNode.data;
          const lastLength = edgeGraphemeLength(codeText, "end");
          if (lastLength === 0) return false;

          event.preventDefault();
          const targetPos = selection.from - lastLength;
          const tr = view.state.tr
            .setSelection(TextSelection.create(view.state.doc, targetPos))
            .setStoredMarks([codeMark.create()])
            .setMeta(PLUGIN_KEY, null)
            .setMeta("addToHistory", false);
          view.dispatch(tr);
          setDomCaretAtTextOffset(
            view,
            domCaret,
            domCaret.textNode.data.length - lastLength,
          );
          return true;
        }

        if (isRightArrow) {
          if (!domCaret || !isSingleGrapheme(domCaret.textAfterCaret)) {
            return false;
          }

          const markEnd = selection.from + domCaret.textAfterCaret.length;
          const nodeBefore = view.state.doc.resolve(markEnd).nodeBefore;
          if (!nodeBefore || !codeMark.isInSet(nodeBefore.marks)) return false;

          event.preventDefault();
          const tr = view.state.tr
            .setSelection(TextSelection.create(view.state.doc, markEnd))
            .setStoredMarks([codeMark.create()])
            .setMeta(PLUGIN_KEY, {
              edge: "end",
              phase: "inside",
              pos: markEnd,
            })
            .setMeta("addToHistory", false);
          view.dispatch(tr);
          setDomCaretAtCodeEnd(view, domCaret);
          clearVisualCaret();
          visualCaret = showVisualCaret(view, domCaret, "end");
          return true;
        }

        let caret = domCaret;
        let textBeforeCaret = domCaret?.textBeforeCaret ?? "";

        if (
          !isSingleGrapheme(textBeforeCaret) &&
          !isTwoGraphemes(textBeforeCaret)
        ) {
          const nodeBefore = selection.$from.nodeBefore;
          const nodeAfter = selection.$from.nodeAfter;
          const textBefore = nodeBefore?.isText ? (nodeBefore.text ?? "") : "";

          // 块末尾的 code 在旧 Chromium 中会把「p 后」映射到 code 外侧，
          // DOM Selection 因而无法识别。此时文档位置仍明确位于同一 code mark
          // 的首字符与剩余字符之间，可安全恢复内部左边界。要求 nodeAfter 仍带
          // code mark，可避免破坏单字符 code 的正常右边界。
          if (
            (!isSingleGrapheme(textBefore) &&
              !isTwoGraphemes(textBefore)) ||
            !nodeBefore ||
            !codeMark.isInSet(nodeBefore.marks) ||
            !nodeAfter ||
            !codeMark.isInSet(nodeAfter.marks)
          ) {
            return false;
          }

          textBeforeCaret = textBefore;
          caret = inlineCodeCaretAtDocumentPosition(
            view,
            selection.from,
            textBeforeCaret,
          );
        }

        if (!caret) return false;

        const markStart = selection.from - textBeforeCaret.length;
        if (markStart < 0) return false;

        if (isTwoGraphemes(textBeforeCaret)) {
          const nodeAfter = selection.$from.nodeAfter;
          if (!nodeAfter || !codeMark.isInSet(nodeAfter.marks)) return false;

          const firstLength = edgeGraphemeLength(
            caret.textNode.data,
            "start",
          );
          if (firstLength === 0) return false;

          // 旧 Chromium 可能把这一步直接合并到 code 外，显式落到首字素后。
          event.preventDefault();
          const targetPos = markStart + firstLength;
          const tr = view.state.tr
            .setSelection(TextSelection.create(view.state.doc, targetPos))
            .setStoredMarks([codeMark.create()])
            .setMeta(PLUGIN_KEY, null)
            .setMeta("addToHistory", false);
          view.dispatch(tr);
          setDomCaretAtTextOffset(view, caret, firstLength);
          return true;
        }

        if (!isSingleGrapheme(textBeforeCaret)) return false;

        const nodeAfter = view.state.doc.resolve(markStart).nodeAfter;
        if (!nodeAfter || !codeMark.isInSet(nodeAfter.marks)) return false;

        event.preventDefault();
        const tr = view.state.tr
          .setSelection(TextSelection.create(view.state.doc, markStart))
          .setStoredMarks([codeMark.create()])
          .setMeta(PLUGIN_KEY, {
            edge: "start",
            phase: "inside",
            pos: markStart,
          })
          .setMeta("addToHistory", false);
        view.dispatch(tr);
        setDomCaretAtCodeStart(view, caret);
        clearVisualCaret();
        visualCaret = showVisualCaret(view, caret, "start");
        return true;
      },
      handleDOMEvents: {
        pointerdown() {
          return false;
        },
      },
    },
    view(editorView) {
      const captureBoundaryKeyDown = (event: KeyboardEvent) => {
        if (!plugin.props.handleKeyDown?.call(plugin, editorView, event)) return;
        event.stopImmediatePropagation();
      };
      editorView.dom.addEventListener(
        "keydown",
        captureBoundaryKeyDown,
        true,
      );

      return {
        update(view, previousState) {
          if (!PLUGIN_KEY.getState(view.state)) clearVisualCaret();
        },
        destroy() {
          editorView.dom.removeEventListener(
            "keydown",
            captureBoundaryKeyDown,
            true,
          );
          clearVisualCaret();
        },
      };
    },
  });

  return plugin;
}

export const gooseInlineCodeBoundaryNavigationExtension = createExtension({
  key: "goose-inline-code-boundary-navigation",
  prosemirrorPlugins: [inlineCodeBoundaryNavigationPlugin()],
});
