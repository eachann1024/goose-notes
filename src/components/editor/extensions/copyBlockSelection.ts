import { Fragment, Slice, type Node as PMNode } from "prosemirror-model";
import {
  NodeSelection,
  TextSelection,
  type EditorState,
} from "prosemirror-state";
import { CellSelection } from "prosemirror-tables";
import { collectSelectedBlocks, type BlockHit } from "./crossBlockSelection";
import { isWholeTableCellSelection } from "../utils/selection";

/** 折叠光标提升为当前 BlockNote blockContainer，已有文本选区则保持原样。 */
export function getCurrentBlockNodeSelection(
  state: EditorState,
): NodeSelection | null {
  if (!state.selection.empty) return null;

  const $from = state.selection.$from;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name !== "blockContainer") continue;
    const pos = $from.before(depth);
    const node = state.doc.nodeAt(pos);
    if (!node || !NodeSelection.isSelectable(node)) return null;
    return NodeSelection.create(state.doc, pos);
  }
  return null;
}

function isBlockFullySelected(hit: BlockHit): boolean {
  return hit.selFrom === hit.contentFrom && hit.selTo === hit.contentTo;
}

function findBlockContainerPosById(
  state: EditorState,
  blockId: string,
): number | null {
  let found: number | null = null;
  state.doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer") return true;
    if (String(node.attrs.id) !== blockId) return true;
    found = pos;
    return false;
  });
  return found;
}

type SelectedBlockNode = {
  node: PMNode;
  pos: number;
};

/**
 * 多块选区可能同时命中父待办和 children 中的图片。父 blockContainer 已经携带
 * 完整 children 树，若再把子块作为并列 slice child 写入，粘贴后会生成重复节点，
 * 进而让 React NodeView 找不到稳定位置。只序列化没有已选祖先的根块。
 */
function selectedRootBlockNodes(
  state: EditorState,
  hits: readonly BlockHit[],
): SelectedBlockNode[] | null {
  const selected: SelectedBlockNode[] = [];
  for (const hit of hits) {
    const pos = findBlockContainerPosById(state, hit.id);
    if (pos == null) return null;
    const node = state.doc.nodeAt(pos);
    if (!node) return null;
    selected.push({ node, pos });
  }
  return selected.filter(
    ({ pos }) =>
      !selected.some(
        ({ node: candidateAncestor, pos: ancestorPos }) =>
          ancestorPos < pos && pos < ancestorPos + candidateAncestor.nodeSize,
      ),
  );
}

/**
 * 原生内部 HTML 不会经过 customImageBlock 的外部 HTML parse。复制时在无损
 * slice 的 DOM 边界处理剪贴板默认文件名，避免 `image.png` 被当作 caption。
 * 显式说明、宽度和其他属性保持原样。
 */
/** 整块复制必须保留结构，否则表格/代码/媒体会塌成空文本。 */
export const STRUCTURED_COPY_CONTENT_TYPES = new Set([
  "table",
  "codeBlock",
  "image",
  "video",
  "file",
  "divider",
  "audio",
]);

function blockContainerContentType(node: PMNode): string | null {
  const content = node.type.name === "blockContainer" ? node.firstChild : node;
  return content?.type.name ?? null;
}

function isStructuredCopyBlock(node: PMNode): boolean {
  const type = blockContainerContentType(node);
  return type != null && STRUCTURED_COPY_CONTENT_TYPES.has(type);
}

function blockContainerHasChildBlocks(node: PMNode): boolean {
  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    if (child.type.name !== "blockGroup") continue;
    for (let j = 0; j < child.childCount; j += 1) {
      if (child.child(j).type.name === "blockContainer") return true;
    }
  }
  return false;
}

function shouldKeepSingleBlockFormatting(node: PMNode): boolean {
  return isStructuredCopyBlock(node) || blockContainerHasChildBlocks(node);
}

export function getTableBlockContainerSelection(
  state: EditorState,
): NodeSelection | null {
  const selection = state.selection;
  if (!(selection instanceof CellSelection)) return null;
  const $cell = selection.$anchorCell;
  for (let depth = $cell.depth; depth > 0; depth -= 1) {
    if ($cell.node(depth).type.name !== "blockContainer") continue;
    const pos = $cell.before(depth);
    const node = state.doc.nodeAt(pos);
    if (!node || !NodeSelection.isSelectable(node)) return null;
    return NodeSelection.create(state.doc, pos);
  }
  return null;
}

export function shouldCopyClipboardWithFormatting(state: EditorState): boolean {
  const { selection } = state;
  if (selection.empty) {
    const current = getCurrentBlockNodeSelection(state);
    return current ? shouldKeepSingleBlockFormatting(current.node) : false;
  }
  if (selection instanceof CellSelection) {
    return isWholeTableCellSelection(state);
  }
  if (selection instanceof NodeSelection) {
    if (selection.node.type.name === "blockContainer") {
      return shouldKeepSingleBlockFormatting(selection.node);
    }
    return false;
  }
  const hits = collectSelectedBlocks(state);
  if (hits.length > 1) return true;
  if (hits.length !== 1 || !isBlockFullySelected(hits[0])) return false;
  const pos = findBlockContainerPosById(state, hits[0].id);
  if (pos == null) return false;
  const node = state.doc.nodeAt(pos);
  // 只划父块正文时仍是单块纯文本；带子树由折叠光标 / NodeSelection 整块复制。
  return node ? isStructuredCopyBlock(node) : false;
}

/**
 * 解析 copy 时应走的块级选区：折叠光标提升为当前块、显式 NodeSelection、
 * 或刚好覆盖完整 blockContainer 的文本选区。部分文本选区返回 null。
 * 是否写入 HTML 由 shouldCopyClipboardWithFormatting 决定，不由本函数单独决定。
 */
export function resolveCopyBlockSelection(
  state: EditorState,
): NodeSelection | Slice | null {
  const { selection } = state;
  if (selection.empty) return getCurrentBlockNodeSelection(state);

  if (selection instanceof NodeSelection) {
    if (selection.node.type.name === "blockContainer") return selection;
    return null;
  }

  if (selection instanceof CellSelection) {
    return isWholeTableCellSelection(state)
      ? getTableBlockContainerSelection(state)
      : null;
  }

  if (!(selection instanceof TextSelection)) return null;

  const hits = collectSelectedBlocks(state);
  if (hits.length === 0) return null;

  // 鼠标划选常会越过块边界；多个块只要命中了，就按这些块写格式，
  // 不要因为 from/to 不是刚好贴齐正文而退回纯文本。
  if (hits.length > 1) {
    const rootNodes = selectedRootBlockNodes(state, hits);
    if (!rootNodes || rootNodes.length === 0) return null;
    return new Slice(Fragment.from(rootNodes.map(({ node }) => node)), 0, 0);
  }

  if (!isBlockFullySelected(hits[0])) return null;

  const pos = findBlockContainerPosById(state, hits[0].id);
  if (pos == null) return null;
  const node = state.doc.nodeAt(pos);
  if (!node || !NodeSelection.isSelectable(node)) return null;
  return NodeSelection.create(state.doc, pos);
}
