import { CellSelection } from "prosemirror-tables";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * 跨块 / 越界选区删除。
 *
 * 1) 跨 ≥2 个 block 时：
 *    默认行为：选区从「标题中间」一直拖到「下一个段落」，按删除键时 ProseMirror 会删掉
 *    标题尾部 + 块边界 + 段落头部，于是下个段落整段被并入标题，破坏「第一行恒为标题一」。
 *    策略：
 *    - 若每一块的正文都被完整选中 → 非首块整块 removeBlocks；首块只清 inline，永不删物理首块。
 *    - 若任一块只是部分选中（含 hardBreak 多行块划选时捎带下一块几个字）→ 只删各块内
 *      被选中的 inline，保留所有块壳，避免「想删块 1 文字却整页被掏空」。
 *    - 选区中包含完整选中的中间结构块（如表格、图片、分割线等）时，将该结构块整块 removeBlocks，
 *      首尾两端保留块只删选中的 inline 内容。
 *
 * 2) 单块正文有正长度交集，但选区端点越过了该块 inline 内容边界时（常见于
 *    Shift+Enter / hardBreak 多行块的划选、三击，DOM 选区落到块容器闭边界或下一块
 *    开头、却未覆盖下一块任何正文）：默认 deleteSelection 会连 blockContainer
 *    结构一起删掉，整块消失。此时只删该块内被选中的 inline 内容，保留空壳。
 */

export type BlockHit = {
  id: string;
  /** blockContainer 内容节点（heading/paragraph/table 等）在文档中的起止坐标。 */
  contentFrom: number;
  contentTo: number;
  /** 选区在该内容块内覆盖的区间。 */
  selFrom: number;
  selTo: number;
  isTextblock: boolean;
};

export type SelectionRange = {
  from: number;
  to: number;
};

export type BlockContentRange = {
  from: number;
  to: number;
  isTextblock: boolean;
};

export type BlockLike = {
  id: string;
  children?: BlockLike[];
};

export type FlatBlock = {
  block: BlockLike;
  parentId: string | null;
};

/**
 * 只有选区与块的实际内容有正长度交集时，才认为该块被选中。
 *
 * ProseMirror 的 blockContainer 范围还包含容器开闭边界。文本选区端点正好落在
 * 上一块行尾时，会与该容器范围“有交集”，但并未覆盖其任何正文。
 */
export function hasPositiveBlockContentOverlap(
  selection: SelectionRange,
  content: BlockContentRange,
): boolean {
  if (selection.from >= selection.to) return false;

  if (content.isTextblock) {
    if (content.from < content.to) {
      return (
        Math.max(selection.from, content.from) <
        Math.min(selection.to, content.to)
      );
    }

    // 空文本块没有可覆盖的字符。划选到空列表项时，终点常落在
    // 零宽内容点上；若要求严格跨过（to > contentTo），删除后会留下空编号。
    // 选区闭区间覆盖该点即算选中；塌缩选区已在入口排除。
    return selection.from <= content.from && selection.to >= content.to;
  }

  return (
    Math.max(selection.from, content.from) < Math.min(selection.to, content.to)
  );
}

export function getBlockContentRange(
  node: PMNode,
  pos: number,
): BlockContentRange | null {
  const content = node.firstChild;
  if (!content) return null;

  if (content.isTextblock) {
    const from = pos + 2; // blockContainer(+1) → 内容节点(+1) → inline 首位
    return { from, to: from + content.content.size, isTextblock: true };
  }

  const from = pos + 1; // 非文本块（表格、图片等）按内容节点本身的范围判断。
  return { from, to: from + content.nodeSize, isTextblock: false };
}

/** 收集选区跨越的所有 blockContainer 内容块，及选区在每块内的覆盖区间。 */
export function collectSelectedBlocks(state: EditorState): BlockHit[] {
  if (
    state.selection instanceof CellSelection ||
    (state.selection as any).isCellSelection ||
    state.selection.constructor.name === "CellSelection"
  ) {
    return [];
  }

  const { from, to } = state.selection;
  const hits: BlockHit[] = [];

  state.doc.descendants((node: PMNode, pos: number) => {
    if (node.type.name !== "blockContainer") return true;
    const range = getBlockContentRange(node, pos);
    if (!range) return true;

    if (hasPositiveBlockContentOverlap({ from, to }, range)) {
      hits.push({
        id: String(node.attrs.id),
        contentFrom: range.from,
        contentTo: range.to,
        selFrom: Math.max(from, range.from),
        selTo: Math.min(to, range.to),
        isTextblock: range.isTextblock,
      });
    }
    return true; // 继续下钻，嵌套 blockGroup 中的子块需要独立判断。
  });

  return hits;
}

