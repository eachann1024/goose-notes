import { CellSelection } from "prosemirror-tables";
import {
  inspectPasteContainer,
  resolvePasteLines,
  shouldPreferPlainMultilinePaste,
  shouldSplitMultilinePaste,
  htmlHasRichPasteContent,
} from "../utils/multilinePaste";
import {
  buildSoftWrapPasteInline,
  htmlHasInlineFormatting,
  insertSoftWrappedInline,
  insertSoftWrappedLines,
} from "../utils/softWrapPaste";
import {
  parseMarkdownLink,
  isValidUrl,
  looksLikeMarkdownFragment,
} from "../utils/clipboard";
import {
  cachePasteTarget,
  getCursorBlockType,
  isMultiBlockTextSelection,
  pasteLinesAsBlocks,
  insertPlainInline,
  plainHasGooseMarkdownMarkers,
  tryPasteGooseMarkdownFragment,
  type Editor,
} from "./editorPasteBlocks";

export function handleEditorTextPaste(
  editor: Editor,
  event: React.ClipboardEvent<HTMLDivElement>,
  plainText: string,
  htmlText: string,
) {
  const trimmedText = plainText.trim();

  // 0. callout / quote 内多行仍走 hardBreak，避免拆出容器。
  //    列表项不再堆成软换行：有换行就拆成同类型的新块；空列表单项仍就地注入，
  //    防止默认 paste 把空 bullet/待办替换成段落。
  const pmState = editor.prosemirrorState;
  const container = inspectPasteContainer(pmState.selection.$from);
  if (pmState.selection instanceof CellSelection) {
    container.inTable = true;
  }
  const pasteLines = resolvePasteLines(plainText, htmlText);
  const softWrapText = pasteLines ? pasteLines.join("\n") : plainText;
  if (container.inSoftWrap && softWrapText.includes("\n")) {
    event.preventDefault();
    event.stopPropagation();
    const html = htmlText?.trim() ?? "";
    if (html && htmlHasInlineFormatting(html)) {
      void (async () => {
        let blocks: unknown[];
        try {
          blocks = await editor.tryParseHTMLToBlocks(htmlText);
        } catch {
          blocks = [];
        }
        const inline = buildSoftWrapPasteInline({
          plainText: softWrapText,
          parsedHtmlBlocks: blocks,
        });
        if (inline.length > 0) {
          insertSoftWrappedInline(editor, inline);
          return;
        }
        insertSoftWrappedLines(editor, softWrapText);
      })();
      return;
    }
    const inline = buildSoftWrapPasteInline({
      plainText: softWrapText,
    });
    if (inline.length > 0) {
      insertSoftWrappedInline(editor, inline);
      return;
    }
    insertSoftWrappedLines(editor, softWrapText);
    return;
  }

  if (
    !isMultiBlockTextSelection(editor) &&
    !container.inTable &&
    shouldPreferPlainMultilinePaste(plainText, htmlText)
  ) {
    event.preventDefault();
    event.stopPropagation();
    pasteLinesAsBlocks(
      editor,
      pasteLines!,
      container.listType ?? getCursorBlockType(editor),
    );
    return;
  }

  // 1. 粘贴 Markdown 链接 [text](url) → 直接转为链接
  const mdLink = parseMarkdownLink(trimmedText);
  if (mdLink) {
    event.preventDefault();
    event.stopPropagation();
    editor.createLink(mdLink.url, mdLink.text);
    return;
  }

  // 2. 粘贴纯 URL → 根据是否有选中文本决定行为
  //    仅当整段「只是」一个 URL(内部无空白)时才建链;若是「URL + 空格 + 其它文字」
  //    (如 `http://x.com/p 登录地址必须用这个`),isValidUrl 的非 anchored 正则仍会
  //    命中开头的 URL → 整段被 createLink 吞成一个链接,后面的文字也被并进去。
  //    这类整段交给后续普通粘贴/autolink,只把真正的 URL 片段识别成链接。
  if (!/\s/.test(trimmedText) && isValidUrl(trimmedText)) {
    // 裸域名(baidu.com)/www. 开头没有协议，href 不补全的话 openUrl 打不开，
    // 这里统一补 https://，显示文本仍保留原文。
    const href = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedText)
      ? trimmedText
      : `https://${trimmedText}`;
    // 先尝试 BlockNote 的选中文本 API，fallback 到原生选区
    let selectedText = editor.getSelectedText();
    if (!selectedText?.trim()) {
      try {
        const sel = document.getSelection();
        selectedText = sel?.toString() || "";
      } catch {
        /* ignore */
      }
    }

    if (selectedText?.trim()) {
      // 选中文本 + 粘贴 URL → 将选中文本转为链接
      event.preventDefault();
      event.stopPropagation();
      editor.createLink(href, selectedText);
      return;
    }

    // 无选中文本 + 粘贴纯 URL → 将 URL 作为链接文本插入
    event.preventDefault();
    event.stopPropagation();
    editor.createLink(href, trimmedText);
    return;
  }

  // 2.5 纯文本含 Markdown 代码围栏(```lang ... ```) → 强制走 pasteMarkdown。
  // 即便剪贴板同时带 text/html(从网页/IDE 复制常见),也优先用纯文本解析:
  // 默认 HTML 粘贴对自定义 codeBlock 易降级成段落,而 pasteMarkdown 能正确还原代码块。
  const hasMarkdownCodeFence = /(^|\n)\s*```/.test(plainText);
  if (hasMarkdownCodeFence) {
    event.preventDefault();
    event.stopPropagation();
    editor.pasteMarkdown(plainText);
    return;
  }

  // 2.6 无格式的多行文本才拆块；Markdown 和富文本保留源格式。
  if (
    shouldSplitMultilinePaste({
      lines: pasteLines,
      htmlText,
      inSoftWrap: container.inSoftWrap,
      inTable: container.inTable,
      multiBlockSelection: isMultiBlockTextSelection(editor),
    })
  ) {
    event.preventDefault();
    event.stopPropagation();
    pasteLinesAsBlocks(
      editor,
      pasteLines!,
      container.listType ?? getCursorBlockType(editor),
    );
    return;
  }

  // 空列表项单行：就地注入，避免默认 HTML 粘贴把空列表换成段落。
  if (
    container.listEmpty &&
    !plainText.includes("\n") &&
    !looksLikeMarkdownFragment(plainText) &&
    !htmlHasRichPasteContent(htmlText)
  ) {
    event.preventDefault();
    event.stopPropagation();
    insertPlainInline(editor, plainText);
    return;
  }

  // 3. 其他 Markdown 内容
  if (!looksLikeMarkdownFragment(plainText)) return;

  if (htmlHasRichPasteContent(htmlText)) return;

  event.preventDefault();
  event.stopPropagation();

  if (plainHasGooseMarkdownMarkers(plainText)) {
    const target = cachePasteTarget(editor);
    if (target && tryPasteGooseMarkdownFragment(editor, plainText, target)) {
      return;
    }
  }

  editor.pasteMarkdown(plainText);
}
