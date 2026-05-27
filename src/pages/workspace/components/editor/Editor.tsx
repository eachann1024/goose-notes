import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { EditorState } from "@tiptap/pm/state";
import { Fragment, Slice } from "@tiptap/pm/model";
import { useCreateBlockNote } from "@blocknote/react";
import { AIExtension } from "@blocknote/xl-ai";
import { zh as aiZh } from "@blocknote/xl-ai/locales";
import "@blocknote/xl-ai/style.css";
import { createGooseAITransport } from "@/lib/ai-provider/blocknoteAITransport";
import { zh } from "@blocknote/core/locales";
import "@blocknote/react/style.css";
import debounce from "lodash.debounce";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { clonePageContent, getContentSignature, normalizePageContent, ensureFirstTitleHeading, type BlockNoteContent } from "@/lib/blocknote-content";
import { getBlockNoteSlashMenuItems, filterSlashMenuItems } from "@/pages/workspace/components/command/blocknoteSlashItems";
import { gooseSelectAllExtension } from "./selectAllExtension";
import { gooseLinkKeyboardExtension } from "./linkKeyboardExtension";
import { gooseTabBehaviorExtension } from "./tabBehaviorExtension";
import { gooseCodeBlockKeyboardExtension } from "./codeBlockKeyboardExtension";
import { gooseCalloutKeyboardExtension } from "./calloutKeyboardExtension";
import { gooseQuoteInputRuleExtension } from "./quoteInputRule";
import { gooseMarkdownInputRulesExtension } from "./markdownInputRules";
import { gooseFakeSelectionExtension } from "./fakeSelectionExtension";
import { ArrowInputRuleExtension } from "./arrowInputRule";
import { gooseInlineCodeEscapeExtension } from "./inlineCodeEscapeExtension";
import { gooseFindInPageExtension } from "./findInPagePlugin";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { EditorFindBar, editorSchema, getSelectedPlainTextContext, isBottomEditorBlankClick, isValidUrl, looksLikeMarkdownFragment, normalizeClipboardLineEndings, normalizeMarkdownPasteText, parseMarkdownLink, shouldPreferVisibleSelectionText } from "./EditorFindBar";
import { useEditorShortcuts } from "./hooks/useEditorShortcuts";

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

  const initialContentRef = useRef(normalizePageContent(page?.content));
  // 初次 mount 时给 syncedContentSignatureRef 设置基线，
  // 否则切走时 flush 会把"只读打开"误判成编辑、刷新 updatedAt。
  if (syncedContentSignatureRef.current === null) {
    syncedContentSignatureRef.current = getContentSignature(initialContentRef.current);
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
        gooseCalloutKeyboardExtension,
        gooseQuoteInputRuleExtension,
        gooseMarkdownInputRulesExtension,
        gooseFakeSelectionExtension,
        ArrowInputRuleExtension,
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
        // 网络 URL / data: / blob: 直接用
        if (
          url.startsWith("http://") ||
          url.startsWith("https://") ||
          url.startsWith("data:") ||
          url.startsWith("blob:")
        ) {
          return url;
        }

        // 本地文件路径：优先相对于页面文件目录解析（./assets/ 等相对路径）
        const { isLocalFilePath, resolveToAbsolute, readLocalFileAsBlob } = await import("@/lib/imageStorage/strategies/file-system");
        if (isLocalFilePath(url)) {
          const activePageId = usePages.getState().activePageId;
          const activePage = activePageId ? usePages.getState().pages[activePageId] : null;
          if (activePage?.localFilePath) {
            // 取页面文件所在目录
            const pageDir = activePage.localFilePath.replace(/[\\/][^\\/]+$/, '');
            const fullPath = resolveToAbsolute(pageDir, url);
            const blob = readLocalFileAsBlob(fullPath);
            if (blob) return URL.createObjectURL(blob);
          }
        }

        // att: / uuid: / 兜底 → 走 imageStorage.load()（使用笔记本根目录）
        const { imageStorage } = await import("@/lib/imageStorage");
        const blob = await imageStorage.load(url);
        if (blob) return URL.createObjectURL(blob);
        return url;
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
    return debounce(
      (id: string, content: BlockNoteContent) => {
        syncedContentSignatureRef.current = getContentSignature(content);
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
    const nextContent = normalizePageContent(p?.content);
    const sig = getContentSignature(nextContent);

    pageIdForUpdateRef.current = p?.id ?? null;
    syncedContentSignatureRef.current = sig;

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

    if (p && getContentSignature(p.content) !== sig) {
      updatePage(p.id, { content: nextContent }, { silent: true });
    }
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
        !shouldPreferVisibleSelectionText(
          clipboardText,
          selectionContext.selectedText,
          selectionContext.withinCodeBlock,
        )
      ) {
        return;
      }

      clipboardData.setData("text/plain", selectionContext.selectedText);
    };

    container.addEventListener("copy", patchClipboardPlainText);
    container.addEventListener("cut", patchClipboardPlainText);

    return () => {
      container.removeEventListener("copy", patchClipboardPlainText);
      container.removeEventListener("cut", patchClipboardPlainText);
    };
  }, []);

  const commitEditorContent = useCallback(
    (targetPageId?: string) => {
      const safePageId = targetPageId ?? pageIdForUpdateRef.current;
      if (!safePageId) return;
      const nextContent = normalizePageContent(
        clonePageContent(editor.document as BlockNoteContent),
      );
      debouncedUpdate.cancel();
      const nextSig = getContentSignature(nextContent);
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
    />
  );
});
