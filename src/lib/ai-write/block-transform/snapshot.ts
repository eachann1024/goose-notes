import {
  cloneValue,
  getBlockTypeTransformSignature,
  type BlockTypeTransformBlock,
  type BlockTypeTransformSelectionSnapshot,
  type BlockTypeTransformEditor,
} from "./types";

function sameSelectedContent(
  cutBlocks: BlockTypeTransformBlock[],
  fullBlocks: BlockTypeTransformBlock[],
) {
  if (cutBlocks.length !== fullBlocks.length) return false;
  return cutBlocks.every((cutBlock, index) => {
    const fullBlock = fullBlocks[index];
    return (
      cutBlock.id === fullBlock?.id &&
      cutBlock.type === fullBlock?.type &&
      JSON.stringify(cutBlock.content ?? "") ===
        JSON.stringify(fullBlock?.content ?? "")
    );
  });
}

export function createBlockTypeTransformSelectionSnapshot(
  editor: BlockTypeTransformEditor,
  options: { pageId: string; protectFirstTitle?: boolean },
): BlockTypeTransformSelectionSnapshot {
  const cut = editor.getSelectionCutBlocks(false);
  const fullSelection = editor.getSelection();
  const cutBlocks = (cut?.blocks ?? []) as BlockTypeTransformBlock[];
  const fullBlocks = (fullSelection?.blocks ?? []) as BlockTypeTransformBlock[];
  const editorDocument = (editor.document ?? []) as BlockTypeTransformBlock[];
  const blocks = cloneValue(fullBlocks.length ? fullBlocks : cutBlocks);
  if (!blocks.length) throw new Error("请先选择要转换的内容。");

  if (
    options.protectFirstTitle !== false &&
    blocks.some(
      (block) =>
        block.id === editorDocument[0]?.id &&
        block.type === "heading" &&
        block.props?.level === 1,
    )
  ) {
    throw new Error("页面标题不能参与块类型转换。");
  }

  const startBlockId = blocks[0]?.id;
  const endBlockId = blocks[blocks.length - 1]?.id;
  if (!startBlockId || !endBlockId) {
    throw new Error("无法定位选区块，请重新选择后再试。");
  }

  return {
    version: 1,
    pageId: options.pageId,
    startBlockId,
    endBlockId,
    blocks,
    signature: getBlockTypeTransformSignature(blocks),
    wholeBlocks: sameSelectedContent(cutBlocks, blocks),
  };
}

export function createPageBodyBlockTypeTransformSnapshot(
  pageId: string,
  pageBlocks: BlockTypeTransformBlock[],
  options: { protectFirstTitle?: boolean } = {},
): BlockTypeTransformSelectionSnapshot {
  const blocks = cloneValue(pageBlocks);
  if (
    options.protectFirstTitle !== false &&
    blocks[0]?.type === "heading" &&
    blocks[0]?.props?.level === 1
  ) {
    blocks.shift();
  }
  if (!blocks.length) throw new Error("当前页面没有可转换的正文块。");
  const startBlockId = blocks[0]?.id;
  const endBlockId = blocks[blocks.length - 1]?.id;
  if (!startBlockId || !endBlockId) {
    throw new Error("当前页面正文缺少块标识，无法安全转换。");
  }
  return {
    version: 1,
    pageId,
    startBlockId,
    endBlockId,
    blocks,
    signature: getBlockTypeTransformSignature(blocks),
    wholeBlocks: true,
  };
}

export function isBlockTypeTransformSelectionSnapshot(
  value: unknown,
): value is BlockTypeTransformSelectionSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BlockTypeTransformSelectionSnapshot>;
  return (
    candidate.version === 1 &&
    typeof candidate.pageId === "string" &&
    typeof candidate.startBlockId === "string" &&
    typeof candidate.endBlockId === "string" &&
    typeof candidate.signature === "string" &&
    typeof candidate.wholeBlocks === "boolean" &&
    Array.isArray(candidate.blocks)
  );
}
