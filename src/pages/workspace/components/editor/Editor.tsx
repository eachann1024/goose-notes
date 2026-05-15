import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { ImageExportThemeSelector } from "@/components/ui/image-export-theme-selector";
import type { CardThemeId, WatermarkConfig } from "@/lib/imageExport";
import {
  EMPTY_CELL_HEIGHT,
  EMPTY_CELL_WIDTH,
  createHeadingBlockSpec,
  type PartialTableContent,
} from "@blocknote/core";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core/blocks";
import { TableHandlesExtension } from "@blocknote/core/extensions";
import {
  CellSelection,
  deleteColumn,
  deleteRow,
  selectedRect,
} from "prosemirror-tables";
import {
  BlockNoteViewRaw as BlockNoteView,
  FilePanelController,
  FormattingToolbarController,
  SuggestionMenuController,
  TableHandlesController,
  useCreateBlockNote,
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from "@blocknote/react";
import { zh } from "@blocknote/core/locales";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/react/style.css";
import debounce from "lodash.debounce";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { cn } from "@/lib/utils";
import {
  clonePageContent,
  getContentSignature,
  normalizePageContent,
  ensureFirstTitleHeading,
  extractBlockNoteTitle,
  type BlockNoteContent,
} from "@/lib/blocknote-content";
import { importMarkdownFragment } from "@/lib/export";
import {
  getBlockNoteSlashMenuItems,
  filterSlashMenuItems,
} from "@/pages/workspace/components/command/blocknoteSlashItems";
import { CustomSlashMenu } from "@/pages/workspace/components/command/CustomSlashMenu";
import { EditorFormattingToolbar } from "./EditorFormattingToolbar";
import { calloutBlock } from "./calloutBlock";
import { customFileBlock } from "./customFileBlock";
import { codeBlockSpec } from "./codeBlockSpec";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiInlineInput } from "./AiInlineInput";
import { EditorSideMenu } from "./EditorSideMenu";
import { ImageLightbox } from "./ImageLightbox";
import { gooseSelectAllExtension } from "./selectAllExtension";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";

type EditorFilePanelProps = {
  blockId: string;
};

type ImageAlignment = "left" | "center" | "right";

type ImageToolbarState = {
  blockId: string;
  alignment: ImageAlignment;
  top: number;
  left: number;
};

const IMAGE_BLOCK_SELECTOR =
  '.bn-block-content[data-content-type="image"], .bn-block-content[data-content-type="imageResize"]';

const IMAGE_TOOLBAR_WIDTH = 140;

function getImageToolbarAnchor(blockElement: HTMLElement) {
  return blockElement.closest<HTMLElement>(".bn-block-outer") ?? blockElement;
}

function getImageToolbarPosition(container: HTMLElement, target: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  return {
    top: Math.max(8, rect.top - containerRect.top + container.scrollTop + 12),
    left: Math.min(
      Math.max(8, rect.left - containerRect.left + container.scrollLeft + 12),
      Math.max(8, container.scrollWidth - IMAGE_TOOLBAR_WIDTH - 8),
    ),
  };
}

function getBlockPlainText(block: any): string {
  if (typeof block?.content === "string") return block.content;
  if (Array.isArray(block?.content)) {
    return block.content
      .map((inline: any) =>
        typeof inline === "string" ? inline : inline?.text ?? "",
      )
      .join("");
  }
  return "";
}

function looksLikeMarkdownFragment(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  return (
    /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|\s*[-*+]\s\[[ xX]\]\s)/m.test(value) ||
    /```/.test(value) ||
    /\|.+\|/.test(value) ||
    /(\*\*|__|~~|`[^`]+`)/.test(value)
  );
}

function EditorFilePanel({ blockId }: EditorFilePanelProps) {
  const editor = useBlockNoteEditor<any, any, any>();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const block = editor.getBlock(blockId);
  const accept =
    block?.type === "image"
      ? "image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff,image/avif,image/heic,image/heif"
      : undefined;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.click();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [blockId]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      const uploadFile = (editor as any).uploadFile as
        | ((file: File) => Promise<string>)
        | undefined;
      if (!uploadFile) return;

      const url = await uploadFile(file);
      editor.updateBlock(blockId, {
        props: {
          name: file.name,
          url,
        },
      } as any);
    },
    [blockId, editor],
  );

  return (
    <input
      ref={inputRef}
      type="file"
      className="hidden"
      accept={accept}
      onChange={handleFileChange}
      aria-hidden="true"
    />
  );
}

