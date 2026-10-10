import type { BlockNoteEditor } from "@blocknote/core";

export const NON_FORMATTABLE_TYPES = new Set([
  "image",
  "file",
  "audio",
  "video",
  "divider",
  // table 内是可格式化的单元格文字：选中后应显示文字工具栏 / AI。
  // 不可格式化的是整块媒体/代码，不是表格容器本身。
  "codeBlock",
]);
/**
 * 选区是否完全落在同一个不可格式化块内（代码块、图片、视频等）。
 * 仅整段选区都在该块内时禁用工具栏；跨块混合选区（含 Cmd+A 全选）照常显示，
 * 避免「文档里有一个代码块就无法全选加粗」。
 *
 * 直读 prosemirrorState：
 * BlockNote 的 getSelection()/getTextCursorPosition() 在 useEditorState
 * selector 回调里可能因事务重入抛错，不能依赖。PM 节点名与 block type 同名。
 */
export function selectionHasNonFormattableBlock(
  editor: BlockNoteEditor<any, any, any>,
): boolean {
  const { selection, doc } = editor.prosemirrorState;

  const nearestNonFormattable = ($pos: any) => {
    for (let d = $pos.depth; d > 0; d -= 1) {
      const node = $pos.node(d);
      if (NON_FORMATTABLE_TYPES.has(node.type.name)) return node;
    }
    return null;
  };

  const fromNode = nearestNonFormattable(selection.$from);
  if (fromNode && fromNode === nearestNonFormattable(selection.$to)) {
    return true;
  }

  if (selection.empty) return false;

  // 整块选择（例如拖拽选中代码块或代码块独占文档时 Cmd+A）的端点会落在
  // blockContainer / codeBlock 外侧，单看 $from、$to 的祖先会漏判。继续核对
  // 选区实际覆盖的文本：只要所有被选文本都属于同一个不可格式化节点，就隐藏工具栏。
  let coveredNode: any = null;
  let hasSelectedText = false;
  let entirelyNonFormattable = true;

  doc.nodesBetween(selection.from, selection.to, (node: any, pos: number) => {
    if (!entirelyNonFormattable) return false;
    if (!node.isText) return true;

    const selectedFrom = Math.max(selection.from, pos);
    const selectedTo = Math.min(selection.to, pos + node.nodeSize);
    if (selectedFrom >= selectedTo) return false;

    hasSelectedText = true;
    const nonFormattableNode = nearestNonFormattable(doc.resolve(selectedFrom));
    if (!nonFormattableNode) {
      entirelyNonFormattable = false;
      return false;
    }
    if (coveredNode && coveredNode !== nonFormattableNode) {
      entirelyNonFormattable = false;
      return false;
    }
    coveredNode = nonFormattableNode;
    return false;
  });

  return hasSelectedText && entirelyNonFormattable;
}

/** 选区中的全部文字是否都带有行内代码样式。 */
export function selectionIsEntirelyInlineCode(
  editor: BlockNoteEditor<any, any, any>,
): boolean {
  const { selection, doc } = editor.prosemirrorState;
  if (selection.empty) return false;

  let hasSelectedText = false;
  let entirelyInlineCode = true;

  doc.nodesBetween(selection.from, selection.to, (node: any, pos: number) => {
    if (!entirelyInlineCode) return false;
    if (!node.isText) return true;

    const selectedFrom = Math.max(selection.from, pos);
    const selectedTo = Math.min(selection.to, pos + node.nodeSize);
    if (selectedFrom >= selectedTo) return false;

    hasSelectedText = true;
    if (!node.marks.some((mark: any) => mark.type.name === "code")) {
      entirelyInlineCode = false;
    }
    return false;
  });

  return hasSelectedText && entirelyInlineCode;
}

export function selectionDisallowsFormattingToolbar(
  editor: BlockNoteEditor<any, any, any>,
): boolean {
  // 纯行内 code 选区仍应显示工具栏，方便一键取消 code（Mod+E / 工具栏切换）。
  // 代码块、媒体等非格式化块才真正禁用。
  return selectionHasNonFormattableBlock(editor);
}

