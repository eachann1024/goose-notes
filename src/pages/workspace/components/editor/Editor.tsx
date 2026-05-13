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
  organizeToggleHeadingSections,
  ensureFirstTitleHeading,
  extractBlockNoteTitle,
  type BlockNoteContent,
} from "@/lib/blocknote-content";
import {
  getBlockNoteSlashMenuItems,
  filterSlashMenuItems,
} from "@/pages/workspace/components/command/blocknoteSlashItems";
import { CustomSlashMenu } from "@/pages/workspace/components/command/CustomSlashMenu";
import { EditorFormattingToolbar } from "./EditorFormattingToolbar";
import { CodeBlockEnhancer } from "./CodeBlockEnhancer";
import { calloutBlock } from "./calloutBlock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiInlineInput } from "./AiInlineInput";
import { EditorSideMenu } from "./EditorSideMenu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";

type EditorFilePanelProps = {
  blockId: string;
};

function forEachFoldableHeading(
  blocks: BlockNoteContent,
  callback: (block: any, ordinal: number) => void,
  isDocumentRoot = true,
  ordinalRef = { current: 0 },
) {
  blocks.forEach((block: any, index) => {
    const isDocumentTitle = isDocumentRoot && index === 0;
    if (
      block?.type === "heading" &&
      !isDocumentTitle &&
      block.props?.isToggleable !== false
    ) {
      callback(block, ordinalRef.current);
      ordinalRef.current += 1;
    }
    if (Array.isArray(block?.children) && block.children.length > 0) {
      forEachFoldableHeading(
        block.children as BlockNoteContent,
        callback,
        false,
        ordinalRef,
      );
    }
  });
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

function getStableToggleKey(pageId: string | null | undefined, block: any, ordinal: number) {
  if (!pageId) return null;
  return `goose-heading-toggle:${pageId}:${ordinal}:${getBlockPlainText(block)}`;
}

function setHeadingToggleState(
  pageId: string | null | undefined,
  block: any,
  ordinal: number,
  value: "true" | "false",
) {
  if (typeof window === "undefined") return;
  if (block.id) {
    window.localStorage.setItem(`toggle-${block.id}`, value);
  }
  const stableKey = getStableToggleKey(pageId, block, ordinal);
  if (stableKey) {
    window.localStorage.setItem(stableKey, value);
  }
}

function ensureDefaultOpenToggleState(
  content: BlockNoteContent,
  pageId?: string | null,
) {
  if (typeof window === "undefined") return;
  forEachFoldableHeading(content, (block, ordinal) => {
    const idKey = block.id ? `toggle-${block.id}` : null;
    const stableKey = getStableToggleKey(pageId, block, ordinal);
    const saved =
      (stableKey ? window.localStorage.getItem(stableKey) : null) ??
      (idKey ? window.localStorage.getItem(idKey) : null);
    const value = saved === "false" ? "false" : "true";

    if (idKey) {
      window.localStorage.setItem(idKey, value);
    }
    if (stableKey) {
      window.localStorage.setItem(stableKey, value);
    }
  });
}

function EditorFilePanel({ blockId }: EditorFilePanelProps) {
  const editor = useBlockNoteEditor<any, any, any>();
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      title={isColumnHandle ? "点击添加列，拖动快速增减列" : "点击添加行，拖动快速增减行"}
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

  const initialContent = useMemo(() => {
    const content = normalizePageContent(page?.content);
    ensureDefaultOpenToggleState(content, page?.id);
    return content;
  }, [page?.id]);

  const editor = useCreateBlockNote(
    {
      initialContent: initialContent as any,
      schema: BlockNoteSchema.create({
        blockSpecs: {
          ...defaultBlockSpecs,
          heading: createHeadingBlockSpec({
            levels: [1, 2, 3],
            allowToggleHeadings: true,
          }),
          callout: calloutBlock,
        },
      }),
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
    },
    [page?.id],
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

  const syncHeadingToggleDom = useCallback(() => {
    const content = editor.document as BlockNoteContent;
    const pageId = pageIdForUpdateRef.current ?? activePageId;
    ensureDefaultOpenToggleState(content, pageId);

    window.requestAnimationFrame(() => {
      forEachFoldableHeading(content, (block, ordinal) => {
        if (!block.id) return;
        const stableKey = getStableToggleKey(pageId, block, ordinal);
        const saved =
          (stableKey ? window.localStorage.getItem(stableKey) : null) ??
          window.localStorage.getItem(`toggle-${block.id}`);
        const isOpen = saved !== "false";
        const selector = `.bn-block[data-id="${CSS.escape(block.id)}"] > .bn-block-content .bn-toggle-wrapper`;
        editorContainerRef.current
          ?.querySelectorAll<HTMLElement>(selector)
          .forEach((wrapper) => {
            wrapper.setAttribute("data-show-children", isOpen ? "true" : "false");
          });
      });
    });
  }, [activePageId, editor]);

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

  const commitEditorContent = useCallback(
    (targetPageId?: string) => {
      const safePageId = targetPageId ?? pageIdForUpdateRef.current;
      if (!safePageId) return;
      const nextContent = organizeToggleHeadingSections(
        ensureFirstTitleHeading(
          clonePageContent(editor.document as BlockNoteContent),
        ),
      );
      ensureDefaultOpenToggleState(nextContent, safePageId);
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
    ensureDefaultOpenToggleState(normalized, p.id);
    syncedContentSignatureRef.current = normalizedSignature;

    if (getContentSignature(p.content) !== normalizedSignature) {
      updatePage(p.id, { content: normalized });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId]);

  useEffect(() => {
    syncHeadingToggleDom();
  }, [activePageId, syncHeadingToggleDom]);

  useEffect(() => {
    const root = editorContainerRef.current;
    if (!root) return;

    const handleToggleClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest(
        ".bn-toggle-button",
      );
      if (!button || !root.contains(button)) return;

      window.setTimeout(() => {
        const blockElement = button.closest<HTMLElement>(".bn-block");
        const blockId = blockElement?.dataset.id;
        if (!blockId) return;

        const content = editor.document as BlockNoteContent;
        let matched:
          | {
              block: any;
              ordinal: number;
            }
          | undefined;
        forEachFoldableHeading(content, (block, ordinal) => {
          if (block.id === blockId) {
            matched = { block, ordinal };
          }
        });
        if (!matched) return;

        const wrapper = button.closest<HTMLElement>(".bn-toggle-wrapper");
        const value =
          wrapper?.getAttribute("data-show-children") === "false"
            ? "false"
            : "true";
        setHeadingToggleState(
          pageIdForUpdateRef.current ?? activePageId,
          matched.block,
          matched.ordinal,
          value,
        );
      }, 0);
    };

    root.addEventListener("click", handleToggleClick);
    return () => root.removeEventListener("click", handleToggleClick);
  }, [activePageId, editor]);

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
        data-font-family={page.fontFamily ?? "default"}
        className={cn(
          "workspace-editor-surface mx-auto flex min-h-0 flex-1 flex-col w-full px-6 pt-2 pb-8",
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
            const safePageId = pageIdForUpdateRef.current;
            if (!safePageId) return;
            if (restoreFirstTitleHeading()) return;
            const nextContent = clonePageContent(editor.document as BlockNoteContent);
            ensureDefaultOpenToggleState(nextContent, safePageId);
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
        <CodeBlockEnhancer editor={editor} />
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
  </>);
});