type TableExtendButtonProps = {
  orientation: "addOrRemoveRows" | "addOrRemoveColumns";
  hideOtherElements: (hide: boolean) => void;
};

const roundTableExtendDelta = (value: number, margin = 0.3) => {
  const lowerBound = Math.floor(value) + margin;
  const upperBound = Math.ceil(value) - margin;

  if (value >= lowerBound && value <= upperBound) return Math.round(value);
  return value < lowerBound ? Math.floor(value) : Math.ceil(value);
};

function GooseTableExtendButton({
  orientation,
  hideOtherElements,
}: TableExtendButtonProps) {
  const editor = useBlockNoteEditor<any, any, any>();
  const tableHandles = useExtension(TableHandlesExtension);
  const block = useExtensionState(TableHandlesExtension, {
    selector: (state) => state?.block,
  });
  const movedMouse = useRef(false);
  const [editingState, setEditingState] = useState<
    | {
        originalContent: PartialTableContent<any, any>;
        originalCroppedContent: PartialTableContent<any, any>;
        startPos: number;
      }
    | undefined
  >();
  const isColumnHandle = orientation === "addOrRemoveColumns";

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      tableHandles.freezeHandles();
      hideOtherElements(true);

      if (!block) return;

      setEditingState({
        originalContent: block.content as any,
        originalCroppedContent: {
          rows: tableHandles.cropEmptyRowsOrColumns(
            block,
            isColumnHandle ? "columns" : "rows",
          ),
        } as PartialTableContent<any, any>,
        startPos: isColumnHandle ? event.clientX : event.clientY,
      });
      movedMouse.current = false;
      event.preventDefault();
    },
    [block, hideOtherElements, isColumnHandle, tableHandles],
  );

  const handleClick = useCallback(() => {
    if (!block || movedMouse.current) return;

    editor.updateBlock(block, {
      type: "table",
      content: {
        ...block.content,
        rows: isColumnHandle
          ? tableHandles.addRowsOrColumns(block, "columns", 1)
          : tableHandles.addRowsOrColumns(block, "rows", 1),
      } as any,
    });
  }, [block, editor, isColumnHandle, tableHandles]);

  useEffect(() => {
    if (!editingState || !block) return;

    const handleMouseMove = (event: MouseEvent) => {
      movedMouse.current = true;

      const diff =
        (isColumnHandle ? event.clientX : event.clientY) - editingState.startPos;
      const croppedCount = isColumnHandle
        ? (editingState.originalCroppedContent.rows[0]?.cells.length ?? 0)
        : editingState.originalCroppedContent.rows.length;
      const originalCount = isColumnHandle
        ? (editingState.originalContent.rows[0]?.cells.length ?? 0)
        : editingState.originalContent.rows.length;
      const currentCount = isColumnHandle
        ? block.content.rows[0].cells.length
        : block.content.rows.length;
      const nextCount =
        originalCount +
        roundTableExtendDelta(
          diff / (isColumnHandle ? EMPTY_CELL_WIDTH : EMPTY_CELL_HEIGHT),
        );

      if (nextCount < croppedCount || nextCount <= 0 || nextCount === currentCount) {
        return;
      }

      editor.updateBlock(block, {
        type: "table",
        content: {
          ...block.content,
          rows: isColumnHandle
            ? tableHandles.addRowsOrColumns(
                {
                  type: "table",
                  content: editingState.originalCroppedContent,
                } as any,
                "columns",
                nextCount - croppedCount,
              )
            : tableHandles.addRowsOrColumns(
                {
                  type: "table",
                  content: editingState.originalCroppedContent,
                } as any,
                "rows",
                nextCount - croppedCount,
              ),
        } as any,
      });

      editor.setTextCursorPosition(block);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [block, editingState, editor, isColumnHandle, tableHandles]);

  useEffect(() => {
    if (!editingState) return;

    const handleMouseUp = () => {
      hideOtherElements(false);
      tableHandles.unfreezeHandles();
      setEditingState(undefined);
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [editingState, hideOtherElements, tableHandles]);

  if (!editor.isEditable) return null;

  return (
    <button
      type="button"
      className={cn(
        "goose-table-extend-button",
        isColumnHandle
          ? "goose-table-extend-button-columns"
          : "goose-table-extend-button-rows",
        editingState && "is-editing",
      )}
      aria-label={isColumnHandle ? "添加列" : "添加行"}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <LucideIcons.Plus className="h-3.5 w-3.5" />
    </button>
  );
}

type TableHandleProps = {
  orientation: "row" | "column";
  hideOtherElements: (hide: boolean) => void;
};

function GooseTableHandle({ orientation, hideOtherElements }: TableHandleProps) {
  const editor = useBlockNoteEditor<any, any, any>();
  const tableHandles = useExtension(TableHandlesExtension);
  const state = useExtensionState(TableHandlesExtension);

  const index = state
    ? orientation === "column" ? state.colIndex : state.rowIndex
    : undefined;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!tableHandles || !state?.block) return;
      hideOtherElements(true);
      if (orientation === "column") {
        tableHandles.colDragStart(e);
      } else {
        tableHandles.rowDragStart(e);
      }
    },
    [tableHandles, state, orientation, hideOtherElements],
  );

  const handleDragEnd = useCallback(() => {
    if (!tableHandles) return;
    tableHandles.dragEnd();
    hideOtherElements(false);
  }, [tableHandles, hideOtherElements]);

  if (!state || index === undefined) return null;

  const isRow = orientation === "row";

  const handleDelete = useCallback(() => {
    const selection = editor.prosemirrorState.selection;
    if (selection instanceof CellSelection) {
      const rect = selectedRect(editor.prosemirrorState);
      const selectedRows = rect.bottom - rect.top;
      const selectedColumns = rect.right - rect.left;

      if (isRow && selectedRows > 1) {
        editor.exec((state, dispatch) => deleteRow(state, dispatch));
        return;
      }

      if (!isRow && selectedColumns > 1) {
        editor.exec((state, dispatch) => deleteColumn(state, dispatch));
        return;
      }
    }

    tableHandles?.removeRowOrColumn(index!, orientation);
  }, [editor, index, isRow, orientation, tableHandles]);

  const isHeaderRow = Boolean(state.block.content.headerRows);

  const handleToggleHeaderRow = useCallback(() => {
    if (!state.block || !isRow || index !== 0) return;
    editor.updateBlock(state.block, {
      ...state.block,
      content: {
        ...state.block.content,
        headerRows: isHeaderRow ? undefined : 1,
      } as any,
    });
  }, [editor, index, isHeaderRow, isRow, state.block]);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          tableHandles?.freezeHandles();
          hideOtherElements(true);
        } else {
          tableHandles?.unfreezeHandles();
          hideOtherElements(false);
          editor.focus();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="goose-table-handle-btn"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={orientation === "column" ? { transform: "rotate(0.25turn)" } : undefined}
        >
          <LucideIcons.GripVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40" side={isRow ? "right" : "bottom"} align="start">
        {isRow ? (
          <>
            <DropdownMenuItem onClick={() => tableHandles?.addRowOrColumn(index!, { orientation: "row", side: "above" })}>
              <LucideIcons.ArrowUp className="mr-2 h-4 w-4" /> 上方添加行
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tableHandles?.addRowOrColumn(index!, { orientation: "row", side: "below" })}>
              <LucideIcons.ArrowDown className="mr-2 h-4 w-4" /> 下方添加行
            </DropdownMenuItem>
            {index === 0 && (
              <DropdownMenuItem onClick={handleToggleHeaderRow}>
                <LucideIcons.Heading1 className="mr-2 h-4 w-4" />
                {isHeaderRow ? "取消标题行" : "设为标题行"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDelete}>
              <LucideIcons.Trash2 className="mr-2 h-4 w-4" /> 删除行
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => tableHandles?.addRowOrColumn(index!, { orientation: "column", side: "left" })}>
              <LucideIcons.ArrowLeft className="mr-2 h-4 w-4" /> 左侧添加列
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tableHandles?.addRowOrColumn(index!, { orientation: "column", side: "right" })}>
              <LucideIcons.ArrowRight className="mr-2 h-4 w-4" /> 右侧添加列
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete}>
              <LucideIcons.Trash2 className="mr-2 h-4 w-4" /> 删除列
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    heading: createHeadingBlockSpec({
      levels: [1, 2, 3],
      allowToggleHeadings: false,
    }),
    callout: calloutBlock,
    file: customFileBlock,
    codeBlock: codeBlockSpec,
  },
});