/**
 * 选区是否「只正重叠一块正文，但端点越过了该块 inline 范围」。
 *
 * 典型场景：
 * - 含 hardBreak 的多行段落被划选到下一块开头（无下一块正文字符）
 * - 选区从上一块行尾贴到本块正文中（默认 deleteSelection 会拆掉块结构）
 *
 * 判定额外要求：$from/$to 不在同一个 textblock 内——两端都在同一 inline
 * 父节点内时默认删除是安全的，不必接管。
 */
export function isOvershootingSingleTextblockSelection(
  state: EditorState,
): boolean {
  if (state.selection.empty) return false;
  if (!(state.selection instanceof TextSelection)) return false;

  const { $from, $to, from, to } = state.selection;
  // 两端同属一个 textblock → 默认 deleteSelection 只删 inline，安全。
  if ($from.parent === $to.parent && $from.parent.isTextblock) return false;

  const hits = collectSelectedBlocks(state);
  if (hits.length !== 1) return false;

  const hit = hits[0];
  if (!hit.isTextblock) return false;
  if (hit.selTo <= hit.selFrom) return false;

  // 端点完全落在该块内容内（理论上与 same-parent 重叠，双保险）
  if (from >= hit.contentFrom && to <= hit.contentTo) return false;

  return true;
}

/**
 * 单块越界选区：只删该块被选中的 inline 内容，保留 block 容器。
 * 避免 hardBreak 多行块划选后按删除把整块删掉。
 */
export function deleteOvershootingSingleBlockSelection(editor: any): boolean {
  const state = editor.prosemirrorState as EditorState;
  if (!isOvershootingSingleTextblockSelection(state)) return false;

  const hits = collectSelectedBlocks(state);
  const hit = hits[0];
  if (!hit || !hit.isTextblock || hit.selTo <= hit.selFrom) return false;

  // 优先走 BlockNote transact（无 mounted view 的单测也可用）；
  // 有 view 时同样由 transact 落到 PM。
  editor.transact((tr: Transaction) => {
    tr.delete(hit.selFrom, hit.selTo);
    try {
      tr.setSelection(
        TextSelection.create(tr.doc, tr.mapping.map(hit.selFrom)),
      );
    } catch {
      /* 映射越界时退回默认选区 */
    }
  });
  return true;
}

export function flattenBlocks(
  blocks: readonly BlockLike[],
  parentId: string | null = null,
): FlatBlock[] {
  return blocks.flatMap((block) => [
    { block, parentId },
    ...flattenBlocks(block.children ?? [], block.id),
  ]);
}

export function hasSelectedAncestor(
  blockId: string,
  selectedIds: Set<string>,
  parentById: Map<string, string | null>,
) {
  let parentId = parentById.get(blockId) ?? null;
  while (parentId) {
    if (selectedIds.has(parentId)) return true;
    parentId = parentById.get(parentId) ?? null;
  }
  return false;
}

/** 选区是否覆盖该块的全部正文/内容（空块能进 hits 即已被严格跨过）。 */
export function isBlockContentFullySelected(hit: {
  contentFrom: number;
  contentTo: number;
  selFrom: number;
  selTo: number;
}): boolean {
  if (hit.contentFrom === hit.contentTo) {
    // 空块：hasPositiveBlockContentOverlap 已要求严格跨过才入选。
    return true;
  }
  return hit.selFrom <= hit.contentFrom && hit.selTo >= hit.contentTo;
}

/** 命中块的选中区间内是否含 hardBreak（Shift+Enter 软换行）。 */
export function hitSelectionContainsHardBreak(
  state: EditorState,
  hit: { selFrom: number; selTo: number },
): boolean {
  if (hit.selTo <= hit.selFrom) return false;
  let found = false;
  state.doc.nodesBetween(hit.selFrom, hit.selTo, (node) => {
    if (node.type.name === "hardBreak") {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

export function dispatchInlineDeletes(
  editor: any,
  state: EditorState,
  hits: BlockHit[],
): boolean {
  const textHits = hits.filter((h) => h.isTextblock && h.selTo > h.selFrom);
  if (textHits.length === 0) return false;

  // 无 mounted view 时（单测）走 transact；有 view 时同样可用。
  let changed = false;
  editor.transact((tr: Transaction) => {
    for (let i = textHits.length - 1; i >= 0; i--) {
      const h = textHits[i];
      tr.delete(h.selFrom, h.selTo);
      changed = true;
    }
    if (!changed) return;
    const caret = tr.mapping.map(textHits[0].selFrom);
    try {
      tr.setSelection(TextSelection.create(tr.doc, caret));
    } catch {
      /* 映射越界时退回默认选区 */
    }
  });
  return changed;
}
