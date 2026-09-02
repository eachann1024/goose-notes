import { useCallback, type MutableRefObject } from "react";
import { Fragment, Slice } from "@tiptap/pm/model";
import { CellSelection } from "prosemirror-tables";
import { useCreateBlockNote } from "@blocknote/react";
import {
  isValidUrl,
  looksLikeBlockStructure,
  looksLikeMermaidDiagram,
  looksLikeMarkdownFragment,
  normalizeMarkdownPasteText,
  parseMarkdownLink,
} from "../utils/clipboard";
import {
  inspectPasteContainer,
  planMultilinePaste,
  resolvePasteLines,
  shouldSplitMultilinePaste,
} from "../utils/multilinePaste";
import {
  buildSoftWrapPasteInline,
  htmlHasInlineFormatting,
  insertSoftWrappedInline,
  insertSoftWrappedLines,
} from "../utils/softWrapPaste";
import { clipboardHasPasteableImage } from "../utils/pasteClipboardImage";
import { GOOSE_BLOCKNOTE_BLOCK_COPY_MIME } from "../extensions/copyCurrentBlockExtension";
import { selectionIsInsideFirstTitleBlock } from "../toolbars/formatting/helpers";

type Editor = ReturnType<typeof useCreateBlockNote>;

type UseEditorPasteOptions = {
  editor: Editor;
  editable: boolean;
  shiftPressedRef: MutableRefObject<boolean>;
};

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

function isMultiBlockTextSelection(editor: Editor): boolean {
  try {
    return (editor.getSelection()?.blocks?.length ?? 0) > 1;
  } catch {
    return false;
  }
}

function getCursorBlockType(editor: Editor): string | null {
  try {
    return editor.getTextCursorPosition().block.type ?? null;
  } catch {
    return null;
  }
}

function insertPlainInline(editor: Editor, text: string) {
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
  const current = editor.getTextCursorPosition().block;
  const inserted = editor.insertBlocks(restBlocks, current, "after");
  const last = inserted[inserted.length - 1];
  if (last) editor.setTextCursorPosition(last, "end");
}

export function useEditorPaste({
  editor,
  editable,
  shiftPressedRef,
}: UseEditorPasteOptions) {
  const handleEditorPasteCapture = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!editable) return;
      if (clipboardHasPasteableImage(event.clipboardData)) return;
      if (event.defaultPrevented) return;
      if (shiftPressedRef.current) return;
      if ((event.target as HTMLElement | null)?.closest(".goose-code-block-node")) return;

      const clipboard = event.clipboardData;
      const plainText = normalizeMarkdownPasteText(
        clipboard.getData("text/plain"),
      );
      const htmlText = clipboard.getData("text/html");

      if (looksLikeMermaidDiagram(plainText)) {
        event.preventDefault();
        event.stopPropagation();
        editor.pasteMarkdown(`\`\`\`mermaid\n${plainText.trim()}\n\`\`\``);
        return;
      }

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
              if (htmlText && htmlText.trim()) {
                blocks = await editor.tryParseHTMLToBlocks(htmlText);
              } else if (plainText) {
                blocks = await editor.tryParseMarkdownToBlocks(plainText);
              }
            } catch {
              blocks = [];
            }
            if (!blocks || blocks.length === 0) return;
            const titleBlock = editor.document[0];
            if (!titleBlock) return;
            // 直接插到标题之后；原有正文顺移，不覆盖标题。
            const inserted = editor.insertBlocks(blocks, titleBlock, "after");
            const last = inserted[inserted.length - 1];
            if (last) editor.setTextCursorPosition(last, "end");
          })();
          return;
        }
      }

      if (!plainText) return;

      // BlockNote 内部「折叠光标整体复制当前块」会写入 GOOSE_BLOCKNOTE_BLOCK_COPY_MIME
      // 标记，其 text/html 是块级结构。走块级粘贴：解析回块后整块插到当前块之后，
      // 完整保留内联格式与块类型。绝不能交给默认 HTML 粘贴（会把内容 merge 进当前
      // 段落，标题/列表降级），更不能走下方「多行拆块/纯文本」逻辑（全变纯文本）。
      if (clipboard.getData(GOOSE_BLOCKNOTE_BLOCK_COPY_MIME)) {
        event.preventDefault();
        event.stopPropagation();
        void (async () => {
          let blocks: any[];
          try {
            blocks = await editor.tryParseHTMLToBlocks(htmlText);
          } catch {
            blocks = [];
          }
          if (!blocks || blocks.length === 0) return;
          const current = editor.getTextCursorPosition().block;
          const inserted = editor.insertBlocks(blocks, current, "after");
          const last = inserted[inserted.length - 1];
          if (last) editor.setTextCursorPosition(last, "end");
        })();
        return;
      }

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
            let blocks: unknown[] = [];
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
          } catch { /* ignore */ }
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

      // 2.6 多行文本：每行一个块。列表 / 待办 / 有序继承当前块类型。
      // 含 ** 的碎片也拆，避免 pasteMarkdown 把单换行当成空格、CJK 粘成一段。
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
      if (container.listEmpty && !plainText.includes("\n")) {
        event.preventDefault();
        event.stopPropagation();
        insertPlainInline(editor, plainText);
        return;
      }

      // 3. 其他 Markdown 内容
      if (!looksLikeMarkdownFragment(plainText)) return;

      if (htmlText && htmlText.trim()) return;

      event.preventDefault();
      event.stopPropagation();
      editor.pasteMarkdown(plainText);
    },
    [editable, editor],
  );

  return { handleEditorPasteCapture };
}
