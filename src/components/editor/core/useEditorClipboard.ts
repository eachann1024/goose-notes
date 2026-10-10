import { useEffect } from "react";
import {
  getSelectedImageUrl,
  getSelectedCellPlainText,
  isWholeTableCellSelection,
} from "@/components/editor/utils/selection";
import {
  GOOSE_BLOCKNOTE_BLOCK_COPY_MIME,
  shouldCopyClipboardWithFormatting,
} from "@/components/editor/extensions/copyCurrentBlockExtension";
import { getEditorSelectionPlainText } from "@/components/editor/utils/clipboard";
import { copyImageSrcToClipboard } from "@/components/editor/image/imageUtils";
import {
  reconcileSlashSuggestionMenu,
  reconcilePageMentionSuggestionMenu,
} from "@/components/editor/utils/slashMenuPolicy";
import type { EditorRuntime } from "./useEditorSession";

export function useEditorClipboard(runtime: EditorRuntime) {
  const {
    editor,
    editorContainerRef,
    platformRef,
    getActivePageLocalFilePathRef,
    usesRawEditorContentRef,
  } = runtime;
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const patchClipboardPlainText = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      // BlockNote 默认会把 NodeSelection 图片块复制成 Markdown：
      // ![name](att:...)。复制 / 剪切都应给系统剪贴板写入真正的图片数据。
      const selectedImageUrl = getSelectedImageUrl(editor.prosemirrorState);
      if (selectedImageUrl) {
        event.preventDefault();
        void copyImageSrcToClipboard(
          selectedImageUrl,
          platformRef.current,
          getActivePageLocalFilePathRef.current(),
        ).catch((error) => {
          console.error("[editor] Failed to copy selected image", error);
        });
        if (event.type === "cut") {
          const view = editor.prosemirrorView;
          if (view && !view.state.selection.empty) {
            view.dispatch(view.state.tr.deleteSelection());
          }
        }
        return;
      }

      const cellText = getSelectedCellPlainText(editor.prosemirrorState);
      if (
        cellText != null &&
        !isWholeTableCellSelection(editor.prosemirrorState)
      ) {
        event.preventDefault();
        clipboardData.setData("text/plain", cellText);
        clipboardData.setData("text/html", "");
        clipboardData.setData("blocknote/html", "");
        return;
      }

      // 插件已 preventDefault 并写入权威 MIME，冒泡阶段不要再清 HTML。
      if (event.defaultPrevented) return;
      // 多块格式复制不要再用无编号纯文本覆盖，否则粘贴只会剩下 123/333。
      if (shouldCopyClipboardWithFormatting(editor.prosemirrorState)) return;

      const { selection } = editor.prosemirrorState;
      if (!selection.empty) {
        clipboardData.setData(
          "text/plain",
          getEditorSelectionPlainText(editor.prosemirrorState),
        );
      }
      clipboardData.setData("text/html", "");
      clipboardData.setData("blocknote/html", "");
      clipboardData.setData(GOOSE_BLOCKNOTE_BLOCK_COPY_MIME, "");
    };

    container.addEventListener("copy", patchClipboardPlainText);
    container.addEventListener("cut", patchClipboardPlainText);

    return () => {
      container.removeEventListener("copy", patchClipboardPlainText);
      container.removeEventListener("cut", patchClipboardPlainText);
    };
  }, []);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;
    const onCompositionEnd = () =>
      queueMicrotask(() => {
        reconcileSlashSuggestionMenu(editor, {
          allowSlashMenuOnFirstBlock: usesRawEditorContentRef.current,
        });
        reconcilePageMentionSuggestionMenu(editor);
      });
    container.addEventListener("compositionend", onCompositionEnd);
    return () =>
      container.removeEventListener("compositionend", onCompositionEnd);
  }, [editor]);
}
