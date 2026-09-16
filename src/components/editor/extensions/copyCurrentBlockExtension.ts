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
import { isGeneratedDataImageName } from "../blocks/image/imageCaption";
import {
  serializeDocRangePlainText,
  serializeSlicePlainText,
} from "../utils/clipboard";

const PLUGIN_KEY = new PluginKey("goose-copy-current-block");

/**
 * 块级复制写入的自定义剪贴板标记。
 * 仅作为旧剪贴板/右键粘贴的兼容回退。正常复制同时写入 `blocknote/html`，
 * 由 BlockNote 原生粘贴保留完整嵌套结构和所有 block props。
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
  return selected.filter(({ pos }) =>
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
function normalizeDataImageCaptionInClipboardDom(dom: HTMLElement): void {
  for (const image of dom.querySelectorAll<HTMLElement>(
    '[data-content-type="image"]',
  )) {
    const url = image.getAttribute("data-url");
    const caption = image.getAttribute("data-caption");
    if (!isGeneratedDataImageName(caption, url)) continue;
    if (!image.getAttribute("data-name")) {
      image.setAttribute("data-name", caption!.trim());
    }
    image.removeAttribute("data-caption");
  }
}

/**
 * 接收端也会遇到未被本扩展接管的部分文本选区，此时 BlockNote 默认 copy 仍会
 * 产生 `blocknote/html`。只改内部 HTML 的默认 data-image caption，保留原 slice
 * 的所有结构和其他属性。
 */
export function normalizeBlockNoteClipboardHtml(html: string): string {
  if (!html || typeof DOMParser === "undefined") return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  const before = document.body.innerHTML;
  normalizeDataImageCaptionInClipboardDom(document.body);
  return document.body.innerHTML === before ? html : document.body.innerHTML;
}

function copySelectionPlainText(
  state: EditorState,
  blockSelection: NodeSelection | Slice,
): string {
  if (blockSelection instanceof NodeSelection) {
    return serializeDocRangePlainText(
      state.doc,
      blockSelection.from,
      blockSelection.to,
    );
  }
  return serializeSlicePlainText(blockSelection);
}

/**
 * 解析 copy 时应走的块级选区：折叠光标提升为当前块、显式 NodeSelection、
 * 或刚好覆盖完整 blockContainer 的文本选区。部分文本选区返回 null，交给默认 copy。
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

  const rootNodes = selectedRootBlockNodes(state, hits);
  if (!rootNodes || rootNodes.length === 0) return null;
  return new Slice(Fragment.from(rootNodes.map(({ node }) => node)), 0, 0);
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
            const blockSelection = resolveCopyBlockSelection(state);
            if (!blockSelection) return false;

            const slice =
              blockSelection instanceof NodeSelection
                ? blockSelection.content()
                : blockSelection;
            const { dom } = view.serializeForClipboard(slice);
            normalizeDataImageCaptionInClipboardDom(dom);
            event.preventDefault();
            clipboard.clearData();
            // 这是 BlockNote 的内部 HTML（含 blockContainer / blockGroup）。
            // 粘贴端优先读取它，UniqueID 扩展会在 paste transaction 中为父子块
            // 分别生成新 ID；不能只靠 text/html 再解析，否则会丢掉结构化 props。
            clipboard.setData("blocknote/html", dom.innerHTML);
            clipboard.setData("text/html", dom.innerHTML);
            clipboard.setData(
              "text/plain",
              copySelectionPlainText(state, blockSelection),
            );
            clipboard.setData(GOOSE_BLOCKNOTE_BLOCK_COPY_MIME, "1");
            return true;
          },
        },
      },
    }),
  ],
});
