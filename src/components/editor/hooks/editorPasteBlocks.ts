import { Fragment, Slice } from "@tiptap/pm/model";
import type { useCreateBlockNote } from "@blocknote/react";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { importMarkdownFragment } from "@/lib/export/markdown/parse";
import { restoreBlockPropsMarkers } from "@/lib/export/markdown/blockPropsMarker";
import { htmlHasNonDefaultGooseBlockAttrs } from "../utils/clipboard";
import { planMultilinePaste } from "../utils/multilinePaste";
import {
  focusPastedBlock,
  isEmptyInlineBlock,
  pasteBlocksAtCursor,
} from "../utils/pasteAtCursor";
import { GOOSE_BLOCKNOTE_BLOCK_COPY_MIME } from "../extensions/copyCurrentBlockExtension";
import { selectionIsInsideFirstTitleBlock } from "../toolbars/formatting/helpers";
import { normalizeParsedImageProps } from "../blocks/image/imageCaption";

export type Editor = ReturnType<typeof useCreateBlockNote>;

export type CachedPasteTarget = {
  id: string;
  type?: string;
  content?: unknown;
};

/** HTML 含非默认 Goose 块级属性或自定义 MIME 时走块级粘贴，行内 strong/span 不算。 */
export function shouldPasteHtmlAsBlocks(
  htmlText: string,
  hasGooseBlockCopyMime = false,
): boolean {
  if (hasGooseBlockCopyMime) return true;
  return htmlHasNonDefaultGooseBlockAttrs(htmlText);
}

export function shouldPasteClipboardAsBlocks(
  clipboard: DataTransfer,
  htmlText: string,
): boolean {
  // `blocknote/html` 是无损内部格式，交回 BlockNote 的默认 paste handler。
  // 此处不能把它和旧 Goose MIME 一样转为普通 HTML，否则列表 children / 媒体 props
  // 会经有损解析链路折返。
  if (clipboard.getData("blocknote/html")) return false;
  if (clipboard.getData(GOOSE_BLOCKNOTE_BLOCK_COPY_MIME)) return true;
  return shouldPasteHtmlAsBlocks(htmlText);
}

/** plain 含 Goose 块属性标记或 style 颜色 span 时优先 importMarkdownFragment。 */
export function plainHasGooseMarkdownMarkers(plain: string): boolean {
  return (
    /goose-note:block-props|data-goose-note-block-props/i.test(plain) ||
    /<span[^>]*style\s*=/i.test(plain)
  );
}

export function cachePasteTarget(editor: Editor): CachedPasteTarget | null {
  try {
    const block = editor.getTextCursorPosition().block;
    return { id: block.id, type: block.type, content: block.content };
  } catch {
    return null;
  }
}

export function resolvePasteAnchor(
  editor: { getBlock: (id: string) => unknown },
  target: CachedPasteTarget,
): CachedPasteTarget {
  return (
    (editor.getBlock(target.id) as CachedPasteTarget | undefined) ?? target
  );
}

export function finishPasteAtAnchor(
  editor: Editor,
  blocks: unknown[],
  target: CachedPasteTarget,
): boolean {
  const anchor = resolvePasteAnchor(editor, target);
  const last = pasteBlocksAtCursor(editor, blocks, anchor);
  if (last) focusPastedBlock(editor, last);
  return last !== null;
}

/** 剪贴板 HTML 带有源块 ID；粘贴是副本，需由编辑器重新分配块 ID。 */
export function withoutCopiedBlockIds(blocks: unknown[]): unknown[] {
  return blocks.map((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block))
      return block;
    const copy = { ...(block as Record<string, unknown>) };
    delete copy.id;
    if (copy.type === "image" && copy.props && typeof copy.props === "object") {
      copy.props = normalizeParsedImageProps(
        copy.props as Record<string, unknown>,
      );
    }
    if (Array.isArray(copy.children)) {
      copy.children = withoutCopiedBlockIds(copy.children);
    }
    return copy;
  });
}

