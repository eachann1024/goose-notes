import { useEditor, EditorContent } from "@tiptap/react";
import { EditorState } from "@tiptap/pm/state";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import debounce from "lodash.debounce";
import "tippy.js/dist/tippy.css";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { EditorContextMenu } from "./EditorContextMenu";
import { ImageBubbleMenu } from "./ImageBubbleMenu";
import { TableHoverControls } from "./TableHoverControls";
import { TableRowColHandles } from "./TableRowColHandles";
import { editorExtensions } from "./editorExtensions";
import { parseMarkdownTableToHtml } from "@/lib/markdownTableParser";

interface EditorProps {
  editable?: boolean;
}

export function Editor({ editable = true }: EditorProps) {
  const { activePageId, getPage, updatePage } = usePages();
  const page = activePageId ? getPage(activePageId) : undefined;
  const { searchProviders, utools } = useSettings();

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
                  const quoteStartPos = $from.before(depth);
                  editor
                    .chain()
                    .focus()
                    .insertContentAt(quoteStartPos, { type: "paragraph" })
                    .run();
                  return true;
                }
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
      handlePaste: (view, event) => {
        const plainText = event.clipboardData?.getData("text/plain");
        if (plainText) {
          const tableHtml = parseMarkdownTableToHtml(plainText);
          if (tableHtml) {
            const { state, dispatch } = view;
            const parser = ProseMirrorDOMParser.fromSchema(state.schema);
            const doc = new window.DOMParser().parseFromString(
              tableHtml,
              "text/html",
            );
            const slice = parser.parseSlice(doc.body);
            const tr = state.tr.replaceSelection(slice);
            dispatch(tr);
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

  useEffect(() => {
    const flush = () => debouncedUpdateRef.current?.flush();

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

      editor.commands.setContent(contentToSet, { emitUpdate: false });

      const { state, view } = editor;
      const newState = EditorState.create({
        doc: state.doc,
        plugins: state.plugins,
      });
      view.updateState(newState);

      pageIdForUpdateRef.current = activePageId;
      prevPageIdRef.current = activePageId;

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
    if (!editor) return;

    const handlePaste = async (event: ClipboardEvent) => {
      const imageFile = getImageFromClipboard(event);
      if (imageFile) {
        event.preventDefault();
        try {
          const base64 = await processImageForStorage(imageFile);
          editor.chain().focus().setImage({ src: base64 }).run();
        } catch (err) {
          console.error("Failed to paste image:", err);
        }
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("paste", handlePaste);

    return () => {
      editorElement.removeEventListener("paste", handlePaste);
    };
  }, [editor]);

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
      <TableHoverControls editor={editor} />
      <TableRowColHandles editor={editor} />
      <ImageBubbleMenu editor={editor} />
      <EditorContextMenu
        editor={editor}
        searchProviders={searchProviders}
        openSearchInUtools={utools.openSearchInUtools}
      >
        <EditorContent editor={editor} />
      </EditorContextMenu>
    </div>
  );
}
