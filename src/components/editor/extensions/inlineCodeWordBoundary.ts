import type { Mark, MarkType, ResolvedPos } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";

export type WordAxis = "backward" | "forward";

function segmentGraphemes(text: string): string[] {
  const Segmenter = (
    Intl as typeof Intl & {
      Segmenter?: new (
        locales?: string | string[],
        options?: { granularity: "grapheme" },
      ) => { segment: (value: string) => Iterable<{ segment: string }> };
    }
  ).Segmenter;

  if (!Segmenter) return Array.from(text);
  const values: string[] = [];
  for (const value of new Segmenter(undefined, {
    granularity: "grapheme",
  }).segment(text)) {
    values.push(value.segment);
  }
  return values;
}

function isWhitespaceGrapheme(text: string): boolean {
  return /^\s+$/u.test(text);
}

function nodeHasCode(
  node: { isText: boolean; marks: readonly Mark[] } | null,
  codeType: MarkType,
): boolean {
  return !!node?.isText && !!codeType.isInSet(node.marks);
}

function takeGrapheme(
  $pos: ResolvedPos,
  direction: WordAxis,
  codeType: MarkType,
): { from: number; to: number; text: string; hasCode: boolean } | null {
  const node = direction === "backward" ? $pos.nodeBefore : $pos.nodeAfter;
  if (!node?.isText || !node.text) return null;
  const graphemes = segmentGraphemes(node.text);
  const grapheme =
    direction === "backward" ? graphemes[graphemes.length - 1] : graphemes[0];
  if (!grapheme) return null;
  const pos = $pos.pos;
  const from = direction === "backward" ? pos - grapheme.length : pos;
  const to = direction === "backward" ? pos : pos + grapheme.length;
  return {
    from,
    to,
    text: grapheme,
    hasCode: nodeHasCode(node, codeType),
  };
}

/**
 * Option/Ctrl 按词删除的区间。行内 code 与两侧正文是硬边界：
 * 盒外不会吃进代码，盒内不会删到代码外。
 * 没有可删内容时返回 null（调用方在盒外硬边界上应吞掉按键，避免浏览器把整段 code 当一个词删掉）。
 */
export function wordDeleteRange(
  $pos: ResolvedPos,
  direction: WordAxis,
  codeType: MarkType,
  inside: boolean,
  stopAtCode = true,
): { from: number; to: number } | null {
  const parentStart = $pos.start();
  const parentEnd = $pos.end();
  const origin = $pos.pos;
  let pos = origin;
  const doc = $pos.doc;

  const blocked = (
    grapheme: NonNullable<ReturnType<typeof takeGrapheme>>,
  ): boolean => {
    if (stopAtCode && grapheme.hasCode !== inside) return true;
    if (grapheme.from < parentStart || grapheme.to > parentEnd) return true;
    return false;
  };

  for (;;) {
    const grapheme = takeGrapheme(doc.resolve(pos), direction, codeType);
    if (!grapheme || blocked(grapheme) || !isWhitespaceGrapheme(grapheme.text)) {
      break;
    }
    pos = direction === "backward" ? grapheme.from : grapheme.to;
  }

  for (;;) {
    const grapheme = takeGrapheme(doc.resolve(pos), direction, codeType);
    if (!grapheme || blocked(grapheme) || isWhitespaceGrapheme(grapheme.text)) {
      break;
    }
    pos = direction === "backward" ? grapheme.from : grapheme.to;
  }

  if (pos === origin) return null;
  return direction === "backward"
    ? { from: pos, to: origin }
    : { from: origin, to: pos };
}

export function wordMoveTarget(
  $pos: ResolvedPos,
  direction: WordAxis,
  codeType: MarkType,
  inside: boolean,
): number | null {
  const range = wordDeleteRange($pos, direction, codeType, inside, true);
  if (!range) return null;
  return direction === "backward" ? range.from : range.to;
}

export type WordDeletePlan = { from: number; to: number } | "swallow";

/**
 * 只在会碰到行内代码边界时接管；普通正文仍交给浏览器，以免改掉系统分词。
 * 盒外朝代码按词删且没有「自己这一侧」的词 → swallow，防止整段 code 被当一个词删掉。
 */
export function resolveWordDelete(
  $pos: ResolvedPos,
  direction: WordAxis,
  codeType: MarkType,
  inside: boolean,
  edge: "start" | "end" | null,
): WordDeletePlan | null {
  const clamped = wordDeleteRange($pos, direction, codeType, inside, true);
  const raw = wordDeleteRange($pos, direction, codeType, inside, false);
  const crosses =
    !!raw &&
    !!clamped &&
    (raw.from !== clamped.from || raw.to !== clamped.to);
  const nearCode = inside || !!edge || crosses;
  if (!nearCode) return null;
  if (!clamped) return "swallow";
  return clamped;
}

/** 空数组在 PM 里仍是 truthy storedMarks，组字会走 markCursor 并打断 IME。 */
export function storedMarksForCodeEdge(
  $pos: ResolvedPos,
  codeType: MarkType,
  inside: boolean,
): Mark[] | null {
  const marks = $pos.marks();
  const next = inside
    ? codeType.create().addToSet(marks)
    : codeType.removeFromSet(marks);
  return next.length > 0 ? [...next] : null;
}

export function currentMarksAt(
  state: EditorState,
  $pos: ResolvedPos,
): readonly Mark[] {
  return state.storedMarks ?? $pos.marks();
}

export function isInsideCode(
  state: EditorState,
  $pos: ResolvedPos,
  codeType: MarkType,
): boolean {
  return !!codeType.isInSet(currentMarksAt(state, $pos));
}

export function towardInlineCode(
  edge: "start" | "end",
  direction: WordAxis,
): boolean {
  return (
    (edge === "end" && direction === "backward") ||
    (edge === "start" && direction === "forward")
  );
}
