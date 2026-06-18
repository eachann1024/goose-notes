import { createExtension } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * 跨块选区删除：只删每个块内被选中的内容，**不合并块**。
 *
 * 默认行为：选区从「标题中间」一直拖到「下一个段落」，按删除键时 ProseMirror 会删掉
 * 标题尾部 + 块边界 + 段落头部，于是下个段落整段被并入标题（见用户反馈截图）。
 * 这破坏「第一行恒为标题一」的语义，也违反用户「只删选中部分」的预期。
 *
 * 修复：当选区**起点落在文档第一个块（标题块）**且跨越 ≥2 个顶层块时，拦截
 * Backspace/Delete，改为逐块删除各块内被选中的 inline 内容，保留所有块容器与各自类型。
 * 删除后光标落到第一个块删除点。
 *
 * 范围限定为「涉及首块标题」：正文区之间的跨块删除保持 ProseMirror 默认（合并），只在
 * 会污染文档标题的场景介入，最小化对常规编辑手感的影响。
 */

type BlockHit = {
  /** blockContainer 内容节点（heading/paragraph/...）在文档中的起止（inline 内容坐标）。 */
  contentFrom: number;
  contentTo: number;
  /** 选区在该内容块内覆盖的 inline 区间。 */
  selFrom: number;
  selTo: number;
};

/** 收集选区跨越的所有顶层 blockContainer 内容块，及选区在每块内的覆盖区间。 */
function collectSelectedBlocks(state: EditorState): BlockHit[] {
  const { from, to } = state.selection;
  const hits: BlockHit[] = [];

  state.doc.descendants((node: PMNode, pos: number) => {
    if (node.type.name !== "blockContainer") return true;
    const content = node.firstChild;
    if (!content || !content.isTextblock) return true; // 仅处理 inline 内容块

    const contentFrom = pos + 2; // blockContainer(+1) → 内容节点(+1) → 内部首位
    const contentTo = contentFrom + content.content.size;

    // 该内容块与选区有交集？
    const overlapFrom = Math.max(from, contentFrom);
    const overlapTo = Math.min(to, contentTo);
    if (overlapFrom <= overlapTo && overlapTo >= contentFrom && overlapFrom <= contentTo) {
      // 有重叠（含零长度边界接触；零长度的端点块跳过，避免空删）
      if (overlapFrom < overlapTo) {
        hits.push({ contentFrom, contentTo, selFrom: overlapFrom, selTo: overlapTo });
      }
    }
    return false; // 不下钻嵌套块（嵌套子块由上层处理足够覆盖常见场景）
  });

  return hits;
}

/** 文档第一个 blockContainer 内容节点的 inline 起始坐标（用于判断选区是否起于首块）。 */
function getFirstBlockContentFrom(state: EditorState): number | null {
  let result: number | null = null;
  state.doc.descendants((node: PMNode, pos: number) => {
    if (result !== null) return false;
    if (node.type.name === "blockContainer") {
      const content = node.firstChild;
      if (content && content.isTextblock) result = pos + 2;
      return false;
    }
    return true;
  });
  return result;
}

function deleteWithinBlocks(state: EditorState): Transaction | null {
  const hits = collectSelectedBlocks(state);
  if (hits.length < 2) return null; // 单块或无跨块：交还默认行为

  // 仅在选区触及首块标题时介入；正文区跨块删除保持默认合并行为。
  const firstContentFrom = getFirstBlockContentFrom(state);
  if (firstContentFrom === null || hits[0].contentFrom !== firstContentFrom) {
    return null;
  }

  let tr = state.tr;
  // 从后往前删，避免前面的删除使后面坐标失效。
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (h.selTo > h.selFrom) {
      tr = tr.delete(h.selFrom, h.selTo);
    }
  }
  if (!tr.docChanged) return null;

  // 光标落到第一个块的删除起点（映射到删除后的坐标）。
  const caret = tr.mapping.map(hits[0].selFrom);
  try {
    tr = tr.setSelection(TextSelection.create(tr.doc, caret));
  } catch {
    /* 映射越界时退回默认选区 */
  }
  return tr.scrollIntoView();
}

export const gooseCrossBlockDeleteExtension = createExtension({
  key: "goose-cross-block-delete",
  keyboardShortcuts: {
    Backspace: ({ editor }) => {
      const state = editor.prosemirrorState;
      if (state.selection.empty) return false;
      const tr = deleteWithinBlocks(state);
      if (!tr) return false;
      editor.prosemirrorView.dispatch(tr);
      return true;
    },
    Delete: ({ editor }) => {
      const state = editor.prosemirrorState;
      if (state.selection.empty) return false;
      const tr = deleteWithinBlocks(state);
      if (!tr) return false;
      editor.prosemirrorView.dispatch(tr);
      return true;
    },
  },
});
