import { useCallback, type RefObject } from "react";
import { useEditorPlatform } from "@/components/editor/platform/context";
import {
  cachePasteTarget,
  pasteClipboardHtmlAsBlocks,
  pasteLinesAsBlocks,
  shouldPasteHtmlAsBlocks,
} from "@/components/editor/hooks/useEditorPaste";
import { GOOSE_BLOCKNOTE_BLOCK_COPY_MIME } from "@/components/editor/extensions/copyCurrentBlockExtension";
import {
  getEditorSelectionPlainText,
  looksLikeMarkdownFragment,
  normalizeMarkdownPasteText,
} from "@/components/editor/utils/clipboard";
import {
  inspectPasteContainer,
  resolvePasteLines,
} from "@/components/editor/utils/multilinePaste";
import {
  buildSoftWrapPasteInline,
  insertSoftWrappedInline,
  insertSoftWrappedLines,
} from "@/components/editor/utils/softWrapPaste";

export function useEditorContextClipboard(
  editor: any,
  editable: boolean,
  selectedTextRef: RefObject<string>,
) {
  const platform = useEditorPlatform();
  const handleContextPaste = useCallback(async () => {
    if (!editable) return;
    try {
      let htmlText = "";
      let blockNoteHtml = "";
      let hasGooseMime = false;
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (!blockNoteHtml && item.types.includes("blocknote/html")) {
            try {
              blockNoteHtml = await (
                await item.getType("blocknote/html")
              ).text();
            } catch {
              // 有些浏览器不允许从异步 ClipboardItem 读取自定义类型，继续走兼容格式。
            }
          }
          if (item.types.includes(GOOSE_BLOCKNOTE_BLOCK_COPY_MIME)) {
            hasGooseMime = true;
          }
          if (!htmlText && item.types.includes("text/html")) {
            htmlText = await (await item.getType("text/html")).text();
          }
        }
      } catch {
        // read() 不可用或权限不足时回退 readText
      }

      // 键盘复制写入的原生内部 HTML 优先于自定义 MIME / text/html。
      // 右键粘贴没有原生 paste transaction，不能直接 pasteHTML(raw)，否则已有
      // block ID 不会经过 UniqueID；解析后递归移除 ID 再插入，保留 props 和 children。
      if (blockNoteHtml) {
        const target = cachePasteTarget(editor);
        if (target) {
          const pasted = await pasteClipboardHtmlAsBlocks(
            editor,
            blockNoteHtml,
            target,
          );
          if (pasted) return;
        }
      }

      if (shouldPasteHtmlAsBlocks(htmlText, hasGooseMime)) {
        const target = cachePasteTarget(editor);
        if (target) {
          const pasted = await pasteClipboardHtmlAsBlocks(
            editor,
            htmlText,
            target,
          );
          if (pasted) return;
        }
      }

      const text = normalizeMarkdownPasteText(
        await navigator.clipboard.readText(),
      );
      if (!text) return;
      const lines = resolvePasteLines(text, "");
      try {
        const container = inspectPasteContainer(
          editor.prosemirrorState.selection.$from,
        );
        if (container.inSoftWrap && lines && lines.length >= 2) {
          const inline = buildSoftWrapPasteInline({ plainText: text });
          if (inline.length > 0) insertSoftWrappedInline(editor, inline);
          else insertSoftWrappedLines(editor, lines.join("\n"));
          return;
        }
      } catch {
        /* 选区读不到时按普通多行粘贴 */
      }
      if (lines && lines.length >= 2) {
        let blockType: string | null = null;
        try {
          blockType = editor.getTextCursorPosition().block.type ?? null;
        } catch {
          blockType = null;
        }
        pasteLinesAsBlocks(editor, lines, blockType);
        return;
      }
      if (looksLikeMarkdownFragment(text)) {
        editor.pasteMarkdown(text);
      } else {
        editor.insertInlineContent(text);
      }
    } catch (error) {
      console.error("Failed to read clipboard contents: ", error);
    }
  }, [editable, editor]);

  const handleCopySelection = useCallback(() => {
    try {
      editor.focus();
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined" && document.execCommand("copy")) {
      return;
    }
    let text = selectedTextRef.current;
    try {
      text = getEditorSelectionPlainText(editor.prosemirrorState) || text;
    } catch {
      /* ignore */
    }
    if (text) void platform.clipboard.copyText(text);
  }, [editor, platform]);

  const handleCutSelection = useCallback(() => {
    if (!editable) return;
    try {
      editor.focus();
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined" && document.execCommand("cut")) {
      return;
    }
    let text = selectedTextRef.current;
    try {
      text = getEditorSelectionPlainText(editor.prosemirrorState) || text;
    } catch {
      /* ignore */
    }
    if (text) void platform.clipboard.copyText(text);
    editor.exec((state: any, dispatch: any) => {
      dispatch?.(state.tr.deleteSelection());
      return true;
    });
  }, [editable, editor, platform]);

  return { handleContextPaste, handleCopySelection, handleCutSelection };
}
