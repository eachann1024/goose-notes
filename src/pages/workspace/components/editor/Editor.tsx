import { useEditor, EditorContent } from "@tiptap/react";
import debounce from "lodash.debounce";
import "tippy.js/dist/tippy.css";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { EditorContextMenu } from "./EditorContextMenu";
import { ImageBubbleMenu } from "./ImageBubbleMenu";
import { TableHoverControls } from "./TableHoverControls";
import { editorExtensions } from "./editorExtensions";

interface EditorProps {
  editable?: boolean;
}

export function Editor({ editable = true }: EditorProps) {
  const { activePageId, getPage, updatePage } = usePages();
  const page = activePageId ? getPage(activePageId) : undefined;
  const { searchProviders } = useSettings();

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

  useEffect(() => {
    const flush = () => debouncedUpdateRef.current?.flush();

    window.addEventListener("beforeunload", flush);

    if ((window as any).utools) {
      (window as any).utools.onPluginOut(flush);
    }

    window.addEventListener("goose-note:flush-editor", flush);

    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("goose-note:flush-editor", flush);
    };
  }, []);

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

        if (event.key === "Backspace") {
          const { $from } = editor.state.selection;

          if ($from.pos === 1) {
            const firstChild = editor.state.doc.firstChild;
            const isFirstChildEmptyParagraph =
              firstChild?.type.name === "paragraph" &&
              (!firstChild.content || firstChild.content.size === 0);

            if (isFirstChildEmptyParagraph) {
              event.preventDefault();
              window.dispatchEvent(
                new CustomEvent("goose-note:focus-title-end"),
              );
              return true;
            }

            if (
              firstChild?.type.name === "paragraph" &&
              firstChild.textContent
            ) {
              event.preventDefault();
              const firstLineText = firstChild.textContent;

              editor
                .chain()
                .deleteRange({ from: 0, to: firstChild.nodeSize })
                .run();

              window.dispatchEvent(
                new CustomEvent("goose-note:merge-to-title", {
                  detail: { text: firstLineText },
                }),
              );
              return true;
            }
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
      editor.commands.setContent(page.content, { emitUpdate: false });

      pageIdForUpdateRef.current = activePageId;
      prevPageIdRef.current = activePageId;

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
      if (!imageFile) return;

      event.preventDefault();

      try {
        const base64 = await processImageForStorage(imageFile);
        editor.chain().focus().setImage({ src: base64 }).run();
      } catch (err) {
        console.error("Failed to paste image:", err);
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("paste", handlePaste);

    return () => {
      editorElement.removeEventListener("paste", handlePaste);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleFocusStart = () => {
      editor
        .chain()
        .focus("start")
        .insertContentAt(0, { type: "paragraph" })
        .focus("start")
        .run();
    };

    const handleInsertFirstLine = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>;
      const text = customEvent.detail.text;

      editor
        .chain()
        .focus("start")
        .insertContentAt(0, {
          type: "paragraph",
          content: [{ type: "text", text }],
        })
        .focus("start")
        .run();
    };

    window.addEventListener("goose-note:focus-editor-start", handleFocusStart);
    window.addEventListener(
      "goose-note:insert-first-line",
      handleInsertFirstLine,
    );
    return () => {
      window.removeEventListener(
        "goose-note:focus-editor-start",
        handleFocusStart,
      );
      window.removeEventListener(
        "goose-note:insert-first-line",
        handleInsertFirstLine,
      );
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
      <ImageBubbleMenu editor={editor} />
      <EditorContextMenu editor={editor} searchProviders={searchProviders}>
        <EditorContent editor={editor} />
      </EditorContextMenu>
    </div>
  );
}