/** 原生粘贴由我们接管时，与 UniqueID 默认 transformPasted 一样清空容器 ID。 */
export function withoutBlockNoteClipboardIds(html: string): string {
  if (!html || typeof DOMParser === "undefined") return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const block of document.querySelectorAll<HTMLElement>(
    '[data-node-type="blockContainer"]',
  )) {
    block.removeAttribute("data-id");
    block.removeAttribute("id");
  }
  return document.body.innerHTML;
}

export async function pasteClipboardHtmlAsBlocks(
  editor: Editor,
  htmlText: string,
  target: CachedPasteTarget,
): Promise<boolean> {
  let blocks: unknown[];
  try {
    blocks = await editor.tryParseHTMLToBlocks(htmlText);
  } catch {
    blocks = [];
  }
  if (!blocks || blocks.length === 0) return false;
  return finishPasteAtAnchor(editor, withoutCopiedBlockIds(blocks), target);
}

export function tryPasteGooseMarkdownFragment(
  editor: Editor,
  plainText: string,
  target: CachedPasteTarget,
): boolean {
  const fragment = importMarkdownFragment(plainText);
  if (!fragment || fragment.length === 0) return false;
  const restored = restoreBlockPropsMarkers(fragment as BlockNoteContent);
  return finishPasteAtAnchor(editor, restored, target);
}
/**
 * 是否走「标题一隔离粘贴」：仅当选区完全落在物理首块 H1 内时。
 *
 * 旧逻辑用 `cursorBlock.id === document[0].id`，会把小窗 raw 首段、多 block 选区
 * （选区锚点落在首块）都误判成标题，于是 insertBlocks 在下方追加而不替换选区。
 * 跨块选区 / 非 H1 首块必须返回 false，让默认粘贴替换当前选区。
 */
export function shouldIsolateTitleStructurePaste(editor: {
  prosemirrorState: Editor["prosemirrorState"];
}): boolean {
  return selectionIsInsideFirstTitleBlock(editor as Editor);
}

export function isMultiBlockTextSelection(editor: Editor): boolean {
  try {
    return (editor.getSelection()?.blocks?.length ?? 0) > 1;
  } catch {
    return false;
  }
}

export function getCursorBlockType(editor: Editor): string | null {
  try {
    return editor.getTextCursorPosition().block.type ?? null;
  } catch {
    return null;
  }
}

export function insertPlainInline(editor: Editor, text: string) {
  const pmState = editor.prosemirrorState;
  const schema = pmState.schema;
  const nodes = text.length > 0 ? [schema.text(text)] : [];
  const slice = new Slice(Fragment.fromArray(nodes), 0, 0);
  editor.prosemirrorView.dispatch(
    pmState.tr.replaceSelection(slice).scrollIntoView(),
  );
}

export function pasteLinesAsBlocks(
  editor: Editor,
  lines: string[],
  currentBlockType: string | null,
) {
  const { firstLine, restBlocks } = planMultilinePaste(lines, currentBlockType);
  const current = editor.getTextCursorPosition().block;

  // 空行粘贴：当前块为空且首行为空时，直接替换/插入后续块，不留空段落。
  if (
    isEmptyInlineBlock(current) &&
    firstLine === "" &&
    restBlocks.length > 0
  ) {
    const last = pasteBlocksAtCursor(editor, restBlocks, current);
    if (last) focusPastedBlock(editor, last);
    return;
  }

  const pmState = editor.prosemirrorState;
  if (firstLine) {
    editor.prosemirrorView.dispatch(
      pmState.tr.insertText(firstLine).scrollIntoView(),
    );
  } else if (pmState.selection.from !== pmState.selection.to) {
    editor.prosemirrorView.dispatch(
      pmState.tr.deleteSelection().scrollIntoView(),
    );
  }
  if (restBlocks.length === 0) return;

  const anchor = editor.getTextCursorPosition().block;
  const last = pasteBlocksAtCursor(editor, restBlocks, anchor);
  if (last) focusPastedBlock(editor, last);
}
