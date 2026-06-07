import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { flushSync } from "react-dom";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { useCreateBlockNote } from "@blocknote/react";
import { AIExtension } from "@blocknote/xl-ai";
import { zh as aiZh } from "@blocknote/xl-ai/locales";
import "@blocknote/xl-ai/style.css";
import { createGooseAITransport } from "@/components/editor/ai/transport/blocknoteAITransport";
import { zh } from "@blocknote/core/locales";
import "@blocknote/react/style.css";
import { createDebounce } from "@/components/editor/utils/debounce";
import {
  useEditorSettings,
  useEditorPageContext,
} from "@/components/editor/platform/hostContext";
import { useEditorPlatform } from "@/components/editor/platform/context";
import { clonePageContent, getContentSignature, normalizePageContent, type BlockNoteContent } from "@/components/editor/utils/blocknote-content";

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
import { getBlockNoteSlashMenuItems, filterSlashMenuItems } from "./blocknoteSlashItems";
import { gooseSelectAllExtension } from "@/components/editor/extensions/selectAllExtension";
import { gooseLinkKeyboardExtension } from "@/components/editor/extensions/linkKeyboardExtension";
import { gooseTabBehaviorExtension } from "@/components/editor/extensions/tabBehaviorExtension";
import { gooseCodeBlockKeyboardExtension } from "@/components/editor/extensions/codeBlockKeyboardExtension";
import { gooseCodeBlockLinkStripExtension } from "@/components/editor/extensions/codeBlockLinkStripExtension";
import { gooseCalloutKeyboardExtension } from "@/components/editor/extensions/calloutKeyboardExtension";
import { gooseFirstTitleEnterExtension } from "@/components/editor/extensions/firstTitleEnterExtension";
import { gooseCrossBlockDeleteExtension } from "@/components/editor/extensions/crossBlockDeleteExtension";
import { gooseFirstTitleGuardExtension } from "@/components/editor/inputrules/firstTitleGuard";
import { gooseQuoteInputRuleExtension } from "@/components/editor/inputrules/quoteInputRule";
import { gooseMarkdownInputRulesExtension } from "@/components/editor/inputrules/markdownInputRules";
import { gooseSuppressMarkdownInSpecialBlocksExtension } from "@/components/editor/inputrules/suppressMarkdownInSpecialBlocks";
import { gooseFakeSelectionExtension } from "@/components/editor/extensions/fakeSelectionExtension";
import { ArrowInputRuleExtension } from "@/components/editor/inputrules/arrowInputRule";
import { gooseToggleHeadingInputRuleExtension } from "@/components/editor/inputrules/toggleHeadingInputRule";
import { gooseInlineCodeEscapeExtension } from "@/components/editor/extensions/inlineCodeEscapeExtension";
import { gooseFindInPageExtension } from "@/components/editor/find/findInPagePlugin";
import { EditorComposer, editorSchema, getSelectedPlainTextContext, isBottomEditorBlankClick, normalizeClipboardLineEndings, shouldPreferVisibleSelectionText, stripMarkdownHardBreaks } from "./EditorComposer";
import { useEditorShortcuts } from "@/components/editor/hooks/useEditorShortcuts";
import { useEditorPaste } from "@/components/editor/hooks/useEditorPaste";

export interface EditorRef {
  editor: ReturnType<typeof useCreateBlockNote> | null;
}

interface EditorProps {
  editable?: boolean;
  /**
   * 需从斜杠菜单隐藏的项标题列表（按 title 精确匹配）。
   * 速记小窗用它砍掉表格/图片/AI 等重型项，主窗不传则保持全量。
   */
  hiddenSlashItemTitles?: string[];
}

