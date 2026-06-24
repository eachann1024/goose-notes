import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import type { MarkType, ResolvedPos } from "prosemirror-model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";

/**
 * 行内 code mark 边界交互（飞书 / Notion 式）：
 * - storedMarks 表示光标逻辑在 code 内 / 外
 * - 边界处方向键先切换内 / 外
 * - 内侧边界用假光标 + 隐藏真 caret
 */

const inlineCodeMarkKey = new PluginKey<DecorationSet>("gooseInlineCodeMark");

interface BoundaryInfo {
  beforeHasCode: boolean;
  afterHasCode: boolean;
  cursorHasCode: boolean;
}
function getCodeType(state: EditorState): MarkType | null {
  return state.schema.marks.code ?? null;
}

function resolveCursorPos(state: EditorState): ResolvedPos | null {
  const { selection } = state;
  if (!selection.empty) return null;
  if (selection instanceof TextSelection && selection.$cursor != null) {
    return selection.$cursor;
  }
  return selection.$from;
}
function inspectBoundary(
  state: EditorState,
  codeType: MarkType,
): { info: BoundaryInfo; $cursor: ResolvedPos } | null {
  const $cursor = resolveCursorPos(state);
  if ($cursor == null) return null;

  const nodeBefore = $cursor.nodeBefore;
  const nodeAfter = $cursor.nodeAfter;
  const beforeHasCode = nodeBefore ? codeType.isInSet(nodeBefore.marks) != null : false;
  const afterHasCode = nodeAfter ? codeType.isInSet(nodeAfter.marks) != null : false;

  const cursorHasCode = effectiveCursorHasCode(state, codeType, { beforeHasCode, afterHasCode, cursorHasCode: false }, $cursor);

  return { info: { beforeHasCode, afterHasCode, cursorHasCode }, $cursor };
}

function isAtBoundary(info: BoundaryInfo): boolean {
  return info.beforeHasCode !== info.afterHasCode;
}

/** storedMarks 为 null 时，边界位置默认在 code 外（避免紧贴 code 尾输入仍带 mark） */
function effectiveCursorHasCode(
  state: EditorState,
  codeType: MarkType,
  info: BoundaryInfo,
  $cursor: ResolvedPos,
): boolean {
  if (state.storedMarks !== null) {
    return codeType.isInSet(state.storedMarks) != null;
  }
  if (isAtBoundary(info)) {
    return false;
  }
  return codeType.isInSet($cursor.marks()) != null;
}

function syncStoredMarksAtBoundary(state: EditorState): Transaction | null {
  const codeType = getCodeType(state);
  if (!codeType) return null;
  const probe = inspectBoundary(state, codeType);
  if (!probe || !isAtBoundary(probe.info)) return null;

  const { info, $cursor } = probe;
  const wantInside = effectiveCursorHasCode(state, codeType, info, $cursor);
  const codeMark = codeType.create();
  const base = $cursor.marks();
  const next = wantInside ? codeMark.addToSet(base) : codeMark.removeFromSet(base);

  const current = state.storedMarks ?? base;
  const hasCode = codeType.isInSet(current) != null;
  if (hasCode === wantInside) return null;

  return state.tr.setStoredMarks(next);
}
function setInside(
  tr: Transaction,
  state: EditorState,
  codeType: MarkType,
  inside: boolean,
): Transaction {
  const $cursor = resolveCursorPos(state) ?? state.selection.$from;
  const base = state.storedMarks ?? $cursor.marks();
  const codeMark = codeType.create();
  const next = inside ? codeMark.addToSet(base) : codeMark.removeFromSet(base);
  return tr.setStoredMarks(next);
}

function handleArrow(view: EditorView, dir: "left" | "right"): boolean {
  const { state } = view;
  const codeType = getCodeType(state);
  if (!codeType) return false;
  const probe = inspectBoundary(state, codeType);
  if (!probe) return false;
  const { info } = probe;
  if (!isAtBoundary(info)) return false;

  if (dir === "right") {
    if (info.afterHasCode && !info.cursorHasCode) {
      view.dispatch(setInside(state.tr, state, codeType, true));
      return true;
    }
    if (info.beforeHasCode && info.cursorHasCode) {
      view.dispatch(setInside(state.tr, state, codeType, false));
      return true;
    }
  } else {
    if (info.beforeHasCode && !info.cursorHasCode) {
      view.dispatch(setInside(state.tr, state, codeType, true));
      return true;
    }
    if (info.afterHasCode && info.cursorHasCode) {
      view.dispatch(setInside(state.tr, state, codeType, false));
      return true;
    }
  }
  return false;
}

function needsFakeCursor(state: EditorState): boolean {
  const codeType = getCodeType(state);
  if (!codeType) return false;
  const probe = inspectBoundary(state, codeType);
  if (!probe) return false;
  const { info } = probe;
  return isAtBoundary(info) && info.cursorHasCode;
}

function buildDecorations(state: EditorState): DecorationSet {
  if (!needsFakeCursor(state)) return DecorationSet.empty;
  const codeType = getCodeType(state);
  if (!codeType) return DecorationSet.empty;
  const probe = inspectBoundary(state, codeType);
  if (!probe) return DecorationSet.empty;
  const { info, $cursor } = probe;

  const cursor = document.createElement("span");
  cursor.className = "goose-inline-code-fake-cursor";
  cursor.setAttribute("aria-hidden", "true");

  const side = info.afterHasCode ? 1 : -1;
  const widget = Decoration.widget($cursor.pos, cursor, {
    side,
    marks: [],
    key: `goose-inline-code-fake-cursor-${side}`,
  });

  return DecorationSet.create(state.doc, [widget]);
}

function inlineCodeMarkPlugin() {
  return new Plugin<DecorationSet>({
    key: inlineCodeMarkKey,
    state: {
      init: (_config, state) => buildDecorations(state),
      apply: (_tr, _old, _oldState, newState) => buildDecorations(newState),
    },
    props: {
      decorations(state) {
        return inlineCodeMarkKey.getState(state) ?? DecorationSet.empty;
      },
      handleKeyDown(view, event) {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
        if (event.key === "ArrowRight") return handleArrow(view, "right");
        if (event.key === "ArrowLeft") return handleArrow(view, "left");
        return false;
      },
    },
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.selectionSet || tr.docChanged)) return null;
      return syncStoredMarksAtBoundary(newState);
    },
    view() {
      return {
        update(view) {
          const deco = inlineCodeMarkKey.getState(view.state);
          const on =
            deco != null && deco !== DecorationSet.empty && deco.find().length > 0;
          view.dom.classList.toggle("goose-inline-code-hide-caret", on);
        },
        destroy() {},
      };
    },
  });
}

export const gooseInlineCodeMarkExtension = createExtension({
  key: "inlineCodeMark",
  prosemirrorPlugins: [inlineCodeMarkPlugin()],
});