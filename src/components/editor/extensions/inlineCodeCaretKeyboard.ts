import type { MarkType, ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  isInsideCode,
  resolveWordDelete,
  storedMarksForCodeEdge,
  towardInlineCode,
  wordDeleteRange,
  wordMoveTarget,
  type WordAxis,
} from "./inlineCodeWordBoundary";
import {
  edgeGraphemeLength,
  inlineCodeEdgeAt,
  inlineCodeEdgeArrowAction,
} from "./inlineCodeCaretModel";
import { queueCaretSync } from "./inlineCodeCaretDom";

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
    direction === "right"
      ? ($pos.nodeAfter?.text ?? "")
      : ($pos.nodeBefore?.text ?? "");
  const length = edgeGraphemeLength(
    text,
    direction === "right" ? "start" : "end",
  );
  if (!length) return null;
  return direction === "right" ? from + length : from - length;
}

export function handleArrow(
  view: EditorView,
  direction: "left" | "right",
): boolean {
  const { state } = view;
  const codeType = state.schema.marks.code;
  if (!codeType) return false;

  const selection = state.selection;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const $pos = selection.$from;
  const edge = inlineCodeEdgeAt($pos, codeType);

  if (!edge) {
    // 不在边界：代码内部逐字移动，以及从正文进入代码左边界。
    const target = stepTarget($pos, selection.from, direction);
    if (target === null) return false;
    // 边界 span 会让 Chromium 的原生方向键从代码内跳回盒外；盒内逐字移动也由 PM 接管。
    if (
      !isInsideCode(state, $pos, codeType) &&
      inlineCodeEdgeAt(state.doc.resolve(target), codeType) !== "start"
    ) {
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
export function handleDelete(
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

export function handleWordDelete(
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

export function handleWordMove(
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
    !!raw && !!clamped && (raw.from !== clamped.from || raw.to !== clamped.to);
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