export const Editor = forwardRef<EditorRef, EditorProps>(function Editor({ editable = true, hiddenSlashItemTitles }, ref) {
  const {
    theme,
    searchProviders,
    customActions,
    tableEvenColumnWidth,
    ai: aiSettings,
  } = useEditorSettings();
  const {
    page,
    isEditorFullWidth,
    onContentChange,
    getActivePageLocalFilePath,
  } = useEditorPageContext();
  const platform = useEditorPlatform();
  const activePageId = page?.id ?? null;

  const pageIdForUpdateRef = useRef<string | null>(null);
  const syncedContentSignatureRef = useRef<string | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const shiftPressedRef = useRef(false);
  pageIdForUpdateRef.current = page?.id ?? null;
  const [isSwitching, setIsSwitching] = useState(false);

  // 注入回调/数据的最新引用：供 useCreateBlockNote（deps=[]）的闭包与各 effect 读取，
  // 避免把 settings/pageContext 直接进依赖数组导致编辑器重建（行为不变）。
  const aiSettingsRef = useRef(aiSettings);
  aiSettingsRef.current = aiSettings;
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const getActivePageLocalFilePathRef = useRef(getActivePageLocalFilePath);
  getActivePageLocalFilePathRef.current = getActivePageLocalFilePath;
  const pageRef = useRef(page);
  pageRef.current = page;
  // platformRef 供 useCreateBlockNote 闭包（deps=[]）调用平台能力，
  // 同 aiSettingsRef 模式，避免闭包捕获旧 platform 引用。
  const platformRef = useRef(platform);
  platformRef.current = platform;

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
      // 禁用内置 quote 块自带的 extension(key: quote-block-shortcuts)。它含两条输入规则:
      // `> ` → 引用、`<引号> ` → 引用,以及 Mod-Alt-q。这里把 `>` 让给折叠功能
      // (行首 `> ` → 折叠标题/折叠列表,见 toggleHeadingInputRule),引用改用 `| `/`｜ `
      // (见 quoteInputRule)。斜杠菜单仍可插入引用,不受影响。
      disableExtensions: ["quote-block-shortcuts"],
      extensions: [
        gooseFirstTitleGuardExtension,
        gooseSuppressMarkdownInSpecialBlocksExtension,
        gooseTabBehaviorExtension,
        gooseSelectAllExtension,
        gooseLinkKeyboardExtension,
        gooseCodeBlockKeyboardExtension,
        gooseCodeBlockLinkStripExtension,
        gooseCalloutKeyboardExtension,
        gooseFirstTitleEnterExtension,
        gooseCrossBlockDeleteExtension,
        gooseQuoteInputRuleExtension,
        gooseMarkdownInputRulesExtension,
        gooseFakeSelectionExtension,
        ArrowInputRuleExtension,
        gooseToggleHeadingInputRuleExtension,
        gooseInlineCodeEscapeExtension,
        gooseFindInPageExtension,
        AIExtension({
          transport: createGooseAITransport({
            getSettings: () => aiSettingsRef.current,
            getModelId: () =>
              aiSettingsRef.current.selectedModelId || "gpt-4o-mini",
            getCustomFetch: () => platformRef.current.ai.customFetch,
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
          return platformRef.current.imageStorage.save(file, file.type);
        }
        return URL.createObjectURL(file);
      },
      resolveFileUrl: async (url) => {
        return platformRef.current.imageStorage.resolveRefToUrl(
          url,
          getActivePageLocalFilePathRef.current(),
        );
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
              platformRef.current.shell.openUrl(href);
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
      (_id: string, content: BlockNoteContent) => {
        syncedContentSignatureRef.current = getCachedContentSignature(content);
        onContentChangeRef.current(content);
      },
      800,
      { maxWait: 3000 },
    );
  }, []);

  const prevPageIdRef = useRef<string | null>(activePageId);
  useEffect(() => {
    if (activePageId === prevPageIdRef.current) return;
    prevPageIdRef.current = activePageId;

    debouncedUpdate.cancel();

    const p = pageRef.current;
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

      // normalize 改写了结构才回写（原 silent 持久化路径，经注入回调落库）
      if (p && getCachedContentSignature(p.content) !== nextSig) {
        onContentChangeRef.current(nextContent);
      }

      // 下一帧再隐藏骨架，确保 BlockNote 已绘制
      requestAnimationFrame(() => setIsSwitching(false));
    });

    return () => cancelAnimationFrame(rafId);
  }, [activePageId, debouncedUpdate, editor]);

  const getSlashItems = useCallback(
    async (query: string) => {
      let items = getBlockNoteSlashMenuItems(
        editor,
        aiSettingsRef.current.enabled,
      );
      if (hiddenSlashItemTitles && hiddenSlashItemTitles.length > 0) {
        const hidden = new Set(hiddenSlashItemTitles);
        const isDivider = (it: (typeof items)[number]) =>
          (it as { type?: string }).type === "divider";
        const kept = items.filter((item) => !hidden.has(item.title));
        // 砍项后清理冗余分隔线：折叠连续/首部 divider，再去尾部 divider。
        const collapsed: typeof items = [];
        for (const it of kept) {
          if (isDivider(it) && (collapsed.length === 0 || isDivider(collapsed[collapsed.length - 1]))) {
            continue;
          }
          collapsed.push(it);
        }
        while (collapsed.length > 0 && isDivider(collapsed[collapsed.length - 1])) {
          collapsed.pop();
        }
        items = collapsed;
      }
      return filterSlashMenuItems(items, query);
    },
    [editor, hiddenSlashItemTitles],
  );

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
      onContentChangeRef.current(nextContent);
    },
    [debouncedUpdate, editor],
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

    // 文件被外部修改后由宿主派发：把当前激活页最新内容刷进编辑器。
    const handleReloadActiveEditor = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId?: string }>).detail;
      const activePage = pageRef.current;
      const activeId = activePage?.id ?? null;
      const targetId = detail?.pageId ?? activeId;
      if (!targetId || targetId !== activeId) return;
      if (targetId !== pageIdForUpdateRef.current) return;
      if (!activePage) return;
      const nextContent = normalizePageContent(activePage.content);
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
    <EditorComposer
      editor={editor} editable={editable} page={page}
      editorContainerRef={editorContainerRef}
      handleEditorBlankMouseDown={handleEditorBlankMouseDown}
      handleEditorPasteCapture={handleEditorPasteCapture}
      getSlashItems={getSlashItems}
      pageIdForUpdateRef={pageIdForUpdateRef}
      syncedContentSignatureRef={syncedContentSignatureRef}
      debouncedUpdate={debouncedUpdate}
      isEditorFullWidth={isEditorFullWidth} effectiveTheme={effectiveTheme}
      tableEvenColumnWidth={tableEvenColumnWidth}
      searchProviders={searchProviders} customActions={customActions}
      isSwitching={isSwitching}
    />
  );
});

