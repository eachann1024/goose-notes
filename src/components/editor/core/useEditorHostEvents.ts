import { useEffect } from "react";
import {
  completePageTitleFocus,
  isPageTitleFocusRequested,
} from "@/lib/page-title-focus";
import {
  clonePageContent,
  createEditorSafeContent,
  getContentSignature,
  normalizePageContent,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { toEditorBlocks } from "./editorContentPolicy";
import type { EditorRuntime } from "./useEditorSession";
import type { EditorContentCommit } from "./useEditorContentCommit";

export function useEditorHostEvents(
  runtime: EditorRuntime,
  { commitEditorContent, debouncedUpdate }: EditorContentCommit,
  focusEditorSafely: () => void,
  isActiveEditor: boolean,
) {
  const {
    editor,
    pageRef,
    usesRawEditorContentRef,
    pageIdForUpdateRef,
    getLatestPage,
    contentModeRef,
    editorContainerRef,
    pendingEditorChangeRef,
    syncedContentSignatureRef,
    userInteractedRef,
  } = runtime;
  useEffect(() => {
    const handleFlush = (event: Event) => {
      const customEvent = event as CustomEvent<{ immediate?: boolean }>;
      if (customEvent.detail?.immediate) {
        commitEditorContent();
        return;
      }
      commitEditorContent();
    };

    const handleFocusStart = () => {
      if (!isActiveEditor) return;
      const pageId = pageRef.current?.id;
      // 本地文件标题由标签栏承担；新建页标题聚焦请求未完成时不抢焦到正文。
      if (
        pageId &&
        isPageTitleFocusRequested(pageId) &&
        usesRawEditorContentRef.current
      ) {
        return;
      }

      // 多标签新建内部页：光标落到首块 H1 标题末尾（与截图中的标题位置一致）。
      const focusTitleEnd = () => {
        const blocks = editor.document;
        if (blocks.length === 0) return false;
        try {
          editor.setTextCursorPosition(blocks[0], "end");
          editor.focus();
          if (pageId && isPageTitleFocusRequested(pageId)) {
            completePageTitleFocus(pageId);
          }
          return true;
        } catch {
          return false;
        }
      };
      if (!focusTitleEnd()) {
        requestAnimationFrame(() => {
          if (!focusTitleEnd()) focusEditorSafely();
        });
      }
    };

    const handleFocusBody = () => {
      if (!isActiveEditor) return;
      const focusBody = () => {
        const blocks = editor.document;
        if (blocks.length === 0) return false;
        const target = blocks[blocks.length - 1];
        try {
          if (!usesRawEditorContentRef.current && blocks.length === 1) {
            const [inserted] = editor.insertBlocks(
              [{ type: "paragraph", content: "" }],
              blocks[0],
              "after",
            );
            if (inserted) editor.setTextCursorPosition(inserted, "start");
          } else {
            try {
              editor.setTextCursorPosition(target, "end");
            } catch {
              const [inserted] = editor.insertBlocks(
                [{ type: "paragraph", content: "" }],
                target,
                "after",
              );
              if (!inserted) return false;
              editor.setTextCursorPosition(inserted, "start");
            }
          }
          editor.focus();
          return true;
        } catch {
          return false;
        }
      };
      if (!focusBody()) requestAnimationFrame(() => focusBody());
    };

    const handlePluginEnter = () => {
      if (!isActiveEditor) return;
      window.setTimeout(() => {
        focusEditorSafely();
      }, 0);
    };

    // 文件被外部修改后由宿主派发：把当前激活页最新内容刷进编辑器。
    const handleReloadActiveEditor = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId?: string }>).detail;
      const activePage = pageRef.current;
      const activeId = activePage?.id ?? null;
      const targetId = detail?.pageId ?? activeId;
      if (!targetId || targetId !== activeId) return;
      if (targetId !== pageIdForUpdateRef.current) return;
      // 从 store 实时读内容（pageRef.current 可能是陈旧闭包值）
      const livePage = getLatestPage?.(targetId) ?? pageRef.current;
      if (!livePage) return;
      // raw 文档外部重载同样跳过页面级规范化
      const isLocalPage = contentModeRef.current === "raw";
      const nextContent = isLocalPage
        ? toEditorBlocks(livePage.content)
        : normalizePageContent(livePage.content);
      const nextEditorContent = createEditorSafeContent(
        nextContent,
        editor.schema,
      );
      const currentRaw = clonePageContent(editor.document as BlockNoteContent);
      const currentSignature = getContentSignature(
        isLocalPage ? currentRaw : normalizePageContent(currentRaw),
      );
      const nextSignature = getContentSignature(nextEditorContent);

      // 本地文件自动保存的 watch 回声即使穿过了文件监听层，也不能重建编辑器。
      // replaceBlocks 会使 ProseMirror 的失效选区落到视频等原子块上，并把该块
      // 滚入视野。磁盘读回内容与当前编辑器语义一致时只更新同步基线，保留原选区。
      if (nextSignature === currentSignature) {
        syncedContentSignatureRef.current = currentSignature;
        return;
      }
      // 文件监听触发的内容重载不等于页面导航。replaceBlocks 会让浏览器把外层
      // 滚动容器拉回顶部，因此先记录当前位置，并在 DOM 更新后恢复，避免自动保存
      // 的 watch 回声或真正的外部文件更新打断当前阅读/编辑视角。
      const scrollContainer = editorContainerRef.current?.closest<HTMLElement>(
        ".page-scroll-container",
      );
      const scrollTop = scrollContainer?.scrollTop;
      debouncedUpdate.cancel();
      pendingEditorChangeRef.current = false;
      try {
        editor.replaceBlocks(editor.document, nextEditorContent as any);
      } catch (error) {
        console.error(
          "[goose-note] replace editor blocks failed during reload",
          {
            pageId: livePage.id,
            error,
          },
        );
        const fallbackContent = createEditorSafeContent(
          undefined,
          editor.schema,
        );
        editor.replaceBlocks(editor.document, fallbackContent as any);
      }
      // 基线与 EditorComposer.onChange 的计算方式保持一致（见切页 effect 注释）
      const reloadedRaw = clonePageContent(editor.document as BlockNoteContent);
      syncedContentSignatureRef.current = getContentSignature(
        isLocalPage ? reloadedRaw : normalizePageContent(reloadedRaw),
      );
      // 外部重载 = 程序化同步，重置用户交互标记（同切页 effect）。
      userInteractedRef.current = false;
      if (scrollContainer && typeof scrollTop === "number") {
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollTop;
        });
      }
    };

    const handleAssetReferences = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          pages: { localFilePath: string; content: unknown }[];
          failed: boolean;
        }>
      ).detail;
      const localFilePath = pageRef.current?.localFilePath;
      if (!localFilePath) return;
      try {
        detail.pages.push({
          localFilePath,
          content: clonePageContent(editor.document as BlockNoteContent),
        });
      } catch {
        detail.failed = true;
      }
    };
    window.addEventListener(
      "goose-note:asset-references",
      handleAssetReferences,
    );
    window.addEventListener("goose-note:flush-editor", handleFlush);
    window.addEventListener("goose-note:focus-editor-start", handleFocusStart);
    window.addEventListener("goose-note:focus-editor-body", handleFocusBody);
    window.addEventListener("goose-note:plugin-enter", handlePluginEnter);
    window.addEventListener(
      "goose-note:reload-active-editor",
      handleReloadActiveEditor,
    );

    return () => {
      window.removeEventListener(
        "goose-note:asset-references",
        handleAssetReferences,
      );
      window.removeEventListener("goose-note:flush-editor", handleFlush);
      window.removeEventListener(
        "goose-note:focus-editor-start",
        handleFocusStart,
      );
      window.removeEventListener(
        "goose-note:focus-editor-body",
        handleFocusBody,
      );
      window.removeEventListener("goose-note:plugin-enter", handlePluginEnter);
      window.removeEventListener(
        "goose-note:reload-active-editor",
        handleReloadActiveEditor,
      );
    };
  }, [
    commitEditorContent,
    debouncedUpdate,
    editor,
    getLatestPage,
    isActiveEditor,
  ]);
}
