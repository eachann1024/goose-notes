import { useCallback, type MutableRefObject } from "react";
import { Fragment, Slice } from "@tiptap/pm/model";
import { useCreateBlockNote } from "@blocknote/react";
import {
  isValidUrl,
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
