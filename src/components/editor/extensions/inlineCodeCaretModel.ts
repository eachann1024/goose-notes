import type { MarkType, ResolvedPos } from "@tiptap/pm/model";

export type InlineCodeEdge = "start" | "end";

export type InlineCodeEdgeArrowAction =
  | "step-inward"
  | "enter"
  | "leave"
  | null;

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
export function edgeGraphemeLength(text: string, edge: InlineCodeEdge): number {
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
