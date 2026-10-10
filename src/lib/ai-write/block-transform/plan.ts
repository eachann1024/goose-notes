import {
  cloneValue,
  getBlockTypeTransformSignature,
  type BlockTypeTransformSelectionSnapshot,
  type BlockTypeTransformBlock,
  type BlockTypeTransformIntent,
  type BlockTypeTransformPlan,
} from "./types";
import { assertValidIntent, getBlockTypeTransformTargetLabel } from "./intent";
import {
  validateSourceBlocks,
  splitBlockContent,
  createReplacementBlock,
  assertReplacementStructure,
} from "./content";

export function planBlockTypeTransform(
  snapshot: BlockTypeTransformSelectionSnapshot,
  currentBlocks: BlockTypeTransformBlock[],
  intent: BlockTypeTransformIntent = { blockType: "checkListItem" },
): BlockTypeTransformPlan {
  assertValidIntent(intent);
  const targetLabel = getBlockTypeTransformTargetLabel(intent);
  if (!snapshot.wholeBlocks) {
    throw new Error(
      `${targetLabel}转换需要选择完整的内容块，请从行首重新选择到行尾。`,
    );
  }

  const startIndex = currentBlocks.findIndex(
    (block) => block.id === snapshot.startBlockId,
  );
  const endIndex = currentBlocks.findIndex(
    (block) => block.id === snapshot.endBlockId,
  );
  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error(`${targetLabel}转换的目标块已变化，请重新选择后再试。`);
  }

  const sourceBlocks = currentBlocks.slice(startIndex, endIndex + 1);
  if (
    sourceBlocks.length !== snapshot.blocks.length ||
    getBlockTypeTransformSignature(sourceBlocks) !== snapshot.signature
  ) {
    throw new Error(`${targetLabel}转换的目标内容已变化，请重新选择后再试。`);
  }
  validateSourceBlocks(sourceBlocks, targetLabel);

  const splitsHardLines = [
    "bulletListItem",
    "numberedListItem",
    "checkListItem",
  ].includes(intent.blockType);
  const replacementBlocks = sourceBlocks.flatMap((block) => {
    const contents = splitsHardLines
      ? splitBlockContent(block.content)
      : [block.content ?? ""];
    return contents.map((content) =>
      createReplacementBlock(block, content, intent),
    );
  });
  if (!replacementBlocks.length) {
    throw new Error(`没有可转换为${targetLabel}的非空内容。`);
  }
  assertReplacementStructure(replacementBlocks, intent);

  return {
    startBlockId: snapshot.startBlockId,
    endBlockId: snapshot.endBlockId,
    sourceBlockIds: sourceBlocks.map((block) => block.id as string),
    replacementBlocks,
    convertedCount: replacementBlocks.length,
    target: cloneValue(intent),
  };
}