/**
 * 选区是否完全落在标题一（文档物理首块、heading level 1）内部。
 * 跨块选区（含 Cmd+A 全选）返回 false，保证全选时工具栏可用。
 * 虚拟标题不在 BlockNote 文档里，调用方应按 contentMode 自行豁免。
 */
export function selectionIsInsideFirstTitleBlock(
  editor: BlockNoteEditor<any, any, any>,
): boolean {
  const { selection, doc } = editor.prosemirrorState;
  // doc > blockGroup > blockContainer
  const firstContainer = doc.firstChild?.firstChild ?? null;
  if (!firstContainer) return false;

  const nearestContainer = ($pos: any) => {
    for (let d = $pos.depth; d > 0; d -= 1) {
      const node = $pos.node(d);
      if (node.type.name === "blockContainer") return node;
    }
    return null;
  };

  const fromContainer = nearestContainer(selection.$from);
  if (!fromContainer || fromContainer !== nearestContainer(selection.$to)) {
    return false;
  }
  if (fromContainer !== firstContainer) return false;

  const contentNode = fromContainer.firstChild;
  return contentNode?.type.name === "heading" && contentNode.attrs?.level === 1;
}

/**
 * 选区是否完全落在 heading 块内部（任意 level 1-6，文档任意位置）。
 * 跨块混合选区（含 Cmd+A 全选）返回 false，保证全选时不误伤。
 * 用于禁用 heading 内的字符级样式（bold/italic/underline/strike/code）。
 */
export function selectionIsInsideHeadingBlock(
  editor: BlockNoteEditor<any, any, any>,
): boolean {
  const { selection } = editor.prosemirrorState;
  const nearestContainer = ($pos: any) => {
    for (let d = $pos.depth; d > 0; d -= 1) {
      const node = $pos.node(d);
      if (node.type.name === "blockContainer") return node;
    }
    return null;
  };
  const fromContainer = nearestContainer(selection.$from);
  if (!fromContainer || fromContainer !== nearestContainer(selection.$to)) {
    return false;
  }
  const contentNode = fromContainer.firstChild;
  return contentNode?.type.name === "heading";
}

export function shouldRenderFormattingToolbar(
  editor: BlockNoteEditor<any, any, any>,
) {
  if (!editor.isEditable) return false;

  const { selection, doc } = editor.prosemirrorState;

  if (selection.empty) return false;
  // 单单元格文字选区：覆盖到实际文字才允许工具栏（含 AI）。
  if (doc.textBetween(selection.from, selection.to).length === 0) return false;
  // 代码块、媒体块等非格式化块不触发格式工具栏。
  // 纯行内 code 选区仍允许（便于取消 code / 改其它样式 / AI）。
  // 表格已从 NON_FORMATTABLE 移除，单元格文字可选中后加粗/着色/调 AI。
  if (selectionDisallowsFormattingToolbar(editor)) return false;

  return true;
}

/**
 * 浮动格式栏是否打开。
 *
 * BlockNote 的 FormattingToolbarExtension 在 editor pointerdown 时把 store
 * 置 false，pointerup 才按选区恢复。已有选区再拖选另一行时，工具栏会先卸掉、
 * 露出被挡住的上一行，松手才回来。按住期间若工具栏本来是开的，继续保持打开。
 */
export function isFormattingToolbarOpen({
  editable,
  suppress,
  aiActive,
  storeOpen,
  selectionAllowed,
  holdDuringPointerSelect,
}: {
  editable: boolean;
  suppress: boolean;
  aiActive: boolean;
  storeOpen: boolean;
  selectionAllowed: boolean;
  holdDuringPointerSelect: boolean;
}): boolean {
  if (!editable || suppress || aiActive) return false;
  if (holdDuringPointerSelect) return true;
  return storeOpen && selectionAllowed;
}
