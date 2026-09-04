import { createExtension } from "@blocknote/core";
import { Fragment, Slice, type Node as PMNode } from "prosemirror-model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
} from "prosemirror-state";

import {
  collectSelectedBlocks,
  type BlockHit,
} from "./crossBlockDeleteExtension";

const PLUGIN_KEY = new PluginKey("goose-copy-current-block");

/**
 * 块级复制写入的自定义剪贴板标记。
 * 粘贴侧（useEditorPaste）读到它即说明 text/html 是块级结构，必须交
 * BlockNote 默认 HTML 粘贴还原内联格式与块类型，绝不能走「多行拆块/纯文本」逻辑。
 */
export const GOOSE_BLOCKNOTE_BLOCK_COPY_MIME =
  "application/x-goose-blocknote-block";

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

/**
 * 解析 copy 时应走的块级选区：显式 NodeSelection、或刚好覆盖完整 blockContainer 的文本选区。
 * 折叠光标返回 null（copy handler 应 preventDefault，不写剪贴板）。
 */
export function resolveCopyBlockSelection(
  state: EditorState,
): NodeSelection | Slice | null {
  const { selection } = state;
  if (selection.empty) return null;

  if (selection instanceof NodeSelection) {
    if (selection.node.type.name === "blockContainer") return selection;
    return null;
  }

  if (!(selection instanceof TextSelection)) return null;

  const hits = collectSelectedBlocks(state);
  if (hits.length === 0 || !hits.every(isBlockFullySelected)) return null;

  const { from, to } = selection;
  if (from !== hits[0].contentFrom || to !== hits[hits.length - 1].contentTo) {
    return null;
  }

  if (hits.length === 1) {
    const pos = findBlockContainerPosById(state, hits[0].id);
    if (pos == null) return null;
    const node = state.doc.nodeAt(pos);
    if (!node || !NodeSelection.isSelectable(node)) return null;
    return NodeSelection.create(state.doc, pos);
  }

  const blockNodes: PMNode[] = [];
  for (const hit of hits) {
    const pos = findBlockContainerPosById(state, hit.id);
    if (pos == null) return null;
    const node = state.doc.nodeAt(pos);
    if (!node) return null;
    blockNodes.push(node);
  }
  return new Slice(Fragment.from(blockNodes), 0, 0);
}

export const gooseCopyCurrentBlockExtension = createExtension({
  key: "goose-copy-current-block",
  prosemirrorPlugins: [
    new Plugin({
      key: PLUGIN_KEY,
      props: {
        handleDOMEvents: {
          copy(view, event) {
            if (event.defaultPrevented) return false;
            const clipboard = event.clipboardData;
            if (!clipboard) return false;

            const { state } = view;
            if (state.selection.empty) {
              event.preventDefault();
              return true;
            }

            const blockSelection = resolveCopyBlockSelection(state);
            if (!blockSelection) return false;

            const slice =
              blockSelection instanceof NodeSelection
                ? blockSelection.content()
                : blockSelection;
            const { dom, text } = view.serializeForClipboard(slice);
            event.preventDefault();
            clipboard.clearData();
            clipboard.setData("text/html", dom.innerHTML);
            clipboard.setData("text/plain", text);
            clipboard.setData(GOOSE_BLOCKNOTE_BLOCK_COPY_MIME, "1");
            return true;
          },
        },
      },
    }),
  ],
});
