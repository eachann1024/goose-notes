import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { flushSync } from "react-dom";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { useCreateBlockNote } from "@blocknote/react";
import { AIExtension } from "@blocknote/xl-ai";
import { zh as aiZh } from "@blocknote/xl-ai/locales";
import "@blocknote/xl-ai/style.css";
import { createGooseAITransport } from "@/lib/ai-provider/blocknoteAITransport";
import { zh } from "@blocknote/core/locales";
import "@blocknote/react/style.css";
import { createDebounce } from "@/lib/debounce";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { clonePageContent, getContentSignature, normalizePageContent, ensureFirstTitleHeading, type BlockNoteContent } from "@/lib/blocknote-content";

const contentSigCache = new WeakMap<object, string>();
function getCachedContentSignature(content: unknown): string {
  if (content && typeof content === "object") {
    const key = content as object;
    const hit = contentSigCache.get(key);
    if (hit) return hit;
    const sig = getContentSignature(content);
    contentSigCache.set(key, sig);
    return sig;
  }
  return getContentSignature(content);
}
import { getBlockNoteSlashMenuItems, filterSlashMenuItems } from "@/pages/workspace/components/command/blocknoteSlashItems";
import { gooseSelectAllExtension } from "./selectAllExtension";
import { gooseLinkKeyboardExtension } from "./linkKeyboardExtension";
import { gooseTabBehaviorExtension } from "./tabBehaviorExtension";
import { gooseCodeBlockKeyboardExtension } from "./codeBlockKeyboardExtension";
import { gooseCodeBlockLinkStripExtension } from "./codeBlockLinkStripExtension";
import { gooseCalloutKeyboardExtension } from "./calloutKeyboardExtension";
import { gooseQuoteInputRuleExtension } from "./quoteInputRule";
import { gooseMarkdownInputRulesExtension } from "./markdownInputRules";
import { gooseFakeSelectionExtension } from "./fakeSelectionExtension";
import { ArrowInputRuleExtension } from "./arrowInputRule";
import { gooseToggleHeadingInputRuleExtension } from "./toggleHeadingInputRule";
import { gooseInlineCodeEscapeExtension } from "./inlineCodeEscapeExtension";
import { gooseFindInPageExtension } from "./findInPagePlugin";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { EditorFindBar, editorSchema, getSelectedPlainTextContext, isBottomEditorBlankClick, normalizeClipboardLineEndings, shouldPreferVisibleSelectionText, stripMarkdownHardBreaks } from "./EditorFindBar";
import { useEditorShortcuts } from "./hooks/useEditorShortcuts";
import { useEditorPaste } from "./hooks/useEditorPaste";

export interface EditorRef {
  editor: ReturnType<typeof useCreateBlockNote> | null;
}

interface EditorProps {
  editable?: boolean;
}

