import { useEditor, EditorContent } from "@tiptap/react";
import { Selection } from "@tiptap/pm/state";
import debounce from "lodash.debounce";
import "tippy.js/dist/tippy.css";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { EditorContextMenu } from "./EditorContextMenu";
import { ImageBubbleMenu } from "./ImageBubbleMenu";
import { LinkHoverMenu } from "@/extensions/LinkHoverMenu";
import { TableHoverControls } from "./TableHoverControls";
import { TableRowColHandles } from "./TableRowColHandles";
import { editorExtensions } from "./editorExtensions";
import { getImageFromClipboard, processImageForStorageV2 } from "@/lib/imageProcessor";

interface EditorProps {
  editable?: boolean;
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
  const { searchProviders, utools, customActions } = useSettings();

  const prevPageIdRef = useRef<string | null>(null);
  const debouncedUpdateRef = useRef<any>(null);
  const pageIdForUpdateRef = useRef<string | null>(null);

  const debouncedUpdate = useMemo(() => {
    const fn = debounce((id: string, content: any) => {
      updatePage(id, { content });
    }, 1000);
    debouncedUpdateRef.current = fn;
    return fn;
  }, [updatePage]);

  const editor = useEditor({
    editable,
    extensions: editorExtensions,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)] leading-relaxed",
        ),
      },
      handleKeyDown: (_, event) => {
        if (!editor) return false;

        if (event.key === "Enter") {
          const { state } = editor;
          const { selection } = state;
          const { $from, empty } = selection;

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
        debouncedUpdate(safePageId, editor.getJSON());
      }
    },
  });

  const getLocalFileTitle = (filePath: string) => {
    const name = filePath.split(/[\\/]/).pop() || "";
    const base = name.replace(/\.(md|markdown)$/i, "").trim();
    return base || "无标题";
  };

  useEffect(() => {
    const flush = () => {
      debouncedUpdateRef.current?.flush();
    };

    window.addEventListener("beforeunload", flush);

    if ((window as any).utools) {
      (window as any).utools.onPluginOut(flush);
    }

    window.addEventListener("goose-note:flush-editor", flush);

    const handleFocusStart = () => {
      setTimeout(() => {
        editor?.commands.focus("start");
      }, 50);
    };

    window.addEventListener("goose-note:focus-editor-start", handleFocusStart);

    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("goose-note:flush-editor", flush);
      window.removeEventListener(
        "goose-note:focus-editor-start",
        handleFocusStart,
      );
      if ((window as any).utools) {
        // 传递 null 或空函数来清除/覆盖之前的监听器
        // 注意：utools 文档未明确 remove 方法，但在 React effect 中通常重新绑定会覆盖
        // 如果 onPluginOut 支持覆盖，直接设为 null 或空操作
        (window as any).utools.onPluginOut(null);
      }
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !page || !activePageId) return;

    const isSamePage = activePageId === prevPageIdRef.current;
    const isPageLoaded = pageIdForUpdateRef.current === activePageId;
    if (isSamePage && isPageLoaded) return;

    debouncedUpdateRef.current?.flush();
    pageIdForUpdateRef.current = null;

    let cancelled = false;
    const applyContent = () => {
      if (cancelled) return;
      editor.commands.blur();

      let contentToSet = page.content;

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

      // 使用 transaction 设置内容，明确不记录到历史
      const { tr } = editor.state;
      const newDoc = editor.schema.nodeFromJSON(contentToSet);
      tr.replaceWith(0, editor.state.doc.content.size, newDoc.content);
      tr.setMeta("addToHistory", false);
      editor.view.dispatch(tr);

      pageIdForUpdateRef.current = activePageId;
      prevPageIdRef.current = activePageId;

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
  }, [activePageId, page, editor]);

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
      const imageFile = getImageFromClipboard(event);
      if (imageFile) {
        event.preventDefault();
        try {
          const src = await processImageForStorageV2(imageFile);
          const { state, view } = editor;
          const nodeType =
            state.schema.nodes.imageResize || state.schema.nodes.image;
          if (!nodeType) return;
          const imageNode = nodeType.create({ src });
          const tr = state.tr.replaceSelectionWith(imageNode, false);
          tr.setMeta("uiEvent", "paste");
          tr.setMeta("addToHistory", true);
          view.dispatch(tr.scrollIntoView());
        } catch (err) {
          console.error("Failed to paste image:", err);
        }
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
          state.tr.setStoredMarks(remainingMarks.length ? remainingMarks : null),
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
            container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
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

      // 2. 关键修复：取消之前挂起的 debounce，因为那个挂起的调用可能包含带有高亮 Mark 的脏数据
      debouncedUpdateRef.current?.cancel();

      // 3. 获取清除高亮后的最新内容，并手动立即保存，确保落盘的是干净数据
      if (activePageId && editor && !editor.isDestroyed) {
          const cleanContent = editor.getJSON();
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
    return page.isFullWidth ? "max-w-full px-4" : "max-w-3xl mx-auto";
  }, [page?.isFullWidth]);

  if (!editor || !page) {
    return null;
  }

  return (
    <div className={cn(fontFamilyClass, fontSizeClass, widthClass)}>
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
  );
}
