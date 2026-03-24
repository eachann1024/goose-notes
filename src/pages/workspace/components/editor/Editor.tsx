import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { Selection, Plugin, PluginKey } from "@tiptap/pm/state";
import { SuggestionPluginKey } from "@tiptap/suggestion";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import debounce from "lodash.debounce";
import "tippy.js/dist/tippy.css";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { EditorContextMenu } from "./EditorContextMenu";
import { ImageBubbleMenu } from "./ImageBubbleMenu";
import { LinkHoverMenu } from "@/extensions/LinkHoverMenu";
import { TableHoverControls } from "./TableHoverControls";
import { TableRowColHandles } from "./TableRowColHandles";
import { AiInputPopover } from "./AiInputPopover";
import { editorExtensions } from "./editorExtensions";
import {
  getImageFromClipboard,
  processImageForStorageV2,
} from "@/lib/imageProcessor";

interface EditorProps {
  editable?: boolean;
}

interface FindMatchRange {
  from: number;
  to: number;
}

interface FindWidgetMeta {
  clear?: boolean;
  decorations?: DecorationSet;
}

const editorFindPluginKey = new PluginKey<DecorationSet>(
  "goose-note-editor-find",
);
const IMAGE_PASTE_GUARD_KEY = "__gooseImagePasteHandled__";

function getContentSignature(content: unknown): string {
  try {
    return JSON.stringify(content ?? null);
  } catch {
    return "__goose-note-unserializable-content__";
  }
}

function collectFindMatches(
  doc: ProseMirrorNode,
  rawQuery: string,
  matchCase: boolean,
): FindMatchRange[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const normalizedQuery = matchCase ? query : query.toLowerCase();
  const matches: FindMatchRange[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;

    const text = matchCase ? node.text : node.text.toLowerCase();
    let startIndex = 0;
    while (startIndex <= text.length - normalizedQuery.length) {
      const foundIndex = text.indexOf(normalizedQuery, startIndex);
      if (foundIndex === -1) break;
      matches.push({
        from: pos + foundIndex,
        to: pos + foundIndex + query.length,
      });
      startIndex = foundIndex + Math.max(query.length, 1);
    }
    return true;
  });

  return matches;
}

function createFindDecorations(
  doc: ProseMirrorNode,
  matches: FindMatchRange[],
  activeIndex: number,
): DecorationSet {
  if (!matches.length) return DecorationSet.empty;
  const decorations = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class:
        index === activeIndex
          ? "editor-find-match editor-find-match-active"
          : "editor-find-match",
    }),
  );
  return DecorationSet.create(doc, decorations);
}

function areFindMatchesEqual(
  previous: FindMatchRange[],
  next: FindMatchRange[],
): boolean {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    if (
      previous[index].from !== next[index].from ||
      previous[index].to !== next[index].to
    ) {
      return false;
    }
  }
  return true;
}