export const Editor = forwardRef<EditorRef, EditorProps>(function Editor({ editable = true }, ref) {
  const { activePageId, getPage, updatePage } = usePages();
  const { notebooks } = useNotebooks();
  const {
    globalEditorFullWidth,
    customFonts,
    theme,
    searchProviders,
    utools,
    customActions,
  } = useSettings();
  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = page ? notebooks[page.workspaceId] : undefined;
  const isEditorFullWidth = Boolean(
    notebook?.editorFullWidth ?? globalEditorFullWidth,
  );

  const pageIdForUpdateRef = useRef<string | null>(null);
  const syncedContentSignatureRef = useRef<string | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const shiftPressedRef = useRef(false);
  pageIdForUpdateRef.current = page?.id ?? null;
  const [isSwitching, setIsSwitching] = useState(false);

  const initialContentRef = useRef(normalizePageContent(page?.content));
  // 初次 mount 时给 syncedContentSignatureRef 设置基线，
  // 否则切走时 flush 会把"只读打开"误判成编辑、刷新 updatedAt。
  if (syncedContentSignatureRef.current === null) {
    syncedContentSignatureRef.current = getCachedContentSignature(initialContentRef.current);
  }
  const editor = useCreateBlockNote(
    {
      initialContent: initialContentRef.current as any,
      schema: editorSchema,
      extensions: [
        gooseTabBehaviorExtension,
        gooseSelectAllExtension,
        gooseLinkKeyboardExtension,
        gooseCodeBlockKeyboardExtension,
        gooseCodeBlockLinkStripExtension,
        gooseCalloutKeyboardExtension,
        gooseQuoteInputRuleExtension,
        gooseMarkdownInputRulesExtension,
        gooseFakeSelectionExtension,
        ArrowInputRuleExtension,
        gooseToggleHeadingInputRuleExtension,
        gooseInlineCodeEscapeExtension,
        gooseFindInPageExtension,
        AIExtension({
          transport: createGooseAITransport({
            getSettings: () => useSettings.getState().ai,
            getModelId: () =>
              useSettings.getState().ai.selectedModelId || "gpt-4o-mini",
          }),
        }),
      ],
      dictionary: {
        ...zh,
        placeholders: {
          ...zh.placeholders,
          default: "输入 / 或 、来展开菜单...",
        },
        ai: aiZh,
      },
      domAttributes: {
        editor: {
          class: "goose-blocknote-editor",
        },
      },
      uploadFile: async (file) => {
        if (file.type.startsWith("image/")) {
          const { imageStorage } = await import("@/lib/imageStorage");
          return imageStorage.save(file, file.type);
        }
        return URL.createObjectURL(file);
      },
      resolveFileUrl: async (url) => {
        const { resolveImageRefToUrl } = await import("@/lib/imageStorage/resolveUrl");
        const activePageId = usePages.getState().activePageId;
        const activePage = activePageId ? usePages.getState().pages[activePageId] : null;
        return resolveImageRefToUrl(url, activePage?.localFilePath ?? null);
      },
      links: {
        onClick: (event) => {
          if (!event.metaKey && !event.ctrlKey) {
            return false;
          }
          const target = event.target as HTMLElement | null;
          const link = target?.closest<HTMLAnchorElement>('a[data-inline-content-type="link"]');
          if (link) {
            const href = link.getAttribute("href");
            if (href) {
              openExternalUrl(href);
            }
          }
          return true;
        },
      },
    },
    [],
  );

  const debouncedUpdate = useMemo(() => {
    return createDebounce(
      (id: string, content: BlockNoteContent) => {
        syncedContentSignatureRef.current = getCachedContentSignature(content);
        updatePage(id, { content });
      },
      800,
      { maxWait: 3000 },
    );
  }, [updatePage]);

  const prevPageIdRef = useRef<string | null>(activePageId);
  useEffect(() => {
    if (activePageId === prevPageIdRef.current) return;
    prevPageIdRef.current = activePageId;

    debouncedUpdate.cancel();

    const p = activePageId ? getPage(activePageId) : undefined;
    pageIdForUpdateRef.current = p?.id ?? null;

    // 立即翻 isSwitching=true 让骨架先 paint，再下一帧做重活，避免主线程冻结
    // 用 flushSync 强制同步提交，否则 React 18 会把 true→false 合批掉
    flushSync(() => setIsSwitching(true));

    const rafId = requestAnimationFrame(() => {
      const nextContent = normalizePageContent(p?.content);
      const nextSig = getCachedContentSignature(nextContent);

      syncedContentSignatureRef.current = nextSig;

      editor.replaceBlocks(editor.document, nextContent as any);

      // Reset undo history so edits from the previous page don't leak
      const view = editor.prosemirrorView;
      if (view) {
        const newState = EditorState.create({
          doc: view.state.doc,
          plugins: view.state.plugins,
        });
        view.updateState(newState);
      }

      // normalize 没改写结构时不要回写，避免触发 getPage 选择器又跑一遍 useEffect
      if (p && getCachedContentSignature(p.content) !== nextSig) {
        updatePage(p.id, { content: nextContent }, { silent: true });
      }

      // 下一帧再隐藏骨架，确保 BlockNote 已绘制
      requestAnimationFrame(() => setIsSwitching(false));
    });

    return () => cancelAnimationFrame(rafId);
  }, [activePageId, debouncedUpdate, editor, getPage, updatePage]);

  const getSlashItems = useCallback(
    async (query: string) => {
      const items = getBlockNoteSlashMenuItems(editor);
      return filterSlashMenuItems(items, query);
    },
    [editor],
  );

  const restoreFirstTitleHeading = useCallback(() => {
    const currentContent = editor.document as BlockNoteContent;
    const firstBlock = currentContent[0];
    if (
      firstBlock?.type === "heading" &&
      Number((firstBlock as any).props?.level) === 1
    ) {
      return false;
    }

    const nextContent = ensureFirstTitleHeading(clonePageContent(currentContent));
    editor.replaceBlocks(editor.document, nextContent as any);
    return true;
  }, [editor]);

  const { handleEditorPasteCapture } = useEditorPaste({ editor, editable, shiftPressedRef });

  const focusEditorEnd = useCallback(() => {
    const lastBlock = editor.document.at(-1);
    if (lastBlock) {
      editor.setTextCursorPosition(lastBlock, "end");
    }
    editor.focus();
  }, [editor]);

  const handleEditorBlankMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!editable || event.button !== 0) return;
      const container = editorContainerRef.current;
      if (!container || !isBottomEditorBlankClick(event, container)) return;

      event.preventDefault();
      focusEditorEnd();
    },
    [editable, focusEditorEnd],
  );

  useEditorShortcuts({ shiftPressedRef });

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const patchClipboardPlainText = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      const selectionContext = getSelectedPlainTextContext(container);
      if (!selectionContext) return;

      const clipboardText = normalizeClipboardLineEndings(clipboardData.getData("text/plain"));
      if (
        shouldPreferVisibleSelectionText(
          clipboardText,
          selectionContext.selectedText,
          selectionContext.withinCodeBlock,
        )
      ) {
        clipboardData.setData("text/plain", selectionContext.selectedText);
        return;
      }

      // 富文本含链接/格式时 markdown 序列化与可见文本不相等，上面不会替换；
      // 仍需移除 markdown 软换行（hardBreak → "\<换行>"）残留的反斜杠 "\"。
      const cleaned = stripMarkdownHardBreaks(clipboardText);
      if (cleaned !== clipboardText) {
        clipboardData.setData("text/plain", cleaned);
      }
    };

    container.addEventListener("copy", patchClipboardPlainText);
    container.addEventListener("cut", patchClipboardPlainText);

    return () => {
      container.removeEventListener("copy", patchClipboardPlainText);
      container.removeEventListener("cut", patchClipboardPlainText);
    };
  }, []);

  // 中文输入法（IME）斜杠菜单修复：BlockNote 0.51 的 suggestion 插件没有 composition
  // 防护——用输入法上屏中文 query（如「、表格」）时，上屏那一刻的 replace transaction
  // 命中插件内部的关闭判定，菜单被关掉、query 丢失（英文逐字符输入不经 composition 故正常）。
  // 这里在 compositionend 后检测「当前块以触发符开头但菜单未显示」，程序化重新打开菜单
  // 并恢复 query：把光标移到触发符之后 → openSuggestionMenu 钉住 queryStartPos →
  // 光标移回上屏位置，query 即按 textBetween(触发符后, 光标) 自然算出。
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const TRIGGERS = ["、", "/"] as const;

    const rebuildSlashMenu = () => {
      if (!editor.isEditable) return;
      const sug = (editor.getExtension as any)("suggestionMenu") as
        | { shown: () => boolean; openSuggestionMenu: (trigger: string) => void }
        | undefined;
      // 菜单已显示则无需重建（避免与正常输入路径重复触发）
      if (!sug || sug.shown()) return;

      const view = editor.prosemirrorView;
      if (!view) return;
      const { selection } = view.state;
      if (!selection.empty) return;

      const $from = selection.$from;
      const parent = $from.parent;
      // 仅在文本块内、非代码块、非表格单元格内重建（与正常 slash 菜单的 shouldOpen 一致）
      if (!parent.isTextblock || parent.type.spec.code) return;
      if (parent.type.isInGroup("tableContent")) return;

      const trigger = TRIGGERS.find((t) => parent.textContent.startsWith(t));
      if (!trigger) return; // 触发符必须在块开头

      const blockStart = $from.start();
      const caret = selection.from;
      if (caret <= blockStart) return; // 光标必须落在触发符之后

      // A：光标移到触发符之后，作为 query 起点
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.create(view.state.doc, blockStart + trigger.length),
        ),
      );
      // B：打开菜单（queryStartPos 钉在当前光标）
      sug.openSuggestionMenu(trigger);
      // C：光标移回上屏后的位置，query 自然算出
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, caret)),
      );
    };

    const handleCompositionEnd = () => {
      // 等 ProseMirror 把 composition 落地进文档后再处理
      requestAnimationFrame(rebuildSlashMenu);
    };

    container.addEventListener("compositionend", handleCompositionEnd);
    return () =>
      container.removeEventListener("compositionend", handleCompositionEnd);
  }, [editor]);

  const commitEditorContent = useCallback(
    (targetPageId?: string) => {
      const safePageId = targetPageId ?? pageIdForUpdateRef.current;
      if (!safePageId) return;
      const nextContent = normalizePageContent(
        clonePageContent(editor.document as BlockNoteContent),
      );
      debouncedUpdate.cancel();
      const nextSig = getCachedContentSignature(nextContent);
      if (nextSig === syncedContentSignatureRef.current) return;
      syncedContentSignatureRef.current = nextSig;
      updatePage(safePageId, { content: nextContent });
    },
    [debouncedUpdate, editor, updatePage],
  );

  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

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
      editor.focus();
    };

    const handlePluginEnter = () => {
      window.setTimeout(() => {
        editor.focus();
      }, 0);
    };

    // 文件被外部修改后由 store 派发：把磁盘最新内容刷进当前编辑器。
    const handleReloadActiveEditor = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId?: string }>).detail;
      const state = usePages.getState();
      const targetId = detail?.pageId ?? state.activePageId;
      if (!targetId || targetId !== state.activePageId) return;
      if (targetId !== pageIdForUpdateRef.current) return;
      const p = state.pages[targetId];
      if (!p) return;
      const nextContent = normalizePageContent(p.content);
      syncedContentSignatureRef.current = getContentSignature(nextContent);
      debouncedUpdate.cancel();
      editor.replaceBlocks(editor.document, nextContent as any);
    };

    window.addEventListener("goose-note:flush-editor", handleFlush);
    window.addEventListener("goose-note:focus-editor-start", handleFocusStart);
    window.addEventListener("goose-note:plugin-enter", handlePluginEnter);
    window.addEventListener(
      "goose-note:reload-active-editor",
      handleReloadActiveEditor,
    );

    return () => {
      window.removeEventListener("goose-note:flush-editor", handleFlush);
      window.removeEventListener("goose-note:focus-editor-start", handleFocusStart);
      window.removeEventListener("goose-note:plugin-enter", handlePluginEnter);
      window.removeEventListener(
        "goose-note:reload-active-editor",
        handleReloadActiveEditor,
      );
    };
  }, [commitEditorContent, debouncedUpdate, editor]);

  useImperativeHandle(ref, () => ({
    editor,
  }), [editor]);

  useEffect(() => {
    (window as any).__gooseNoteEditor = editor;
    return () => {
      if ((window as any).__gooseNoteEditor === editor) {
        (window as any).__gooseNoteEditor = null;
      }
    };
  }, [editor]);

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(
    "light",
  );

  useEffect(() => {
    const resolve = () => {
      if (theme === "dark") {
        setEffectiveTheme("dark");
        return;
      }
      if (theme === "system") {
        setEffectiveTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        return;
      }
      setEffectiveTheme("light");
    };
    resolve();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => resolve();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  if (!page) return null;

  return (
    <EditorFindBar
      editor={editor} editable={editable} page={page}
      editorContainerRef={editorContainerRef}
      handleEditorBlankMouseDown={handleEditorBlankMouseDown}
      handleEditorPasteCapture={handleEditorPasteCapture}
      getSlashItems={getSlashItems} restoreFirstTitleHeading={restoreFirstTitleHeading}
      pageIdForUpdateRef={pageIdForUpdateRef}
      syncedContentSignatureRef={syncedContentSignatureRef}
      debouncedUpdate={debouncedUpdate}
      isEditorFullWidth={isEditorFullWidth} effectiveTheme={effectiveTheme}
      searchProviders={searchProviders} utools={utools} customActions={customActions}
      isSwitching={isSwitching}
    />
  );
});
