import { normalizeBlockNoteClipboardHtml } from "../extensions/copyCurrentBlockExtension";
import { htmlLooksLikeBlockNoteClipboard } from "../utils/multilinePaste";
import { looksLikeBlockStructure } from "../utils/clipboard";
import { isEmptyInlineBlock, focusPastedBlock } from "../utils/pasteAtCursor";
import {
  cachePasteTarget,
  shouldIsolateTitleStructurePaste,
  shouldPasteClipboardAsBlocks,
  pasteClipboardHtmlAsBlocks,
  withoutCopiedBlockIds,
  withoutBlockNoteClipboardIds,
  type Editor,
} from "./editorPasteBlocks";

export function handleEditorStructurePaste(
  editor: Editor,
  event: React.ClipboardEvent<HTMLDivElement>,
  plainText: string,
  htmlText: string,
): boolean {
  const clipboard = event.clipboardData;
  const nativeBlockNoteHtml = clipboard.getData("blocknote/html");
  const recoveredBlockNoteHtml =
    nativeBlockNoteHtml ||
    (htmlLooksLikeBlockNoteClipboard(htmlText) ? htmlText : "");
  const normalizedBlockNoteHtml = normalizeBlockNoteClipboardHtml(
    recoveredBlockNoteHtml,
  );
  // ===== 标题一隔离：仅当选区完全落在「物理首块 H1」内时 =====
  // 标题一必须保持独立(恒为物理首块 H1、不被注入图片/列表/代码等结构)。
  // 默认粘贴会把图片等结构块塞成标题一的 children(实测 depth=1)，破坏其独立性。
  // 处理：标题内粘贴「非纯文本的块结构」时，拦截默认，把内容解析成块插到标题下方。
  // 注意：小窗 raw 首块不是 H1；跨块选区也不走此路径（见 shouldIsolateTitleStructurePaste）。
  // 纯文本(单行)不拦截 → 照常注入标题文字。
  //
  // 多 block 选区（含小窗全选后粘贴）必须交给默认粘贴，用剪贴板内容替换选区，
  // 绝不能 insertBlocks 追加，否则会出现「选中内容还在、下面又贴了一份」。
  {
    if (
      shouldIsolateTitleStructurePaste(editor) &&
      looksLikeBlockStructure(plainText, htmlText)
    ) {
      event.preventDefault();
      event.stopPropagation();
      void (async () => {
        let blocks: any[] = [];
        try {
          // 标题一不能接收结构块。这里仍从原生内部 HTML 解析为 Blocks，
          // 再把完整树插到标题下方；普通位置则直接走下方无损原生粘贴。
          if (normalizedBlockNoteHtml && normalizedBlockNoteHtml.trim()) {
            blocks = await editor.tryParseHTMLToBlocks(normalizedBlockNoteHtml);
          } else if (htmlText && htmlText.trim()) {
            blocks = await editor.tryParseHTMLToBlocks(htmlText);
          } else if (plainText) {
            blocks = await editor.tryParseMarkdownToBlocks(plainText);
          }
        } catch {
          blocks = [];
        }
        if (!blocks || blocks.length === 0) return true;
        const titleBlock = editor.document[0];
        if (!titleBlock) return true;
        // 直接插到标题之后；原有正文顺移，不覆盖标题。
        const inserted = editor.insertBlocks(
          withoutCopiedBlockIds(blocks),
          titleBlock,
          "after",
        );
        const last = inserted[inserted.length - 1];
        if (last) focusPastedBlock(editor, last);
      })();
      return true;
    }
  }

  // 笔记内复制的原生切片包含选区边界、嵌套 children 与全部 block props。
  // 普通位置不拦截事件，让 BlockNote 直接粘贴；UniqueID 会为副本父子块分别分配 ID。
  // 空段落沿用原有「原位替换」语义：BlockNote 默认会删掉目标块并新建 ID，
  // 而此路径解析完整内部 HTML 后 updateBlock，可保留目标块 ID。
  if (normalizedBlockNoteHtml) {
    const target = cachePasteTarget(editor);
    if (target && isEmptyInlineBlock(target)) {
      event.preventDefault();
      event.stopPropagation();
      void pasteClipboardHtmlAsBlocks(editor, normalizedBlockNoteHtml, target);
      return true;
    }

    // 仅在需要清除旧 data URL 默认 caption 时接管原生 MIME。直接保留内部
    // slice，并清空 blockContainer ID 让 UniqueID appendTransaction 重新生成；
    // 不把完整结构转写为 Markdown 或外部 HTML。
    if (normalizedBlockNoteHtml !== recoveredBlockNoteHtml) {
      event.preventDefault();
      event.stopPropagation();
      editor.pasteHTML(
        withoutBlockNoteClipboardIds(normalizedBlockNoteHtml),
        true,
      );
      return true;
    }

    // Electron 系统剪贴板常丢掉自定义 MIME，只剩 text/html。
    // 默认 paste 随后会被多行纯文本拆行，把 1. 2. 3. 变成 123/333。
    if (!nativeBlockNoteHtml) {
      if (!target) return true;
      event.preventDefault();
      event.stopPropagation();
      void pasteClipboardHtmlAsBlocks(editor, normalizedBlockNoteHtml, target);
      return true;
    }

    // 未改写的原生切片由 BlockNote 默认 paste handler 处理。
    return true;
  }

  // GOOSE MIME 或 HTML 含块级属性：块级粘贴（async 前同步缓存锚点）。
  if (shouldPasteClipboardAsBlocks(clipboard, htmlText)) {
    const target = cachePasteTarget(editor);
    if (!target) return true;
    event.preventDefault();
    event.stopPropagation();
    void pasteClipboardHtmlAsBlocks(editor, htmlText, target);
    return true;
  }

  return false;
}