export function Editor({ editable = true }: EditorProps) {
  const {
    activePageId,
    getPage,
    updatePage,
    searchHighlightQuery,
    searchHighlightPageId,
    searchHighlightNonce,
    handledSearchHighlightNonce,
    setSearchHighlightQuery,
    setSearchHighlightPageId,
    setHandledSearchHighlightNonce,
  } = usePages();
  const page = activePageId ? getPage(activePageId) : undefined;
  const { notebooks } = useNotebooks();
  const { searchProviders, utools, customActions, globalEditorFullWidth } =
    useSettings();
  const notebook = page ? notebooks[page.workspaceId] : undefined;
  const isEditorFullWidth = Boolean(
    notebook?.editorFullWidth ?? globalEditorFullWidth,
  );

  const prevPageIdRef = useRef<string | null>(null);
  const debouncedUpdateRef = useRef<ReturnType<typeof debounce> | null>(null);
  const pageIdForUpdateRef = useRef<string | null>(null);
  const syncedContentSignatureRef = useRef<string | null>(null);
  const hasFindDecorationsRef = useRef(false);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const bypassEnterMarkResetRef = useRef(false);
  const [findOverlayContainer, setFindOverlayContainer] =
    useState<Element | null>(null);
  const findMatchesRef = useRef<FindMatchRange[]>([]);
  const activeFindIndexRef = useRef(-1);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findMatchCase, setFindMatchCase] = useState(false);
  const [findMatches, setFindMatches] = useState<FindMatchRange[]>([]);
  const [activeFindIndex, setActiveFindIndex] = useState(-1);

  const debouncedUpdate = useMemo(() => {
    const fn = debounce(
      (id: string, content: any) => {
        syncedContentSignatureRef.current = getContentSignature(content);
        updatePage(id, { content });
      },
      800,
      { maxWait: 3000 },
    );
    debouncedUpdateRef.current = fn;
    return fn;
  }, [updatePage]);

  const editor: TiptapEditor | null = useEditor({
    editable,
    extensions: editorExtensions,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)] leading-relaxed",
        ),
      },
      handleScrollToSelection: (view) => {
        if (view.dom.dataset.imeScrollLock === "1") {
          return true;
        }
        return false;
      },
      handleKeyDown: (view, event): boolean => {
        if (!editor || event.isComposing || event.keyCode === 229) return false;
        // Skip keydown fired right after compositionend (Safari/WebKit IME)
        if (view.composing) return false;

        const suggestionState = SuggestionPluginKey.getState(view.state) as
          | { active?: boolean }
          | undefined;
        if (suggestionState?.active && event.key === "Enter") {
          return false;
        }

        if (event.key === "Enter" && bypassEnterMarkResetRef.current) {
          return false;
        }

        if (event.key === "Enter") {
          const { state } = editor;
          const { selection } = state;
          const { $from, empty } = selection;
          const isAtBlockEnd =
            !event.shiftKey &&
            empty &&
            $from.parentOffset === $from.parent.content.size;
          const activeInlineMarks =
            state.storedMarks && state.storedMarks.length > 0
              ? state.storedMarks
              : $from.marks();
          const shouldResetMarksAfterEnter =
            isAtBlockEnd && activeInlineMarks.length > 0;
          const shouldInsertAfterCollapsedHeading =
            isAtBlockEnd &&
            $from.parent.type.name === "heading" &&
            $from.parent.attrs?.collapsed;

          if (empty && editor.isActive("blockquote")) {
            const isAtBlockStart = $from.parentOffset === 0;
            const isFirstNodeInQuote =
              $from.depth > 1 && $from.index($from.depth - 1) === 0;

            if (isAtBlockStart && isFirstNodeInQuote) {
              if (event.shiftKey) {
                return false;
              } else {
                event.preventDefault();
                let depth = $from.depth;
                while (
                  depth > 0 &&
                  state.doc.nodeAt($from.before(depth))?.type.name !==
                    "blockquote"
                ) {
                  depth--;
                }

                if (depth > 0) {
                  const quoteEndPos = $from.after(depth);
                  editor
                    .chain()
                    .focus()
                    .insertContentAt(quoteEndPos, { type: "paragraph" })
                    .run();
                  return true;
                }
              }
            }
          }

          if (shouldInsertAfterCollapsedHeading) {
            event.preventDefault();

            const headingStartPos = $from.before($from.depth);
            const headingLevel = Number($from.parent.attrs?.level ?? 1);
            const { doc } = state;
            let sectionEndPos = doc.content.size;
            let scanPos = 0;
            let foundCurrentHeading = false;

            for (let index = 0; index < doc.childCount; index += 1) {
              const node = doc.child(index);

              if (!foundCurrentHeading) {
                if (scanPos === headingStartPos) {
                  foundCurrentHeading = true;
                }
                scanPos += node.nodeSize;
                continue;
              }

              if (
                node.type.name === "heading" &&
                Number(node.attrs?.level ?? 1) <= headingLevel
              ) {
                sectionEndPos = scanPos;
                break;
              }

              scanPos += node.nodeSize;
            }

            if (!foundCurrentHeading) {
              return false;
            }

            const paragraph = state.schema.nodes.paragraph.create({
              collapseTailBreak: true,
            });
            let tr = state.tr.insert(sectionEndPos, paragraph);
            tr = tr.setSelection(Selection.near(tr.doc.resolve(sectionEndPos + 1)));
            tr = tr.setStoredMarks([]);
            editor.view.dispatch(tr.scrollIntoView());
            return true;
          }

          if (shouldResetMarksAfterEnter) {
            event.preventDefault();
            let entered = false;
            try {
              bypassEnterMarkResetRef.current = true;
              entered = editor.commands.enter();
            } finally {
              bypassEnterMarkResetRef.current = false;
            }

            if (entered && !editor.isDestroyed) {
              editor.view.dispatch(editor.state.tr.setStoredMarks([]));
            }

            return entered;
          }
        }

        if (event.key === "Backspace") {
          const { state } = editor;
          const { selection } = state;
          const { $from, empty } = selection;

          if (empty && $from.parentOffset === 0) {
            const parent = $from.parent;
            // 如果在空段落的开头，检查前面是什么块
            if (parent.type.name === "paragraph" && parent.content.size === 0) {
              const paragraphStart = $from.before($from.depth);
              const paragraphEnd = $from.after($from.depth);

              // 用 nodeBefore 获取真正的前一个兄弟节点
              const $start = state.doc.resolve(paragraphStart);
              const prevNode = $start.nodeBefore;

              if (
                prevNode &&
                (prevNode.type.name === "blockquote" ||
                  prevNode.type.name === "heading")
              ) {
                event.preventDefault();
                const { view } = editor;

                // 删除空段落并将光标移到前一个节点末尾
                let tr = state.tr.delete(paragraphStart, paragraphEnd);
                const cursorPos = paragraphStart - 1;
                tr = tr.setSelection(
                  Selection.near(tr.doc.resolve(cursorPos), -1),
                );
                view.dispatch(tr);
                return true;
              }
            }
          }
        }

        if (event.key === "Tab") {
          event.preventDefault();

          if (editor.isActive("table")) {
            if (event.shiftKey) {
              editor.chain().focus().goToPreviousCell().run();
            } else {
              editor.chain().focus().goToNextCell().run();
            }
            return true;
          }
        }

        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const safePageId = pageIdForUpdateRef.current;
      if (safePageId) {
        const nextContent = editor.getJSON();
        syncedContentSignatureRef.current = getContentSignature(nextContent);
        debouncedUpdate(safePageId, nextContent);
      }
    },
  });

  const commitEditorContent = useCallback(
    (targetPageId?: string) => {
      if (!editor || editor.isDestroyed) return;
      const safePageId = targetPageId ?? pageIdForUpdateRef.current;
      if (!safePageId) return;
      const nextContent = editor.getJSON();
      debouncedUpdateRef.current?.cancel();
      syncedContentSignatureRef.current = getContentSignature(nextContent);
      updatePage(safePageId, { content: nextContent });
    },
    [editor, updatePage],
  );

  const getLocalFileTitle = (filePath: string) => {
    const name = filePath.split(/[\\/]/).pop() || "";
    const base = name.replace(/\.(md|markdown)$/i, "").trim();
    return base || "无标题";
  };

  const clearFindDecorations = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    if (!hasFindDecorationsRef.current) return;
    const tr = editor.state.tr.setMeta(editorFindPluginKey, {
      clear: true,
    } as FindWidgetMeta);
    editor.view.dispatch(tr);
    hasFindDecorationsRef.current = false;
  }, [editor]);

  const syncFindDecorations = useCallback(
    (matches: FindMatchRange[], activeIndex: number) => {
      if (!editor || editor.isDestroyed) return;
      const decorations = createFindDecorations(
        editor.state.doc,
        matches,
        activeIndex,
      );
      const tr = editor.state.tr.setMeta(editorFindPluginKey, {
        decorations,
      } as FindWidgetMeta);
      editor.view.dispatch(tr);
      hasFindDecorationsRef.current = matches.length > 0;
    },
    [editor],
  );

  const scrollToFindMatch = useCallback(
    (match: FindMatchRange) => {
      if (!editor || editor.isDestroyed) return;
      const container = document.querySelector(
        ".page-scroll-container",
      ) as HTMLElement | null;
      try {
        const coords = editor.view.coordsAtPos(match.from);
        if (container) {
          const rect = container.getBoundingClientRect();
          const targetTop =
            coords.top - rect.top + container.scrollTop - rect.height / 3;
          const safeTop = Math.max(0, targetTop);
          container.scrollTo({
            top: safeTop,
            behavior: resolveEditorScrollBehavior({
              distance: safeTop - container.scrollTop,
              smoothThreshold: 200,
            }),
          });
        } else {
          editor.commands.scrollIntoView();
        }
      } catch {
        editor.commands.scrollIntoView();
      }
    },
    [editor],
  );

  const recomputeFindMatches = useCallback(
    (query: string, options?: { keepActive?: boolean }) => {
      if (!editor || editor.isDestroyed) return;

      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        if (findMatchesRef.current.length) {
          findMatchesRef.current = [];
          setFindMatches([]);
        }
        if (activeFindIndexRef.current !== -1) {
          activeFindIndexRef.current = -1;
          setActiveFindIndex(-1);
        }
        return;
      }

      const nextMatches = collectFindMatches(
        editor.state.doc,
        normalizedQuery,
        findMatchCase,
      );
      if (!areFindMatchesEqual(findMatchesRef.current, nextMatches)) {
        findMatchesRef.current = nextMatches;
        setFindMatches(nextMatches);
      }

      if (!nextMatches.length) {
        if (activeFindIndexRef.current !== -1) {
          activeFindIndexRef.current = -1;
          setActiveFindIndex(-1);
        }
        return;
      }

      let nextIndex = 0;
      if (options?.keepActive && activeFindIndexRef.current >= 0) {
        const currentMatch = findMatchesRef.current[activeFindIndexRef.current];
        if (currentMatch) {
          const sameIndex = nextMatches.findIndex(
            (item) =>
              item.from === currentMatch.from && item.to === currentMatch.to,
          );
          if (sameIndex !== -1) {
            if (activeFindIndexRef.current !== sameIndex) {
              activeFindIndexRef.current = sameIndex;
              setActiveFindIndex(sameIndex);
            }
            return;
          }
        }
      }

      const cursorPos = editor.state.selection.from;
      const nearestIndex = nextMatches.findIndex(
        (item) => item.from >= cursorPos,
      );
      nextIndex = nearestIndex === -1 ? 0 : nearestIndex;
      if (activeFindIndexRef.current !== nextIndex) {
        activeFindIndexRef.current = nextIndex;
        setActiveFindIndex(nextIndex);
      }
    },
    [editor, findMatchCase],
  );

  const jumpFindMatch = useCallback(
    (direction: 1 | -1) => {
      if (!editor || editor.isDestroyed) return;
      const normalizedQuery = findQuery.trim();
      if (!normalizedQuery) return;

      let nextMatches = findMatchesRef.current;
      if (!nextMatches.length) {
        nextMatches = collectFindMatches(
          editor.state.doc,
          normalizedQuery,
          findMatchCase,
        );
        findMatchesRef.current = nextMatches;
        setFindMatches(nextMatches);
      }

      if (!nextMatches.length) {
        if (activeFindIndexRef.current !== -1) {
          activeFindIndexRef.current = -1;
          setActiveFindIndex(-1);
        }
        return;
      }

      const total = nextMatches.length;
      const nextIndex =
        activeFindIndexRef.current < 0
          ? direction > 0
            ? 0
            : total - 1
          : (activeFindIndexRef.current + direction + total) % total;
      activeFindIndexRef.current = nextIndex;
      setActiveFindIndex(nextIndex);
    },
    [editor, findQuery, findMatchCase],
  );

  const openFindWidget = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { from, to, empty } = editor.state.selection;
    const selectedText = empty
      ? ""
      : editor.state.doc.textBetween(from, to, "\n").trim();

    setIsFindOpen(true);
    if (selectedText) {
      setFindQuery(selectedText);
    }
  }, [editor]);

  const closeFindWidget = useCallback(
    (focusEditor: boolean) => {
      setIsFindOpen(false);
      setFindQuery("");
      findMatchesRef.current = [];
      activeFindIndexRef.current = -1;
      setFindMatches([]);
      setActiveFindIndex(-1);
      if (focusEditor) {
        editor?.commands.focus();
      }
    },
    [editor],
  );

  const handleFindInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        jumpFindMatch(event.shiftKey ? -1 : 1);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeFindWidget(true);
      }
    },
    [jumpFindMatch, closeFindWidget],
  );

  useEffect(() => {
    const flush = () => {
      commitEditorContent();
    };
    const handleFlushEditor = (event: Event) => {
      const customEvent = event as CustomEvent<{ immediate?: boolean }>;
      if (customEvent.detail?.immediate) {
        commitEditorContent();
        return;
      }
      commitEditorContent();
    };

    window.addEventListener("beforeunload", flush);
    window.addEventListener("goose-note:flush-editor", handleFlushEditor);

    const handleFocusStart = () => {
      setTimeout(() => {
        editor?.commands.focus("start");
        document
          .querySelector(".page-scroll-container")
          ?.scrollTo({ top: 0 });
      }, 50);
    };

    window.addEventListener("goose-note:focus-editor-start", handleFocusStart);

    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("goose-note:flush-editor", handleFlushEditor);
      window.removeEventListener(
        "goose-note:focus-editor-start",
        handleFocusStart,
      );
    };
  }, [commitEditorContent, editor]);

  useEffect(() => {
    if (!editor) return;

    const findPlugin = new Plugin<DecorationSet>({
      key: editorFindPluginKey,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, decorationSet) => {
          const meta = tr.getMeta(editorFindPluginKey) as
            | FindWidgetMeta
            | undefined;
          if (meta?.clear) return DecorationSet.empty;
          if (meta?.decorations) return meta.decorations;
          return tr.docChanged
            ? decorationSet.map(tr.mapping, tr.doc)
            : decorationSet;
        },
      },
      props: {
        decorations: (state) =>
          editorFindPluginKey.getState(state) ?? DecorationSet.empty,
      },
    });

    editor.registerPlugin(findPlugin);

    return () => {
      try {
        editor.unregisterPlugin(editorFindPluginKey);
      } catch {
        // ignore unregister errors
      }
    };
  }, [editor]);

  useEffect(() => {
    if (!isFindOpen) return;
    const timer = window.setTimeout(() => {
      const input = findInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isFindOpen]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const container =
      editor.view.dom.closest(".workspace-main-sheet") ??
      editor.view.dom.closest(".workspace-editor-surface") ??
      editor.view.dom.parentElement;
    setFindOverlayContainer(container);
  }, [editor, activePageId]);

  useEffect(() => {
    if (!editor) return;
    if (!isFindOpen) return;
    recomputeFindMatches(findQuery);
  }, [
    editor,
    isFindOpen,
    findQuery,
    findMatchCase,
    activePageId,
    recomputeFindMatches,
  ]);

  useEffect(() => {
    if (!editor || !isFindOpen || !findQuery.trim()) return;
    const handleEditorUpdate = () => {
      recomputeFindMatches(findQuery, { keepActive: true });
    };
    editor.on("update", handleEditorUpdate);
    return () => {
      editor.off("update", handleEditorUpdate);
    };
  }, [editor, isFindOpen, findQuery, recomputeFindMatches]);

  useEffect(() => {
    findMatchesRef.current = findMatches;
  }, [findMatches]);

  useEffect(() => {
    activeFindIndexRef.current = activeFindIndex;
  }, [activeFindIndex]);

  useEffect(() => {
    if (!editor) return;
    if (!isFindOpen || !findQuery.trim() || !findMatches.length) {
      clearFindDecorations();
      return;
    }
    syncFindDecorations(findMatches, activeFindIndex);
  }, [
    editor,
    isFindOpen,
    findQuery,
    findMatches,
    activeFindIndex,
    syncFindDecorations,
    clearFindDecorations,
  ]);

  useEffect(() => {
    if (!isFindOpen || activeFindIndex < 0) return;
    const activeMatch = findMatches[activeFindIndex];
    if (!activeMatch) return;
    scrollToFindMatch(activeMatch);
  }, [isFindOpen, activeFindIndex, findMatches, scrollToFindMatch]);

  useEffect(() => {
    if (!editor) return;
    const isTargetInEditorScope = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return !!(
        target.closest(".ProseMirror") || target.closest(".editor-inline-find")
      );
    };

    const handleShortcut = (event: KeyboardEvent) => {
      if (!isTargetInEditorScope(event.target)) return;

      if (event.key === "Escape" && isFindOpen) {
        event.preventDefault();
        closeFindWidget(true);
      }
    };

    window.addEventListener("keydown", handleShortcut, true);
    return () => {
      window.removeEventListener("keydown", handleShortcut, true);
    };
  }, [editor, isFindOpen, closeFindWidget]);

  useEffect(() => {
    const handleOpenFind = () => {
      openFindWidget();
    };
    const handleFindNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{ direction?: 1 | -1 }>;
      const direction = customEvent.detail?.direction === -1 ? -1 : 1;
      jumpFindMatch(direction);
    };

    window.addEventListener("goose-note:editor-find-open", handleOpenFind);
    window.addEventListener("goose-note:editor-find-nav", handleFindNavigate);
    return () => {
      window.removeEventListener("goose-note:editor-find-open", handleOpenFind);
      window.removeEventListener(
        "goose-note:editor-find-nav",
        handleFindNavigate,
      );
    };
  }, [openFindWidget, jumpFindMatch]);

  useEffect(() => {
    findMatchesRef.current = [];
    activeFindIndexRef.current = -1;
    setIsFindOpen(false);
    setFindQuery("");
    setFindMatches([]);
    setActiveFindIndex(-1);
  }, [activePageId]);

  useEffect(() => {
    if (!editor || !page || !activePageId) return;

    const isSamePage = activePageId === prevPageIdRef.current;
    const isPageLoaded = pageIdForUpdateRef.current === activePageId;
    const pageContentSignature = getContentSignature(page.content);
    const hasExternalContentRefresh =
      isSamePage &&
      isPageLoaded &&
      syncedContentSignatureRef.current !== pageContentSignature;

    if (isSamePage && isPageLoaded && !hasExternalContentRefresh) return;

    if (!hasExternalContentRefresh) {
      commitEditorContent(pageIdForUpdateRef.current ?? undefined);
    }
    pageIdForUpdateRef.current = null;

    let cancelled = false;
    const applyContent = () => {
      if (cancelled) return;
      editor.commands.blur();

      let contentToSet = page.content;
      let appliedContentSignature = pageContentSignature;

      // 确保内容有标题行（第一行为 h1）
      if (!contentToSet.content || contentToSet.content.length === 0) {
        contentToSet = {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 1 } },
            { type: "paragraph" },
          ],
        };
      } else {
        const firstNode = contentToSet.content[0];
        if (
          !firstNode ||
          firstNode.type !== "heading" ||
          firstNode.attrs?.level !== 1
        ) {
          contentToSet = {
            ...contentToSet,
            content: [
              { type: "heading", attrs: { level: 1 } },
              ...(contentToSet.content || []),
            ],
          };
        }
      }

      let shouldPersistTitle = false;
      if (page.localFilePath) {
        const firstNode = contentToSet.content?.[0];
        if (
          firstNode?.type === "heading" &&
          firstNode.attrs?.level === 1 &&
          (!firstNode.content || firstNode.content.length === 0)
        ) {
          const nextTitle = getLocalFileTitle(page.localFilePath);
          const nextNodes = [...(contentToSet.content || [])];
          nextNodes[0] = {
            ...firstNode,
            content: [{ type: "text", text: nextTitle }],
          };
          contentToSet = { ...contentToSet, content: nextNodes };
          shouldPersistTitle = true;
        }
      }

      appliedContentSignature = getContentSignature(contentToSet);

      // 使用 transaction 设置内容，明确不记录到历史
      const { tr } = editor.state;
      const newDoc = editor.schema.nodeFromJSON(contentToSet);
      tr.replaceWith(0, editor.state.doc.content.size, newDoc.content);
      tr.setMeta("addToHistory", false);
      editor.view.dispatch(tr);

      pageIdForUpdateRef.current = activePageId;
      prevPageIdRef.current = activePageId;
      syncedContentSignatureRef.current = appliedContentSignature;

      if (shouldPersistTitle) {
        updatePage(activePageId, { content: contentToSet });
      }

      // 如果是新页面（标题为空且内容为空），强制聚焦到标题
      const isNewPage =
        page.createdAt === page.updatedAt &&
        (!page.content?.content?.[0]?.content ||
          page.content.content[0].content.length === 0);

      if (isNewPage) {
        setTimeout(() => {
          editor.commands.focus("start");
        }, 50);
        return;
      }

      if (
        page.content?.content?.[0]?.type === "paragraph" &&
        !page.content.content[0].content
      ) {
        editor.commands.focus("end");
      } else {
        const firstPos = editor.state.doc.content.size > 0 ? 1 : 0;
        if (firstPos > 0) {
          try {
            const resolved = editor.state.doc.resolve(firstPos);
            const parent = resolved.parent;
            if (parent.isTextblock && parent.inlineContent) {
              editor.commands.setTextSelection(firstPos);
            } else {
              editor.commands.focus("start");
            }
          } catch {
            editor.commands.focus("start");
          }
        }
      }
    };

    setTimeout(applyContent, 0);
    return () => {
      cancelled = true;
    };
  }, [activePageId, commitEditorContent, page, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    (window as any).__gooseNoteSettings = { utools };
  }, [utools]);

  useEffect(() => {
    if (!editor) return;

    (window as any).__gooseNoteEditor = editor;

    const handlePaste = async (event: ClipboardEvent) => {
      const guardedEvent = event as ClipboardEvent & {
        [IMAGE_PASTE_GUARD_KEY]?: boolean;
      };
      if (
        guardedEvent.defaultPrevented ||
        guardedEvent[IMAGE_PASTE_GUARD_KEY]
      ) {
        return;
      }

      const imageFile = getImageFromClipboard(guardedEvent);
      if (!imageFile) return;

      guardedEvent[IMAGE_PASTE_GUARD_KEY] = true;
      guardedEvent.preventDefault();
      try {
        const src = await processImageForStorageV2(imageFile);
        const { state, view } = editor;
        const nodeType = state.schema.nodes.imageResize || state.schema.nodes.image;
        if (!nodeType) return;
        const imageNode = nodeType.create({ src });
        const tr = state.tr.replaceSelectionWith(imageNode, false);
        tr.setMeta("uiEvent", "paste");
        tr.setMeta("addToHistory", true);
        view.dispatch(tr.scrollIntoView());
      } catch (err) {
        console.error("Failed to paste image:", err);
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("paste", handlePaste);

    return () => {
      if ((window as any).__gooseNoteEditor === editor) {
        (window as any).__gooseNoteEditor = null;
      }
      editorElement.removeEventListener("paste", handlePaste);
    };
  }, [editor]);

  // 搜索高亮：跳转到匹配位置并闪烁高亮
  useEffect(() => {
    if (!editor || !searchHighlightQuery || !activePageId) return;
    if (searchHighlightPageId && searchHighlightPageId !== activePageId) {
      return;
    }
    if (handledSearchHighlightNonce === searchHighlightNonce) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let retryTimer: number | null = null;
    let clearTimer: number | null = null;

    const clearTimers = () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (clearTimer) clearTimeout(clearTimer);
      retryTimer = null;
      clearTimer = null;
    };

    const clearHighlightMarks = () => {
      const { state, view } = editor;
      const markType = state.schema.marks.highlight;
      if (!markType) return;
      const tr = state.tr;
      state.doc.descendants((node, pos) => {
        if (!node.isText) return true;
        const marks = node.marks.filter(
          (mark) =>
            mark.type === markType &&
            mark.attrs?.color === "var(--goose-search-highlight)",
        );
        if (marks.length) {
          const from = pos;
          const to = pos + node.nodeSize;
          marks.forEach((mark) => {
            tr.removeMark(from, to, mark);
          });
        }
        return true;
      });
      if (tr.steps.length > 0) {
        view.dispatch(tr);
      }
      clearStoredHighlightMarks();
    };

    const clearStoredHighlightMarks = () => {
      const { state, view } = editor;
      const markType = state.schema.marks.highlight;
      if (!markType || !state.storedMarks?.length) return;
      const remainingMarks = state.storedMarks.filter(
        (mark) =>
          !(
            mark.type === markType &&
            mark.attrs?.color === "var(--goose-search-highlight)"
          ),
      );
      if (remainingMarks.length !== state.storedMarks.length) {
        view.dispatch(
          state.tr.setStoredMarks(
            remainingMarks.length ? remainingMarks : null,
          ),
        );
      }
    };

    const schedule = (delay: number) => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = window.setTimeout(runHighlight, delay);
    };

    const runHighlight = () => {
      if (cancelled) return;
      if (pageIdForUpdateRef.current !== activePageId) {
        if (attempts < 20) {
          attempts += 1;
          schedule(80);
        }
        return;
      }

      const doc = editor.state.doc;
      const query = searchHighlightQuery.toLowerCase();
      let foundPos: number | null = null;
      let foundEnd: number | null = null;

      // 遍历文档查找匹配文本
      doc.descendants((node, pos) => {
        if (foundPos !== null) return false;
        if (node.isText && node.text) {
          const index = node.text.toLowerCase().indexOf(query);
          if (index !== -1) {
            foundPos = pos + index;
            foundEnd = foundPos + searchHighlightQuery.length;
            return false;
          }
        }
        return true;
      });

      if (foundPos !== null && foundEnd !== null) {
        editor.commands.setTextSelection({ from: foundPos, to: foundEnd });
        const container = document.querySelector(".page-scroll-container");
        try {
          const coords = editor.view.coordsAtPos(foundPos);
          if (container) {
            const rect = container.getBoundingClientRect();
            const targetTop =
              coords.top - rect.top + container.scrollTop - rect.height / 3;
            const safeTop = Math.max(0, targetTop);
            container.scrollTo({
              top: safeTop,
              behavior: resolveEditorScrollBehavior({
                distance: safeTop - container.scrollTop,
                smoothThreshold: 200,
              }),
            });
          } else {
            editor.commands.scrollIntoView();
          }
        } catch {
          editor.commands.scrollIntoView();
        }

        // 使用 ProseMirror mark 方式高亮，保证稳定显示
        editor.commands.setMark("highlight", {
          color: "var(--goose-search-highlight)",
        });

        if (clearTimer) clearTimeout(clearTimer);
        clearTimer = window.setTimeout(() => {
          if (cancelled) return;
          clearHighlightMarks();
          setSearchHighlightQuery(null);
          setSearchHighlightPageId(null);
        }, 4000);

        // 取消选中，仅保留闪烁高亮
        editor.commands.setTextSelection(foundEnd);
        setHandledSearchHighlightNonce(searchHighlightNonce);
        return;
      }

      if (attempts < 20) {
        attempts += 1;
        schedule(80);
        return;
      }

      setSearchHighlightQuery(null);
      setSearchHighlightPageId(null);
      setHandledSearchHighlightNonce(searchHighlightNonce);
    };

    schedule(120);

    return () => {
      cancelled = true;
      clearTimers();

      // 1. 先清除编辑器中的高亮 Mark (view.dispatch 是同步更新 state 的)
      clearHighlightMarks();

      // 2. 取消挂起的防抖保存，避免高亮状态被旧快照回写
      debouncedUpdateRef.current?.cancel();

      // 3. 获取清除高亮后的最新内容，并手动立即保存，确保落盘的是干净数据
      if (activePageId && editor && !editor.isDestroyed) {
        const cleanContent = editor.getJSON();
        syncedContentSignatureRef.current = getContentSignature(cleanContent);
        updatePage(activePageId, { content: cleanContent });
      }

      // 4. 清除搜索状态
      setSearchHighlightQuery(null);
      setSearchHighlightPageId(null);
    };
  }, [
    editor,
    searchHighlightQuery,
    searchHighlightPageId,
    searchHighlightNonce,
    activePageId,
    setSearchHighlightQuery,
    setSearchHighlightPageId,
    setHandledSearchHighlightNonce,
  ]);

  const fontFamilyClass = useMemo(() => {
    if (!page) return "";
    switch (page.fontFamily) {
      case "serif":
        return "font-serif";
      case "mono":
        return "font-mono";
      default:
        return "font-sans";
    }
  }, [page?.fontFamily]);

  const fontSizeClass = useMemo(() => {
    if (!page) return "";
    return page.fontSize === "small" ? "text-sm" : "text-base";
  }, [page?.fontSize]);

  const widthClass = useMemo(() => {
    if (!page) return "max-w-3xl mx-auto";
    return isEditorFullWidth
      ? "max-w-full editor-full-width"
      : "max-w-3xl mx-auto";
  }, [isEditorFullWidth, page]);

  const findCountLabel = useMemo(() => {
    if (!findQuery.trim() || !findMatches.length || activeFindIndex < 0) {
      return "0/0";
    }
    return `${activeFindIndex + 1}/${findMatches.length}`;
  }, [findQuery, findMatches.length, activeFindIndex]);

  const findButtonClass =
    "inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40";
  const findPrevShortcut = formatShortcut("Shift+F3");
  const findNextShortcut = formatShortcut("F3");
  const findCloseShortcut = formatShortcut("Esc");

  if (!editor || !page) {
    return null;
  }

  const findWidget = (
    <div className="editor-inline-find absolute right-2 top-2 z-50">
      <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-background/95 px-2.5 py-1 shadow-md backdrop-blur-sm">
        <LucideIcons.Search className="ml-0.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={findInputRef}
          value={findQuery}
          onChange={(event) => setFindQuery(event.target.value)}
          onKeyDown={handleFindInputKeyDown}
          className="h-6 w-[180px] border-0 bg-transparent px-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="查找"
        />
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-6 min-w-7 items-center justify-center rounded px-1 text-[11px] font-medium transition-colors",
                  findMatchCase
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-label="区分大小写"
                onClick={() => setFindMatchCase((value) => !value)}
              >
                Aa
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">区分大小写</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span
          className={cn(
            "min-w-[40px] text-right text-[11px] tabular-nums",
            findQuery.trim() && !findMatches.length
              ? "text-red-500"
              : "text-muted-foreground",
          )}
        >
          {findCountLabel}
        </span>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={findButtonClass}
                aria-label="上一个匹配"
                disabled={!findMatches.length}
                onClick={() => jumpFindMatch(-1)}
              >
                <LucideIcons.ChevronUp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="flex items-center gap-2">
                <span>上一个匹配</span>
                <span className="text-[11px] text-muted-foreground">
                  {findPrevShortcut}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={findButtonClass}
                aria-label="下一个匹配"
                disabled={!findMatches.length}
                onClick={() => jumpFindMatch(1)}
              >
                <LucideIcons.ChevronDown className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="flex items-center gap-2">
                <span>下一个匹配</span>
                <span className="text-[11px] text-muted-foreground">
                  {findNextShortcut}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={findButtonClass}
                aria-label="关闭查找"
                onClick={() => closeFindWidget(true)}
              >
                <LucideIcons.X className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="flex items-center gap-2">
                <span>关闭</span>
                <span className="text-[11px] text-muted-foreground">
                  {findCloseShortcut}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );

  return (
    <div className={cn("relative w-full", fontFamilyClass, fontSizeClass)}>
      {isFindOpen && findOverlayContainer && (
        <Portal container={findOverlayContainer}>{findWidget}</Portal>
      )}
      <div className={widthClass}>
        <AiInputPopover editor={editor} />
        <EditorBubbleMenu editor={editor} />
        <LinkHoverMenu editor={editor} />
        <TableHoverControls editor={editor} />
        <TableRowColHandles editor={editor} />
        <ImageBubbleMenu editor={editor} />
        <EditorContextMenu
          editor={editor}
          searchProviders={searchProviders}
          openSearchInUtools={utools.openSearchInUtools}
          customActions={customActions}
        >
          <EditorContent editor={editor} />
        </EditorContextMenu>
      </div>
    </div>
  );
}
