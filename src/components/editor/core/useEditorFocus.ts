import { useCallback, useEffect } from "react";
import { needsBodyParagraphAfterTitle } from "@/components/editor/utils/blocknote-content";
import { isBottomEditorBlankClick } from "@/components/editor/utils/selection";
import type { EditorRuntime } from "./useEditorSession";

export function useEditorFocus(runtime: EditorRuntime, editable: boolean) {
  const {
    editor,
    usesRawEditorContentRef,
    editorContainerRef,
    suppressFormattingToolbarRef,
    setSuppressFormattingToolbar,
  } = runtime;
  // 冷加载时 BlockNoteView 尚未完全挂定，editor.focus() 会落到 view.dom，
  // 但此时 contentEditable 还未稳定，焦点会「漏」到侧栏页面重命名输入框等
  // 下一个可聚焦元素。guard：view 存在、dom 已连入文档且 doc 非空才聚焦；
  // 否则用 rAF 延后到下一帧（挂载完成）再试，避免冷加载点编辑器丢焦点。
  const focusEditorSafely = useCallback(() => {
    const tryFocus = () => {
      const view = editor.prosemirrorView;
      const dom = view?.dom as HTMLElement | undefined;
      if (view && dom && dom.isConnected && view.state.doc.content.size > 0) {
        editor.focus();
        return true;
      }
      return false;
    };
    if (!tryFocus()) {
      requestAnimationFrame(() => {
        tryFocus();
      });
    }
  }, [editor]);

  const focusEditorEnd = useCallback(() => {
    // 标题一独占文档时（删光正文后）：补空正文并聚焦它，而不是把光标钉回标题末尾。
    // 守卫 extension 也会补，这里主动插入保证点击当帧光标就落到正文。
    if (
      !usesRawEditorContentRef.current &&
      needsBodyParagraphAfterTitle(editor.document)
    ) {
      const titleBlock = editor.document[0];
      if (titleBlock) {
        const [inserted] = editor.insertBlocks(
          [{ type: "paragraph", content: [] }],
          titleBlock,
          "after",
        );
        if (inserted) {
          editor.setTextCursorPosition(inserted, "start");
          focusEditorSafely();
          return;
        }
      }
    }

    const lastBlock = editor.document.at(-1);
    if (lastBlock) {
      // 末块 content 为 "none"（image / divider / video / file 等无光标控件）时，
      // 无法直接聚焦末块末尾，在文档末尾插入一个空 paragraph 再聚焦它。
      const blockSpecs = editor.schema.blockSpecs as
        | Record<string, { config?: { content?: string } }>
        | undefined;
      const contentType = blockSpecs?.[lastBlock.type]?.config?.content;
      if (contentType === "none") {
        editor.insertBlocks(
          [{ type: "paragraph", content: [] }],
          lastBlock,
          "after",
        );
        const newLast = editor.document.at(-1);
        if (newLast) {
          editor.setTextCursorPosition(newLast, "end");
        }
      } else {
        editor.setTextCursorPosition(lastBlock, "end");
      }
    }
    focusEditorSafely();
  }, [editor, focusEditorSafely]);

  const handleEditorBlankMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!editable || event.button !== 0) return;
      const container = editorContainerRef.current;
      if (!container || !isBottomEditorBlankClick(event, container)) return;

      suppressFormattingToolbarRef.current = true;
      setSuppressFormattingToolbar(true);
      event.preventDefault();
      focusEditorEnd();
    },
    [editable, focusEditorEnd],
  );

  // 补丁：EditorContextMenu 容器高度 = 内容高度（flex-1 min-h-0），
  // 点击编辑器内容下方的空白时，event.target 落在外层 page-scroll-container 的背景上，
  // onMouseDown 不会冒泡到 workspace-editor-surface，所以需要在更上层监听。
  useEffect(() => {
    if (!editable) return;

    const handleDocMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const container = editorContainerRef.current;
      if (!container) return;

      // 只处理点击落在 page-scroll-container 内但不在 workspace-editor-surface 内的情况
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (container.contains(target)) return; // 已由 onMouseDown 处理
      const scrollContainer = target.closest(".page-scroll-container");
      if (!scrollContainer) return;
      // 分屏时多个编辑器都在听 document：只处理落在本实例滚动容器内的点击。
      if (!scrollContainer.contains(container)) return;

      // 检查 Y 坐标是否在末尾块之下（与 isBottomEditorBlankClick 逻辑一致）
      const blocks = container.querySelectorAll<HTMLElement>(".bn-block-outer");
      const lastBlock = blocks[blocks.length - 1];
      if (!lastBlock) return;
      if (event.clientY < lastBlock.getBoundingClientRect().bottom) return;

      // 点击确实在末块之下，阻止默认行为并聚焦末尾
      suppressFormattingToolbarRef.current = true;
      setSuppressFormattingToolbar(true);
      event.preventDefault();
      focusEditorEnd();
    };

    document.addEventListener("mousedown", handleDocMouseDown, true);
    return () => {
      document.removeEventListener("mousedown", handleDocMouseDown, true);
    };
  }, [editable, focusEditorEnd]);

  // 消闪 mouseup 清理：空白区域 mousedown 后抑制格式化工具栏，mouseup 时恢复。
  // 兜底 blur：鼠标拖出窗口松开时 document mouseup 不触发，window blur 覆盖此场景。
  useEffect(() => {
    const clearSuppress = () => {
      if (!suppressFormattingToolbarRef.current) return;
      suppressFormattingToolbarRef.current = false;
      setSuppressFormattingToolbar(false);
    };
    document.addEventListener("mouseup", clearSuppress, true);
    window.addEventListener("blur", clearSuppress);
    return () => {
      document.removeEventListener("mouseup", clearSuppress, true);
      window.removeEventListener("blur", clearSuppress);
    };
  }, []);

  return { focusEditorSafely, handleEditorBlankMouseDown };
}
