import type { EditorState } from "@tiptap/pm/state";
import { CellSelection } from "prosemirror-tables";
import {
  collectSelectedBlocks,
  deleteOvershootingSingleBlockSelection,
  flattenBlocks,
  hasSelectedAncestor,
  isBlockContentFullySelected,
  hitSelectionContainsHardBreak,
  dispatchInlineDeletes,
  type BlockLike,
} from "./crossBlockSelection";
export function deleteSelectedBlocks(editor: any): boolean {
  const state = editor.prosemirrorState as EditorState;
  if (state.selection.empty) return false;

  // 表格内部单元格选区交给 ProseMirror-tables 原生处理
  if (
    state.selection instanceof CellSelection ||
    (state.selection as any).isCellSelection ||
    state.selection.constructor.name === "CellSelection"
  ) {
    return false;
  }

  // hardBreak 多行块等：选区越出单块 inline 边界但未真正选中第二块正文时，
  // 先钳制为块内删除，避免默认 deleteSelection 拆掉整个 blockContainer。
  if (deleteOvershootingSingleBlockSelection(editor)) return true;

  const hits = collectSelectedBlocks(state);
  if (hits.length < 2) return false;

  // BlockNote getSelection() 会把仅接触容器边界的端点块也算进 blocks；
  // 这里必须以 PM 内容区间的正长度交集为准。
  const selectedBlocks = hits
    .map((h) => editor.getBlock?.(h.id))
    .filter(Boolean);
  if (selectedBlocks.length < 2) return false;

  const firstBlockId = editor.document[0]?.id as string | undefined;
  if (!firstBlockId) return false;

  const flat = flattenBlocks(editor.document as BlockLike[]);
  const flatIndexById = new Map(
    flat.map((item, index) => [item.block.id, index]),
  );
  const parentById = new Map(
    flat.map((item) => [item.block.id, item.parentId]),
  );
  const selectedIds = new Set<string>(
    selectedBlocks.map((block: BlockLike) => block.id),
  );

  const allHitsFullySelected = hits.every(isBlockContentFullySelected);
  // hardBreak 多行块保护：当且仅当正好选中两个文本块且其中之一含 hardBreak 时，保留两块块壳
  const hasTwoTextblocksWithHardbreak =
    !allHitsFullySelected &&
    hits.length === 2 &&
    hits.every((h) => h.isTextblock) &&
    hits.some((h) => hitSelectionContainsHardBreak(state, h));

  const hitMap = new Map(hits.map((h) => [h.id, h]));

  const blocksToRemove = selectedBlocks.filter((block: BlockLike) => {
    // 物理首块永远不整体删除（保持第一行为标题）
    if (block.id === firstBlockId) return false;
    // 祖先块已在删除列表中时不单独重复删除
    if (hasSelectedAncestor(block.id, selectedIds, parentById)) return false;

    const hit = hitMap.get(block.id);
    if (!hit) return false;

    // 非文本块（表格、图片、分割线等）：只要被完整覆盖，一律整块删除
    if (!hit.isTextblock) {
      return isBlockContentFullySelected(hit);
    }

    // 文本块：仅在完整选中且未受 hardBreak 保护时整块删除
    if (hasTwoTextblocksWithHardbreak) return false;
    if (!allHitsFullySelected && hitSelectionContainsHardBreak(state, hit))
      return false;
    return isBlockContentFullySelected(hit);
  });

  const removeIds = new Set<string>(
    blocksToRemove.map((block: BlockLike) => block.id),
  );

  // 未被整块 remove 的文本块中，需要清空选中的 inline 部分
  const hitsToClear = hits.filter((h) => !removeIds.has(h.id) && h.isTextblock);

  if (blocksToRemove.length === 0 && hitsToClear.length === 0) {
    return false;
  }

  // 1. 先清空保留块中被选中的 inline 内容
  if (hitsToClear.length > 0) {
    dispatchInlineDeletes(editor, state, hitsToClear);
  }

  // 2. 若有需要整块删除的块，执行 removeBlocks 并定位光标
  if (blocksToRemove.length > 0) {
    const firstRemoveIndex = Math.min(
      ...blocksToRemove.map(
        (block: BlockLike) => flatIndexById.get(block.id) ?? Infinity,
      ),
    );
    const lastRemoveIndex = Math.max(
      ...blocksToRemove.map(
        (block: BlockLike) => flatIndexById.get(block.id) ?? -1,
      ),
    );

    const isRemovedOrInsideRemoved = (blockId: string) =>
      removeIds.has(blockId) ||
      hasSelectedAncestor(blockId, removeIds, parentById);

    const prevTarget = flat
      .slice(0, firstRemoveIndex)
      .reverse()
      .find((item) => !isRemovedOrInsideRemoved(item.block.id))?.block;
    const nextTarget = flat
      .slice(lastRemoveIndex + 1)
      .find((item) => !isRemovedOrInsideRemoved(item.block.id))?.block;

    editor.transact(() => {
      editor.removeBlocks(blocksToRemove);
      if (prevTarget) {
        editor.setTextCursorPosition(prevTarget, "end");
      } else if (nextTarget) {
        editor.setTextCursorPosition(nextTarget, "start");
      }
    });
  }

  return true;
}