export interface EditorRef {
  editor: ReturnType<typeof useCreateBlockNote> | null;
}

interface EditorProps {
  editable?: boolean;
}

export const Editor = forwardRef<EditorRef, EditorProps>(function Editor({ editable = true }, ref) {
  const { activePageId, getPage, updatePage } = usePages();
  const { notebooks } = useNotebooks();
  const { globalEditorFullWidth, customFonts, theme } = useSettings();
  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = page ? notebooks[page.workspaceId] : undefined;
  const isEditorFullWidth = Boolean(
    notebook?.editorFullWidth ?? globalEditorFullWidth,
  );

  const pageIdForUpdateRef = useRef<string | null>(null);
  const syncedContentSignatureRef = useRef<string | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const shiftPressedRef = useRef(false);
  const isSwappingContentRef = useRef(false);
  const prevActivePageIdForSwapRef = useRef<string | null>(activePageId ?? null);

  const [creationContent] = useState(() => {
    return normalizePageContent(page?.content);
  });

  const editor = useCreateBlockNote(
    {
      initialContent: creationContent as any,
      schema: editorSchema,
      extensions: [gooseSelectAllExtension],
      dictionary: {
        ...zh,
        placeholders: {
          ...zh.placeholders,
          default: "输入 / 或 、来展开菜单...",
        },
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
        if (url.startsWith("att:")) {
          const { imageStorage } = await import("@/lib/imageStorage");
          const blob = await imageStorage.load(url);
          if (blob) return URL.createObjectURL(blob);
        }
        return url;
      },
    },
    [],
  );

  const getSlashItems = useCallback(
    async (query: string) => {
      const items = getBlockNoteSlashMenuItems(editor);
      return filterSlashMenuItems(items, query);
    },
    [editor],
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

  const restoreFirstTitleHeading = useCallback(() => {
    const currentContent = editor.document as BlockNoteContent;
    const firstBlock = currentContent[0];
    if (firstBlock?.type === "heading" && Number((firstBlock as any).props?.level) === 1) {
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
      const plainText = clipboard.getData("text/plain");
      if (!plainText || !looksLikeMarkdownFragment(plainText)) return;

      const htmlText = clipboard.getData("text/html");
      if (htmlText && htmlText.trim()) return;

      const parsedBlocks = importMarkdownFragment(plainText);
      if (!parsedBlocks?.length) return;

      event.preventDefault();
      event.stopPropagation();

      const cursor = editor.getTextCursorPosition();
      const [inserted] = editor.insertBlocks(parsedBlocks as any, cursor.block, "before");
      if (inserted) {
        editor.setTextCursorPosition(inserted);
      }
    },
    [editable, editor],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        shiftPressedRef.current = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        shiftPressedRef.current = false;
      }
    };
    const handleWindowBlur = () => {
      shiftPressedRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleWindowBlur, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleWindowBlur, true);
    };
  }, []);

  const commitEditorContent = useCallback(
    (targetPageId?: string) => {
      const safePageId = targetPageId ?? pageIdForUpdateRef.current;
      if (!safePageId) return;
      const nextContent = ensureFirstTitleHeading(
        clonePageContent(editor.document as BlockNoteContent),
      );
      debouncedUpdate.cancel();
      syncedContentSignatureRef.current = getContentSignature(nextContent);
      updatePage(safePageId, { content: nextContent });
    },
    [debouncedUpdate, editor, updatePage],
  );

  useEffect(() => {
    if (!activePageId) return;
    const p = getPage(activePageId);
    if (!p) return;

    const normalized = normalizePageContent(p.content);
    const normalizedSignature = getContentSignature(normalized);
    pageIdForUpdateRef.current = p.id;
    syncedContentSignatureRef.current = normalizedSignature;

    if (getContentSignature(p.content) !== normalizedSignature) {
      updatePage(p.id, { content: normalized });
    }

    // Swap editor content when switching pages (not on first mount)
    const prevId = prevActivePageIdForSwapRef.current;
    prevActivePageIdForSwapRef.current = activePageId;

    if (prevId !== null && prevId !== activePageId) {
      isSwappingContentRef.current = true;
      editor.replaceBlocks(editor.document, normalized as any);
      requestAnimationFrame(() => {
        isSwappingContentRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId]);

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

    window.addEventListener("goose-note:flush-editor", handleFlush);
    window.addEventListener("goose-note:focus-editor-start", handleFocusStart);

    return () => {
      window.removeEventListener("goose-note:flush-editor", handleFlush);
      window.removeEventListener(
        "goose-note:focus-editor-start",
        handleFocusStart,
      );
    };
  }, [commitEditorContent, editor]);

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

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const resolve = () => {
      if (theme === "dark") {
        setEffectiveTheme("dark");
        return;
      }
      if (theme === "system") {
        setEffectiveTheme(
          window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light",
        );
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

  const [selectedText, setSelectedText] = useState("");
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const selectedTextRef = useRef("");
  const imageToolbarRef = useRef<HTMLDivElement | null>(null);
  const [imageToolbar, setImageToolbar] = useState<ImageToolbarState | null>(null);

  const handleContextMenuOpen = () => {
    let text = "";
    try {
      text = editor.getSelectedText() || "";
    } catch { /* ignore */ }
    // Fallback: 浏览器原生选区（右键时更可靠）
    if (!text.trim()) {
      try {
        const sel = document.getSelection();
        text = sel?.toString() || "";
      } catch { /* ignore */ }
    }
    const trimmed = text.trim();
    setSelectedText(trimmed);
    selectedTextRef.current = trimmed;
  };

  const syncImageToolbarPosition = useCallback(
    (blockId: string, nextAlignment?: ImageAlignment) => {
      const container = editorContainerRef.current;
      if (!container) return;

      const blockElement = container.querySelector<HTMLElement>(
        `[data-id="${blockId}"]`,
      );
      if (!blockElement) return;
      const anchorElement = getImageToolbarAnchor(blockElement);

      const block = editor.getBlock(blockId);
      const alignment =
        nextAlignment ??
        (((block?.props as { textAlignment?: string } | undefined)
          ?.textAlignment ?? "left") as ImageAlignment);

      setImageToolbar({
        blockId,
        alignment,
        ...getImageToolbarPosition(container, anchorElement),
      });
    },
    [editor],
  );

  const updateImageAlignment = useCallback(
    (blockId: string, alignment: ImageAlignment) => {
      editor.updateBlock(blockId, {
        props: { textAlignment: alignment },
      } as any);
      requestAnimationFrame(() => {
        syncImageToolbarPosition(blockId, alignment);
      });
    },
    [editor, syncImageToolbarPosition],
  );

  const handleEditorContextMenuCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      const imageBlock = target?.closest<HTMLElement>(IMAGE_BLOCK_SELECTOR);
      if (!imageBlock) {
        setImageToolbar(null);
        return;
      }

      const blockId = imageBlock.closest<HTMLElement>("[data-id]")?.dataset.id;
      if (!blockId) return;

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation?.();

      const block = editor.getBlock(blockId);
      const alignment =
        ((block?.props as { textAlignment?: string } | undefined)
          ?.textAlignment ?? "left") as ImageAlignment;

      const container = editorContainerRef.current;
      if (!container) return;
      const blockElement = imageBlock.closest<HTMLElement>("[data-id]");
      if (!blockElement) return;
      const anchorElement = getImageToolbarAnchor(blockElement);

      setImageToolbar({
        blockId,
        alignment,
        ...getImageToolbarPosition(container, anchorElement),
      });
    },
    [editor],
  );

  useEffect(() => {
    if (!imageToolbar) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (imageToolbarRef.current?.contains(target)) return;
      setImageToolbar(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImageToolbar(null);
      }
    };

    const handleViewportChange = () => {
      syncImageToolbarPosition(imageToolbar.blockId, imageToolbar.alignment);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleEscape, true);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange, true);
    };
  }, [imageToolbar, syncImageToolbarPosition]);

  const handleSelectionThemeConfirm = (themeId: CardThemeId, watermarkConfig: WatermarkConfig) => {
    const text = selectedTextRef.current;
    if (!text.trim()) return;
    const title = extractBlockNoteTitle(page?.content) || "选中内容";
    exportSelectionToImage(text, title, themeId, watermarkConfig);
  };

  if (!page) return null;

  return (
    <>
    <ContextMenu onOpenChange={(open) => { if (open) handleContextMenuOpen(); }}>
      <div
        ref={editorContainerRef}
        onContextMenuCapture={handleEditorContextMenuCapture}
        onPasteCapture={handleEditorPasteCapture}
        data-font-family={page.fontFamily ?? "default"}
        className={cn(
          "workspace-editor-surface relative mx-auto flex min-h-0 flex-1 flex-col w-full px-6 pt-2 pb-8",
          isEditorFullWidth ? "max-w-none" : "max-w-4xl",
        )}
      >
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme={effectiveTheme}
          slashMenu={false}
          formattingToolbar={false}
          sideMenu={false}
          tableHandles={false}
          filePanel={false}
          onChange={() => {
            if (isSwappingContentRef.current) return;
            const safePageId = pageIdForUpdateRef.current;
            if (!safePageId) return;
            if (restoreFirstTitleHeading()) return;
            const nextContent = clonePageContent(editor.document as BlockNoteContent);
            syncedContentSignatureRef.current = getContentSignature(nextContent);
            debouncedUpdate(safePageId, nextContent);
          }}
        >
          <EditorSideMenu />
          <TableHandlesController
            tableHandle={GooseTableHandle}
            extendButton={GooseTableExtendButton}
          />
          <FormattingToolbarController
            formattingToolbar={EditorFormattingToolbar}
          />
          <FilePanelController filePanel={EditorFilePanel} />
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={getSlashItems}
            shouldOpen={(event) => {
              const $from = event.selection.$from;
              const isFirstBlock = $from.index(0) === 0;
              const isAtBlockStart = $from.parentOffset === 0;
              if (!isFirstBlock || !isAtBlockStart) return false;
              return !$from.parent.type.isInGroup("tableContent");
            }}
            suggestionMenuComponent={CustomSlashMenu}
            onItemClick={(item) => {
              if (item && "onItemClick" in item) {
                (item as any).onItemClick();
              }
            }}
          />
          <SuggestionMenuController
            triggerCharacter="、"
            getItems={getSlashItems}
            shouldOpen={(event) => {
              const $from = event.selection.$from;
              const isFirstBlock = $from.index(0) === 0;
              const isAtBlockStart = $from.parentOffset === 0;
              if (!isFirstBlock || !isAtBlockStart) return false;
              return !$from.parent.type.isInGroup("tableContent");
            }}
            suggestionMenuComponent={CustomSlashMenu}
            onItemClick={(item) => {
              if (item && "onItemClick" in item) {
                (item as any).onItemClick();
              }
            }}
          />
          <AiInlineInput />
        </BlockNoteView>
        {imageToolbar ? (
          <div
            ref={imageToolbarRef}
            onMouseDown={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
            className="absolute z-[20010] flex items-center gap-0.5 rounded-[10px] border border-border/75 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/15 dark:bg-[#2f3437]"
            style={{
              top: imageToolbar.top,
              left: imageToolbar.left,
            }}
          >
            <button
              type="button"
              aria-label="左对齐"
              onClick={() => updateImageAlignment(imageToolbar.blockId, "left")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 hover:bg-muted",
                imageToolbar.alignment === "left" && "bg-accent text-foreground",
              )}
            >
              <LucideIcons.AlignLeft className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              aria-label="居中对齐"
              onClick={() => updateImageAlignment(imageToolbar.blockId, "center")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 hover:bg-muted",
                imageToolbar.alignment === "center" && "bg-accent text-foreground",
              )}
            >
              <LucideIcons.AlignCenter className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              aria-label="右对齐"
              onClick={() => updateImageAlignment(imageToolbar.blockId, "right")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-foreground/90 hover:bg-muted",
                imageToolbar.alignment === "right" && "bg-accent text-foreground",
              )}
            >
              <LucideIcons.AlignRight className="h-[15px] w-[15px]" />
            </button>
          </div>
        ) : null}
      </div>
      <ContextMenuContent className="w-[200px]">
        {selectedText.trim() && (
          <ContextMenuItem
            onSelect={() => {
              selectedTextRef.current = selectedText;
              setThemeSelectorOpen(true);
            }}
          >
            <LucideIcons.Image className="mr-2 h-4 w-4" />
            生成选中图片
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>

    <ImageExportThemeSelector
      open={themeSelectorOpen}
      onOpenChange={setThemeSelectorOpen}
      onConfirm={handleSelectionThemeConfirm}
      mode="selection"
    />
    <ImageLightbox editor={editor} editorContainerRef={editorContainerRef} />
  </>);
});
