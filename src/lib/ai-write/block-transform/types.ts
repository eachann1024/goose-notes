import type { PartialBlock } from "@blocknote/core";

export type BlockTypeTransformTarget =
  | "paragraph"
  | "heading"
  | "bulletListItem"
  | "numberedListItem"
  | "checkListItem"
  | "quote"
  | "codeBlock";

export interface BlockTypeTransformBlock {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: BlockTypeTransformBlock[];
}

export interface BlockTypeTransformIntent {
  blockType: BlockTypeTransformTarget;
  headingLevel?: 1 | 2 | 3;
}

export interface BlockTypeTransformSelectionSnapshot {
  version: 1;
  pageId: string;
  startBlockId: string;
  endBlockId: string;
  blocks: BlockTypeTransformBlock[];
  signature: string;
  wholeBlocks: boolean;
}

export interface BlockTypeTransformPanelOpenDetail {
  version: 1;
  pageId: string;
  selection: BlockTypeTransformSelectionSnapshot;
}

export interface BlockTypeTransformPlan {
  startBlockId: string;
  endBlockId: string;
  sourceBlockIds: string[];
  replacementBlocks: PartialBlock[];
  convertedCount: number;
  target: BlockTypeTransformIntent;
}

export interface BlockTypeTransformResult {
  ok: true;
  convertedCount: number;
  target: BlockTypeTransformIntent;
}

export interface BlockTypeTransformEditor {
  readonly document?: unknown[];
  getSelectionCutBlocks: (expandToWords?: boolean) => { blocks?: unknown[] };
  getSelection: () => { blocks?: unknown[] } | undefined;
  transact: (callback: () => void) => unknown;
  replaceBlocks: (
    sourceBlockIds: string[],
    replacementBlocks: PartialBlock[],
  ) => unknown;
}

export function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function comparableBlock(block: BlockTypeTransformBlock) {
  return {
    id: block.id,
    type: block.type,
    props: block.props ?? {},
    content: block.content ?? "",
    children: block.children ?? [],
  };
}

export function getBlockTypeTransformSignature(
  blocks: BlockTypeTransformBlock[],
) {
  return JSON.stringify(blocks.map(comparableBlock));
}
