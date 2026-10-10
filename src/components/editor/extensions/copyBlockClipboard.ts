import { Slice } from "prosemirror-model";
import { NodeSelection, type EditorState } from "prosemirror-state";
import type { EditorView } from "@tiptap/pm/view";
import { CellSelection } from "prosemirror-tables";
import { isGeneratedDataImageName } from "../blocks/image/imageCaption";
import {
  getEditorSelectionPlainText,
  serializeDocRangePlainText,
  serializeSlicePlainText,
} from "../utils/clipboard";
import {
  getSelectedCellPlainText,
  getSelectedImageUrl,
  isWholeTableCellSelection,
} from "../utils/selection";
import {
  getCurrentBlockNodeSelection,
  shouldCopyClipboardWithFormatting,
  resolveCopyBlockSelection,
  getTableBlockContainerSelection,
} from "./copyBlockSelection";
/**
 * 块级复制写入的自定义剪贴板标记。
 * 仅作为旧剪贴板/右键粘贴的兼容回退。正常复制同时写入 `blocknote/html`，
 * 由 BlockNote 原生粘贴保留完整嵌套结构和所有 block props。
 */
export const GOOSE_BLOCKNOTE_BLOCK_COPY_MIME =
  "application/x-goose-blocknote-block";
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
  includeBlockMarkers = false,
): string {
  const options = includeBlockMarkers
    ? { includeBlockMarkers: true }
    : undefined;
  if (blockSelection instanceof NodeSelection) {
    return serializeDocRangePlainText(
      state.doc,
      blockSelection.from,
      blockSelection.to,
      options,
    );
  }
  return serializeSlicePlainText(blockSelection, options);
}

function writePlainClipboard(clipboard: DataTransfer, plain: string): void {
  clipboard.clearData();
  clipboard.setData("text/plain", plain);
}

function writeFormattedClipboard(
  clipboard: DataTransfer,
  html: string,
  plain: string,
): void {
  clipboard.clearData();
  // 这是 BlockNote 的内部 HTML（含 blockContainer / blockGroup）。
  // 粘贴端优先读取它，UniqueID 扩展会在 paste transaction 中为父子块
  // 分别生成新 ID；不能只靠 text/html 再解析，否则会丢掉结构化 props。
  clipboard.setData("blocknote/html", html);
  clipboard.setData("text/html", html);
  clipboard.setData("text/plain", plain);
  clipboard.setData(GOOSE_BLOCKNOTE_BLOCK_COPY_MIME, "1");
}

/**
 * 把当前选区写入剪贴板。图片 / 部分单元格交给 Editor 容器监听器。
 * 折叠光标复制当前块；剪切空选区不处理，避免 Cmd+X 变成复制。
 */
export function writeSelectionClipboard(
  view: EditorView,
  event: ClipboardEvent,
): boolean {
  if (event.defaultPrevented) return false;
  const clipboard = event.clipboardData;
  if (!clipboard) return false;

  const { state } = view;
  if (getSelectedImageUrl(state)) return false;
  if (
    getSelectedCellPlainText(state) != null &&
    !isWholeTableCellSelection(state)
  ) {
    return false;
  }

  if (!shouldCopyClipboardWithFormatting(state)) {
    let plain: string;
    if (state.selection.empty) {
      const current = getCurrentBlockNodeSelection(state);
      if (!current) return false;
      plain = copySelectionPlainText(state, current);
    } else {
      plain = getEditorSelectionPlainText(state);
    }
    event.preventDefault();
    writePlainClipboard(clipboard, plain);
    return true;
  }

  const resolved = resolveCopyBlockSelection(state);
  const blockSelection = resolved ?? state.selection.content();
  const slice =
    blockSelection instanceof NodeSelection
      ? blockSelection.content()
      : blockSelection;
  if (slice.size === 0) return false;
  const { dom } = view.serializeForClipboard(slice);
  normalizeDataImageCaptionInClipboardDom(dom);
  event.preventDefault();
  writeFormattedClipboard(
    clipboard,
    dom.innerHTML,
    copySelectionPlainText(state, blockSelection, true),
  );
  return true;
}

export function deleteCutSelection(view: EditorView): void {
  const { state } = view;
  if (state.selection.empty) return;
  if (
    state.selection instanceof CellSelection &&
    isWholeTableCellSelection(state)
  ) {
    const tableSel = getTableBlockContainerSelection(state);
    if (tableSel) {
      view.dispatch(state.tr.setSelection(tableSel).deleteSelection());
      return;
    }
  }
  view.dispatch(state.tr.deleteSelection());
}
