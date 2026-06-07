import { useCallback, type MutableRefObject } from "react";
import { Fragment, Slice } from "@tiptap/pm/model";
import { useCreateBlockNote } from "@blocknote/react";
import {
  isValidUrl,
  looksLikeBlockStructure,
  looksLikeMarkdownFragment,
  normalizeMarkdownPasteText,
  parseMarkdownLink,
} from "../utils/clipboard";

type Editor = ReturnType<typeof useCreateBlockNote>;

type UseEditorPasteOptions = {
  editor: Editor;
  editable: boolean;
  shiftPressedRef: MutableRefObject<boolean>;
};

export function useEditorPaste({
  editor,
  editable,
  shiftPressedRef,
}: UseEditorPasteOptions) {
  const handleEditorPasteCapture = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!editable) return;
      if (event.defaultPrevented) return;
      if (shiftPressedRef.current) return;
      if ((event.target as HTMLElement | null)?.closest(".goose-code-block-node")) return;

      const clipboard = event.clipboardData;
      const plainText = normalizeMarkdownPasteText(
        clipboard.getData("text/plain"),
      );

      // ===== 标题一隔离：光标在「文档标题(物理首块 H1)」时粘贴「块结构」=====
      // 标题一是特殊存在，必须保持独立(恒为物理首块 H1、不被注入图片/列表/代码等结构)。
      // 默认粘贴会把图片等结构块塞成标题一的 children(实测 depth=1)，破坏其独立性。
      // 处理：光标在标题一且剪贴板是「非纯文本的块结构」时，拦截默认，把内容解析成块
      // 插到标题一【下方同级】(用户要求：插入前先加空行再放，绝不覆盖标题或已有正文)。
      // 纯文本(单行)不拦截 → 照常注入标题文字。
      {
        const cursorBlock = editor.getTextCursorPosition().block;
        const isInTitle =
          editor.document[0] && cursorBlock.id === editor.document[0].id;
        const htmlText = clipboard.getData("text/html");
        if (isInTitle && looksLikeBlockStructure(plainText, htmlText)) {
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
            // 先加空行再放：在标题与原有正文之间垫一个空段落，再把解析出的块放进去。
            // 通过「先插块、再确保块前有空行」实现——直接插到标题之后即为「标题下一行」，
            // 原有正文被这些新块顺移到后面，不被覆盖。
            const inserted = editor.insertBlocks(blocks, titleBlock, "after");
            const last = inserted[inserted.length - 1];
            if (last) editor.setTextCursorPosition(last, "end");
          })();
          return;
        }
      }

      if (!plainText) return;

      const trimmedText = plainText.trim();

      // 0. 选区在 callout / quote 内，且粘贴含多行 → 以 hardBreak 软换行注入，
      //    避免默认 Markdown 解析把多行拆成多个独立 paragraph 块溢出容器
      // 同样地：在「空列表项」中粘贴时，默认 paste 会把外部 <p> 当成新段落块
      // 替换掉空的列表块，导致刚打出的 `- ` bullet 被挤掉。这里走同一条软换行路径，
      // 把粘贴内容作为内联文本注入，保留列表块本身。
      const pmState = editor.prosemirrorState;
      const $from = pmState.selection.$from;
      let inSoftWrapContainer = false;
      let inEmptyListItem = false;
      for (let d = $from.depth; d >= 1; d--) {
        const node = $from.node(d);
        if (node.type.name === "blockContainer") {
          const contentNode = d + 1 <= $from.depth ? $from.node(d + 1) : null;
          const name = contentNode?.type.name;
          if (name === "callout" || name === "quote") {
            inSoftWrapContainer = true;
          } else if (
            contentNode &&
            (name === "bulletListItem" ||
              name === "numberedListItem" ||
              name === "checkListItem" ||
              name === "toggleListItem") &&
            contentNode.content.size === 0
          ) {
            inEmptyListItem = true;
          }
          break;
        }
      }
      if (
        (inSoftWrapContainer && plainText.includes("\n")) ||
        inEmptyListItem
      ) {
        event.preventDefault();
        event.stopPropagation();
        const schema = pmState.schema;
        const hardBreakType = schema.nodes.hardBreak;
        const lines = plainText.split("\n");
        const nodes: any[] = [];
        lines.forEach((line, idx) => {
          if (idx > 0 && hardBreakType) nodes.push(hardBreakType.create());
          if (line.length > 0) nodes.push(schema.text(line));
        });
        const slice = new Slice(Fragment.fromArray(nodes), 0, 0);
        editor.prosemirrorView.dispatch(
          pmState.tr.replaceSelection(slice).scrollIntoView(),
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
      if (isValidUrl(trimmedText)) {
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
          editor.createLink(trimmedText, selectedText);
          return;
        }

        // 无选中文本 + 粘贴纯 URL → 将 URL 作为链接文本插入
        event.preventDefault();
        event.stopPropagation();
        editor.createLink(trimmedText, trimmedText);
        return;
      }

      // 3. 其他 Markdown 内容
      if (!looksLikeMarkdownFragment(plainText)) return;

      const htmlText = clipboard.getData("text/html");
      if (htmlText && htmlText.trim()) return;

      event.preventDefault();
      event.stopPropagation();
      editor.pasteMarkdown(plainText);
    },
    [editable, editor],
  );

  return { handleEditorPasteCapture };
}
