import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { MarkType, ResolvedPos } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

// 行内 code mark 的飞书 / Notion 式光标交互。
//
// 解决两类 ProseMirror 原生缺陷：
//   1) 光标无法停到行内 code 的「最前面」(code 是块首内容时，左侧没有文本节点可落点)。
//   2) 在 code「最右边」输入会溢出到 code 外 / 反之被困在 code 内 —— 因为浏览器无法
//      区分「光标贴在 mark 边界的内侧还是外侧」。
//
// 思路 (复刻 prosemirror-codemark)：不改 BlockNote 内置 mark 的 inclusive 属性，
// 全靠插件接管。用 storedMarks 是否含 code 来表达「光标逻辑上在 code 内 / 外」，
// 在边界处用一个 fake-cursor decoration 画出正确的视觉位置并隐藏真光标，
// 方向键到边界时先切换内 / 外状态(消费一次按键)，再继续移动。

const codeMarkKey = new PluginKey<DecorationSet>("gooseInlineCodeEscape");

interface BoundaryInfo {
  /** 光标左侧字符是否带 code */
  beforeHasCode: boolean;
  /** 光标右侧字符是否带 code */
  afterHasCode: boolean;
  /** 光标当前(storedMarks / $cursor.marks)是否携带 code */
  cursorHasCode: boolean;
}

function getCodeType(state: EditorState): MarkType | null {
  return state.schema.marks.code ?? null;
}

function inspectBoundary(
  state: EditorState,
  codeType: MarkType,
): { info: BoundaryInfo; $cursor: ResolvedPos } | null {
  const { selection, storedMarks } = state;
  if (!selection.empty) return null;
  const $cursor: ResolvedPos = (selection as any).$cursor ?? selection.$from;

  const nodeBefore = $cursor.nodeBefore;
  const nodeAfter = $cursor.nodeAfter;
  const beforeHasCode = nodeBefore ? codeType.isInSet(nodeBefore.marks) != null : false;
  const afterHasCode = nodeAfter ? codeType.isInSet(nodeAfter.marks) != null : false;

  const currentMarks = storedMarks ?? $cursor.marks();
  const cursorHasCode = codeType.isInSet(currentMarks) != null;

  return { info: { beforeHasCode, afterHasCode, cursorHasCode }, $cursor };
}

/**
 * 判断光标是否处在 code 的「边界」——一侧有 code、另一侧没有(含块的首 / 尾)。
 * 只有边界处才需要区分内 / 外，非边界由 ProseMirror 原生处理。
 */
function isAtBoundary(info: BoundaryInfo): boolean {
  return info.beforeHasCode !== info.afterHasCode;
}

/**
 * 设置「光标在 code 内」的 storedMarks。inside=true → 带 code，false → 去掉 code。
 */
function setInside(
  tr: Transaction,
  state: EditorState,
  codeType: MarkType,
  inside: boolean,
): Transaction {
  const $cursor = (state.selection as any).$cursor ?? state.selection.$from;
  const base = state.storedMarks ?? $cursor.marks();
  const codeMark = codeType.create();
  const next = inside ? codeMark.addToSet(base) : codeMark.removeFromSet(base);
  return tr.setStoredMarks(next);
}

/**
 * 方向键处理：在 code 边界处优先切换内 / 外，而非直接移动光标。
 * 返回 true 表示已消费该按键。
 */
function handleArrow(view: EditorView, dir: "left" | "right"): boolean {
  const { state } = view;
  const codeType = getCodeType(state);
  if (!codeType) return false;
  const probe = inspectBoundary(state, codeType);
  if (!probe) return false;
  const { info } = probe;
  if (!isAtBoundary(info)) return false;

  // 边界语义：
  //   afterHasCode  → 右侧是 code，左侧不是 (code 的「开始」边界)
  //   beforeHasCode → 左侧是 code，右侧不是 (code 的「结束」边界)
  if (dir === "right") {
    // 在 code「开始」边界、且当前在外侧 → 按右进入 code(不移动光标，只切状态)
    if (info.afterHasCode && !info.cursorHasCode) {
      view.dispatch(setInside(state.tr, state, codeType, true));
      return true;
    }
    // 在 code「结束」边界、且当前在内侧 → 按右退出 code(不移动光标，只切状态)
    if (info.beforeHasCode && info.cursorHasCode) {
      view.dispatch(setInside(state.tr, state, codeType, false));
      return true;
    }
  } else {
    // 在 code「结束」边界、且当前在外侧 → 按左进入 code
    if (info.beforeHasCode && !info.cursorHasCode) {
      view.dispatch(setInside(state.tr, state, codeType, true));
      return true;
    }
    // 在 code「开始」边界、且当前在内侧 → 按左退出 code
    if (info.afterHasCode && info.cursorHasCode) {
      view.dispatch(setInside(state.tr, state, codeType, false));
      return true;
    }
  }
  return false;
}

/**
 * 是否需要假光标：仅当处于 code 边界、且逻辑状态为「内侧」时。
 * 外侧时浏览器真 caret 天然就画在 code span 外，无需顶替。
 */
function needsFakeCursor(state: EditorState): boolean {
  const codeType = getCodeType(state);
  if (!codeType) return false;
  const probe = inspectBoundary(state, codeType);
  if (!probe) return false;
  const { info } = probe;
  return isAtBoundary(info) && info.cursorHasCode;
}

/**
 * 计算 fake-cursor decoration：仅在「内侧」状态下，画一个零宽假光标把视觉光标
 * 拉进 code 框内；配合 plugin view 把真 caret 透明掉，避免双光标。
 *
 * side 必须按边界类型区分，否则假光标会被排到 code span 外：
 *   - 开始边界内侧(afterHasCode，光标在 code 首字之前) → side:1，排到 pos 右侧 = code 内沿
 *   - 结束边界内侧(beforeHasCode，光标在 code 尾字之后) → side:-1，排到 pos 左侧 = code 内沿
 */
function buildDecorations(state: EditorState): DecorationSet {
  if (!needsFakeCursor(state)) return DecorationSet.empty;
  const codeType = getCodeType(state)!;
  const probe = inspectBoundary(state, codeType)!;
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

function inlineCodeEscapePlugin() {
  return new Plugin<DecorationSet>({
    key: codeMarkKey,
    state: {
      init: (_config, state) => buildDecorations(state),
      apply: (_tr, _old, _oldState, newState) => buildDecorations(newState),
    },
    props: {
      decorations(state) {
        return codeMarkKey.getState(state) ?? DecorationSet.empty;
      },
      handleKeyDown(view, event) {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
        if (event.key === "ArrowRight") return handleArrow(view, "right");
        if (event.key === "ArrowLeft") return handleArrow(view, "left");
        return false;
      },
    },
    // 假光标可见时，把真 caret 透明掉(否则双光标)。用根节点 class 控制，
    // 仅作用于编辑器自身，不影响其它块。
    view() {
      return {
        update(view) {
          // 复用 plugin state：有假光标 decoration 即需隐藏真 caret，避免重复 inspect。
          const deco = codeMarkKey.getState(view.state);
          const on = deco != null && deco !== DecorationSet.empty && deco.find().length > 0;
          view.dom.classList.toggle("goose-inline-code-hide-caret", on);
        },
        destroy() {},
      };
    },
  });
}

export const gooseInlineCodeEscapeExtension = createExtension({
  key: "inlineCodeEscape",
  prosemirrorPlugins: [inlineCodeEscapePlugin()],
});
