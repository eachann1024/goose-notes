import { createExtension } from "@blocknote/core";
import type { Node, ResolvedPos } from "@tiptap/pm/model";
import {
  Plugin,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { inlineCodeEdgeAt } from "@/components/editor/extensions/inlineCodeCaretExtension";
import {
  isInsideCode,
  storedMarksForCodeEdge,
} from "@/components/editor/extensions/inlineCodeWordBoundary";
import {
  extendToVisualLineEnd,
  extendToVisualLineStart,
  type CaretCoords,
} from "@/components/editor/extensions/trailingBlankClickExtension";
import { getPlatformKind, type PlatformKind } from "@/lib/utils";

/**
 * macOS Cmd+←/→、各平台 Home/End：跳到当前视觉行首/行尾。
 *
 * 行内代码的 boundary span 是 contenteditable=false 的零宽 inline-block，
 * Chromium 原生 Cmd+→ 会把光标甩到整篇 contenteditable 末尾。
 * 浏览器默认不可靠，这里自己按视觉行 + 硬换行收口。
 */

export type LineBoundaryDirection = "start" | "end";

export type LineBoundaryKeyEvent = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
};

export type LineBoundaryShortcut = {
  direction: LineBoundaryDirection;
  extend: boolean;
};

export function lineBoundaryShortcut(
  event: LineBoundaryKeyEvent,
  platform: PlatformKind,
): LineBoundaryShortcut | null {
  if (event.isComposing || event.altKey) return null;

  const extend = event.shiftKey;
  const key = event.key;

  if (key === "Home" || key === "End") {
    // Ctrl/Meta+Home/End 是文档首尾，放行。
    if (event.ctrlKey || event.metaKey) return null;
    return { direction: key === "Home" ? "start" : "end", extend };
  }

  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;

  // 只有 macOS 的 Cmd+←/→ 是行首/行尾。Windows 的 Win+方向键是系统贴边。
  if (platform === "mac" && event.metaKey && !event.ctrlKey) {
    return {
      direction: key === "ArrowLeft" ? "start" : "end",
      extend,
    };
  }
  return null;
}

export function textblockRangeFromResolved(
  $pos: ResolvedPos,
): { start: number; end: number } | null {
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

function charAt(doc: Node, pos: number): string {
  return doc.textBetween(pos, pos + 1, "\n", "\n");
}

export function logicalLineEnd(
  doc: Node,
  from: number,
  textblockEnd: number,
): number {
  for (let pos = from; pos < textblockEnd; pos += 1) {
    if (charAt(doc, pos) === "\n") return pos;
  }
  return textblockEnd;
}

export function logicalLineStart(
  doc: Node,
  from: number,
  textblockStart: number,
): number {
  for (let pos = from; pos > textblockStart; pos -= 1) {
    if (charAt(doc, pos - 1) === "\n") return pos;
  }
  return textblockStart;
}

export function resolveLineBoundaryPos(args: {
  from: number;
  start: number;
  end: number;
  direction: LineBoundaryDirection;
  doc: Node;
  coordsAtPos?: (pos: number) => CaretCoords;
}): number {
  const { from, start, end, direction, doc, coordsAtPos } = args;
  if (direction === "end") {
    const logical = logicalLineEnd(doc, from, end);
    if (!coordsAtPos) return logical;
    return Math.min(extendToVisualLineEnd(coordsAtPos, from, end), logical);
  }
  const logical = logicalLineStart(doc, from, start);
  if (!coordsAtPos) return logical;
  return Math.max(extendToVisualLineStart(coordsAtPos, from, start), logical);
}

export function lineBoundaryTransaction(
  state: EditorState,
  direction: LineBoundaryDirection,
  extend: boolean,
  coordsAtPos?: (pos: number) => CaretCoords,
): Transaction | null {
  const selection = state.selection;
  if (!(selection instanceof TextSelection)) return null;

  const $head = selection.$head;
  const range = textblockRangeFromResolved($head);
  if (!range) return null;

  const target = resolveLineBoundaryPos({
    from: $head.pos,
    start: range.start,
    end: range.end,
    direction,
    doc: state.doc,
    coordsAtPos,
  });

  const next = extend
    ? TextSelection.create(state.doc, selection.anchor, target)
    : TextSelection.create(state.doc, target);

  const tr = state.tr.setSelection(next);
  if (extend) return tr;

  const codeType = state.schema.marks.code;
  if (!codeType) return tr;

  const $target = state.doc.resolve(target);
  const edge = inlineCodeEdgeAt($target, codeType);
  tr.setStoredMarks(
    edge
      ? storedMarksForCodeEdge(
          $target,
          codeType,
          isInsideCode(state, $head, codeType),
        )
      : null,
  );
  return tr;
}

function handleLineBoundaryKey(
  view: EditorView,
  event: KeyboardEvent,
): boolean {
  if (event.isComposing || view.composing) return false;
  const shortcut = lineBoundaryShortcut(event, getPlatformKind());
  if (!shortcut) return false;

  const tr = lineBoundaryTransaction(
    view.state,
    shortcut.direction,
    shortcut.extend,
    (pos) => view.coordsAtPos(pos),
  );
  if (
    tr &&
    (!tr.selection.eq(view.state.selection) || tr.storedMarksSet)
  ) {
    view.dispatch(tr.scrollIntoView());
  }
  // 即使已经在行尾也要吞掉，否则浏览器会把光标甩到整篇末尾。
  return true;
}

export const gooseLineBoundaryKeyboardExtension = createExtension({
  key: "goose-line-boundary-keyboard",
  prosemirrorPlugins: [
    new Plugin({
      props: {
        handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
          return handleLineBoundaryKey(view, event);
        },
      },
    }),
  ],
});
