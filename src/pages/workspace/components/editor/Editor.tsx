import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { ImageExportThemeSelector } from "@/components/ui/image-export-theme-selector";
import * as LucideIcons from "lucide-react";
import type { CardThemeId, WatermarkConfig } from "@/lib/imageExport";
import { exportSelectionToImage } from "@/lib/imageExport";
import {
  EMPTY_CELL_HEIGHT,
  EMPTY_CELL_WIDTH,
  createHeadingBlockSpec,
  type PartialTableContent,
} from "@blocknote/core";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core/blocks";
import {
  FormattingToolbarExtension,
  TableHandlesExtension,
} from "@blocknote/core/extensions";
import {
  CellSelection,
  deleteRow,
  selectedRect,
} from "prosemirror-tables";
import { EditorState } from "@tiptap/pm/state";
import {
  BlockNoteViewRaw as BlockNoteView,
  FilePanelController,
  FormattingToolbarController,
  LinkToolbarController,
  SuggestionMenuController,
  TableHandlesController,
  useCreateBlockNote,
  useBlockNoteEditor,
  useExtension,
  useEditorState,
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
import {
  getBlockNoteSlashMenuItems,
  filterSlashMenuItems,
} from "@/pages/workspace/components/command/blocknoteSlashItems";
import { CustomSlashMenu } from "@/pages/workspace/components/command/CustomSlashMenu";
import {
  EditorFormattingToolbar,
  shouldRenderFormattingToolbar,
} from "./EditorFormattingToolbar";
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
import { useFormattingToolbarAi } from "@/stores/useFormattingToolbarAi";
import { EditorSideMenu } from "./EditorSideMenu";
import { ImageLightbox } from "./ImageLightbox";
import { gooseSelectAllExtension } from "./selectAllExtension";
import { gooseLinkKeyboardExtension } from "./linkKeyboardExtension";
import { gooseTabBehaviorExtension } from "./tabBehaviorExtension";
import { gooseCodeBlockKeyboardExtension } from "./codeBlockKeyboardExtension";
import { gooseFakeSelectionExtension } from "./fakeSelectionExtension";
import { EditorLinkToolbar } from "./EditorLinkToolbar";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { UToolsAdapter } from "@/lib/utools";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type EditorFilePanelProps = {
  blockId: string;
};


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
    /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|\s*[-*+]\s\[[ xX]\]\s|\s*[•·]\s|\s*\.\s)/m.test(value) ||
    /```/.test(value) ||
    /\|.+\|/.test(value) ||
    /(\*\*|__|~~|`[^`]+`)/.test(value) ||
    /\[([^\]]+)\]\(([^)]+)\)/.test(value)
  );
}

function normalizeMarkdownPasteText(text: string): string {
  return normalizeClipboardLineEndings(text).replace(
    /^(\s*)(?:[•·]|\.)\s+/gm,
    "$1- ",
  );
}

function parseMarkdownLink(text: string): { text: string; url: string } | null {
  const match = text.trim().match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (!match) return null;
  return { text: match[1], url: match[2] };
}

function normalizeClipboardLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function getElementFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (node instanceof HTMLElement) return node;
  return node.parentElement;
}

function isInteractiveEditorTarget(target: HTMLElement): boolean {
  return Boolean(
    target.closest(
      [
        "button",
        "input",
        "textarea",
        "select",
        "a",
        "[role='button']",
        "[contenteditable='false']",
        "[data-radix-popper-content-wrapper]",
        "[data-notion-slash-root='true']",
        ".bn-side-menu",
        ".bn-formatting-toolbar",
        ".bn-table-handle",
        ".goose-table-extend-button",
        ".goose-code-toolbar-host",
      ].join(","),
    ),
  );
}

function isBottomEditorBlankClick(
  event: React.MouseEvent<HTMLDivElement>,
  container: HTMLElement,
): boolean {
  const target = event.target as HTMLElement | null;
  if (!target || !container.contains(target)) return false;
  if (isInteractiveEditorTarget(target)) return false;
  if (target.closest(".bn-block-outer, .bn-block-content")) return false;

  const editorSurface = target.closest(
    ".workspace-editor-surface, .bn-container, .bn-root, .bn-editor, .tiptap",
  );
  if (!editorSurface || !container.contains(editorSurface)) return false;

  const blocks = container.querySelectorAll<HTMLElement>(".bn-block-outer");
  const lastBlock = blocks[blocks.length - 1];
  if (!lastBlock) return true;

  return event.clientY >= lastBlock.getBoundingClientRect().bottom;
}

function getSelectedPlainTextContext(container: HTMLElement): {
  selectedText: string;
  withinCodeBlock: boolean;
} | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const commonAncestor =
    range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

  if (!commonAncestor || !container.contains(commonAncestor)) return null;

  const selectedText = normalizeClipboardLineEndings(selection.toString());
  if (!selectedText) return null;

  const startElement = getElementFromNode(range.startContainer);
  const endElement = getElementFromNode(range.endContainer);
  const withinCodeBlock =
    !!startElement?.closest(".goose-code-block-node") &&
    !!endElement?.closest(".goose-code-block-node");

  return {
    selectedText,
    withinCodeBlock,
  };
}

function stripMarkdownHardBreakArtifacts(value: string): string {
  return normalizeClipboardLineEndings(value)
    .replace(/\\\n/g, "\n")
    .replace(/ {2,}\n/g, "\n");
}

function unwrapMarkdownAutolink(value: string): string | null {
  const normalized = normalizeClipboardLineEndings(value).trim();
  const match = normalized.match(/^<([^<>\s]+)>$/);
  return match?.[1] ?? null;
}

function shouldPreferVisibleSelectionText(
  clipboardText: string,
  selectedText: string,
  withinCodeBlock: boolean,
): boolean {
  if (!selectedText) return false;
  if (withinCodeBlock) return true;
  if (unwrapMarkdownAutolink(clipboardText) === selectedText.trim()) return true;
  if (!clipboardText.includes("\\\n") && !clipboardText.match(/ {2,}\n/)) return false;
  return stripMarkdownHardBreakArtifacts(clipboardText) === selectedText;
}

function isValidUrl(text: string): boolean {
  if (!text) return false;
  // 协议 URL
  if (/^[a-z][a-z0-9+.-]*:\/\/\S+/i.test(text)) return true;
  // www. 开头的 URL
  if (/^www\.\S+\.\S{2,}/i.test(text)) return true;
  // 域名格式的 URL (example.com/path)
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+\.[a-z]{2,}(\/\S*)?$/i.test(text)) return true;
  return false;
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

function cloneTableCell(cell: unknown) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(cell);
  }

  return JSON.parse(JSON.stringify(cell));
}

function getTableColumnCount(content: PartialTableContent<any, any>) {
  return Math.max(0, ...content.rows.map((row) => row.cells.length));
}

function getInsertedColumnRows(
  tableHandles: ReturnType<typeof useExtension<typeof TableHandlesExtension>>,
  block: any,
  insertIndex: number,
) {
  const rowsWithTrailingColumn = tableHandles.addRowsOrColumns(block, "columns", 1);

  return block.content.rows.map((row: { cells: unknown[] }, rowIndex: number) => {
    const cells = [...row.cells];
    const blankCell = rowsWithTrailingColumn[rowIndex]?.cells.at(-1) ?? "";
    cells.splice(insertIndex, 0, cloneTableCell(blankCell));
    return {
      ...row,
      cells,
    };
  });
}

function getDeletedColumnRows(
  content: PartialTableContent<any, any>,
  fromIndex: number,
  toIndex = fromIndex + 1,
) {
  return content.rows.map((row) => ({
    ...row,
    cells: row.cells.filter((_, cellIndex) => cellIndex < fromIndex || cellIndex >= toIndex),
  }));
}

function getUpdatedColumnWidths(
  columnWidths: unknown[] | undefined,
  action:
    | { type: "insert"; index: number }
    | { type: "delete"; fromIndex: number; toIndex: number },
) {
  if (!Array.isArray(columnWidths)) return columnWidths;

  const nextColumnWidths = [...columnWidths];
  if (action.type === "insert") {
    nextColumnWidths.splice(action.index, 0, columnWidths[action.index] ?? columnWidths.at(-1));
  } else {
    nextColumnWidths.splice(action.fromIndex, action.toIndex - action.fromIndex);
  }
  return nextColumnWidths;
}

function GooseTableHandle({ orientation, hideOtherElements }: TableHandleProps) {
  const editor = useBlockNoteEditor<any, any, any>();
  const tableHandles = useExtension(TableHandlesExtension);
  const state = useExtensionState(TableHandlesExtension);
  const [open, setOpen] = useState(false);

  const index = state
    ? orientation === "column" ? state.colIndex : state.rowIndex
    : undefined;
  const isRow = orientation === "row";
  const isHeaderRow = Boolean(state?.block.content.headerRows);

  const closeMenu = useCallback(() => {
    setOpen(false);
    tableHandles?.unfreezeHandles();
    hideOtherElements(false);
    editor.focus();
  }, [editor, hideOtherElements, tableHandles]);

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

  const updateTableColumns = useCallback(
    (action: "add-left" | "add-right" | "delete") => {
      if (!state?.block || !tableHandles || index === undefined || isRow) return;

      const block = state.block;
      const content = block.content as PartialTableContent<any, any>;
      const columnCount = getTableColumnCount(content);
      const insertIndex = action === "add-left" ? index : index + 1;
      const rows =
        action === "delete"
          ? getDeletedColumnRows(content, index)
          : getInsertedColumnRows(tableHandles, block, insertIndex);
      const columnWidths = getUpdatedColumnWidths(
        content.columnWidths,
        action === "delete"
          ? { type: "delete", fromIndex: index, toIndex: index + 1 }
          : { type: "insert", index: insertIndex },
      );

      if (action === "delete" && columnCount <= 1) return;

      editor.updateBlock(block, {
        type: "table",
        content: {
          ...content,
          columnWidths,
          rows,
        } as any,
      });
      editor.setTextCursorPosition(block);
    },
    [editor, index, isRow, state?.block, tableHandles],
  );

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
        if (state?.block) {
          const content = state.block.content as PartialTableContent<any, any>;
          const columnCount = getTableColumnCount(content);
          if (selectedColumns < columnCount) {
            editor.updateBlock(state.block, {
              type: "table",
              content: {
                ...content,
                columnWidths: getUpdatedColumnWidths(content.columnWidths, {
                  type: "delete",
                  fromIndex: rect.left,
                  toIndex: rect.right,
                }),
                rows: getDeletedColumnRows(content, rect.left, rect.right),
              } as any,
            });
            editor.setTextCursorPosition(state.block);
          }
        }
        return;
      }
    }

    if (isRow) {
      tableHandles?.removeRowOrColumn(index!, orientation);
    } else {
      updateTableColumns("delete");
    }
  }, [editor, index, isRow, orientation, state?.block, tableHandles, updateTableColumns]);

  const handleToggleHeaderRow = useCallback(() => {
    if (!state?.block || !isRow || index !== 0) return;
    editor.updateBlock(state.block, {
      ...state.block,
      content: {
        ...state.block.content,
        headerRows: isHeaderRow ? undefined : 1,
      } as any,
    });
  }, [editor, index, isHeaderRow, isRow, state?.block]);

  const runMenuAction = useCallback(
    (action: () => void) => {
      closeMenu();
      action();
    },
    [closeMenu],
  );

  if (!state || index === undefined) return null;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
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
            <DropdownMenuItem onClick={() => runMenuAction(() => updateTableColumns("add-left"))}>
              <LucideIcons.ArrowLeft className="mr-2 h-4 w-4" /> 左侧添加列
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runMenuAction(() => updateTableColumns("add-right"))}>
              <LucideIcons.ArrowRight className="mr-2 h-4 w-4" /> 右侧添加列
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runMenuAction(handleDelete)}>
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
  const editor = useCreateBlockNote(
    {
      initialContent: initialContentRef.current as any,
      schema: editorSchema,
      extensions: [gooseTabBehaviorExtension, gooseSelectAllExtension, gooseLinkKeyboardExtension, gooseCodeBlockKeyboardExtension, gooseFakeSelectionExtension],
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
      links: {
        onClick: (event) => {
          if (!event.metaKey && !event.ctrlKey) {
            return false;
          }
          const target = event.target as HTMLElement | null;
          const link = target?.closest<HTMLAnchorElement>(
            'a[data-inline-content-type="link"]',
          );
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
      updatePage(p.id, { content: nextContent });
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
      const plainText = normalizeMarkdownPasteText(clipboard.getData("text/plain"));
      if (!plainText) return;

      const trimmedText = plainText.trim();

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

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const patchClipboardPlainText = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      const selectionContext = getSelectedPlainTextContext(container);
      if (!selectionContext) return;

      const clipboardText = normalizeClipboardLineEndings(
        clipboardData.getData("text/plain"),
      );
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
      syncedContentSignatureRef.current = getContentSignature(nextContent);
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

    window.addEventListener("goose-note:flush-editor", handleFlush);
    window.addEventListener("goose-note:focus-editor-start", handleFocusStart);
    window.addEventListener("goose-note:plugin-enter", handlePluginEnter);

    return () => {
      window.removeEventListener("goose-note:flush-editor", handleFlush);
      window.removeEventListener(
        "goose-note:focus-editor-start",
        handleFocusStart,
      );
      window.removeEventListener("goose-note:plugin-enter", handlePluginEnter);
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

  const [selectedBlocks, setSelectedBlocks] = useState<BlockNoteContent>([]);
  const [selectedText, setSelectedText] = useState("");
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);
  const selectedBlocksRef = useRef<BlockNoteContent>([]);
  const selectedTextRef = useRef("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkPopoverUrl, setLinkPopoverUrl] = useState("");
  const linkPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOpen = () => {
      setLinkPopoverUrl("");
      setLinkPopoverOpen(true);
    };
    const handleClose = () => setLinkPopoverOpen(false);
    document.addEventListener("goose-open-link-popover", handleOpen);
    document.addEventListener("goose-close-link-popover", handleClose);
    return () => {
      document.removeEventListener("goose-open-link-popover", handleOpen);
      document.removeEventListener("goose-close-link-popover", handleClose);
    };
  }, []);

  useEffect(() => {
    if (!linkPopoverOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (linkPopoverRef.current?.contains(target)) return;
      setLinkPopoverOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLinkPopoverOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleEscape, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleEscape, true);
    };
  }, [linkPopoverOpen]);

  const handleLinkPopoverSubmit = useCallback(() => {
    const trimmed = linkPopoverUrl.trim();
    if (trimmed) {
      editor.createLink(trimmed);
    }
    setLinkPopoverOpen(false);
    setLinkPopoverUrl("");
  }, [linkPopoverUrl, editor]);

  const activeSearchProviders = useMemo(
    () => searchProviders.filter((provider) => provider.isEnabled),
    [searchProviders],
  );
  const enabledCustomActions = useMemo(
    () => customActions.filter((action) => action.isEnabled && action.name.trim() && action.command.trim()),
    [customActions],
  );

  const handleContextMenuOpen = () => {
    let text = "";
    try {
      text = editor.getSelectedText() || "";
    } catch { /* ignore */ }
    if (!text.trim()) {
      try {
        text = document.getSelection()?.toString() || "";
      } catch { /* ignore */ }
    }
    const trimmedText = text.trim();
    setSelectedText(trimmedText);
    selectedTextRef.current = trimmedText;

    let blocks: BlockNoteContent = [];
    if (!trimmedText) {
      try {
        const pmSel = editor.prosemirrorState.selection;
        const $from = pmSel.$from;
        let inBlock = false;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === "blockContainer") { inBlock = true; break; }
        }
        if (inBlock) {
          const selected = editor.getSelection();
          if (Array.isArray(selected?.blocks)) {
            blocks = selected.blocks as BlockNoteContent;
          }
        }
      } catch { /* ignore */ }
      if (blocks.length <= 1) {
        blocks = [];
      }
    }
    setSelectedBlocks(blocks);
    selectedBlocksRef.current = blocks;
  };

  const handleContextPaste = useCallback(async () => {
    if (!editable) return;
    try {
      const text = normalizeMarkdownPasteText(await navigator.clipboard.readText());
      if (!text) return;
      if (looksLikeMarkdownFragment(text)) {
        editor.pasteMarkdown(text);
      } else {
        editor.insertInlineContent(text);
      }
    } catch (error) {
      console.error("Failed to read clipboard contents: ", error);
    }
  }, [editable, editor]);

  const handleCopySelection = useCallback(() => {
    const text = selectedTextRef.current || editor.getSelectedText() || "";
    UToolsAdapter.copyToClipboard(text);
  }, [editor]);

  const handleCutSelection = useCallback(() => {
    if (!editable) return;
    const text = selectedTextRef.current || editor.getSelectedText() || "";
    UToolsAdapter.copyToClipboard(text);
    editor.exec((state, dispatch) => {
      dispatch?.(state.tr.deleteSelection());
      return true;
    });
  }, [editable, editor]);

  const handleSelectionThemeConfirm = (themeId: CardThemeId, watermarkConfig: WatermarkConfig) => {
    const blocks = selectedBlocksRef.current;
    if (!Array.isArray(blocks) || blocks.length === 0) return;
    const title = extractBlockNoteTitle(page?.content) || "选中内容";
    exportSelectionToImage(blocks, title, themeId, watermarkConfig);
  };

  const formattingToolbarStoreOpen = useExtensionState(FormattingToolbarExtension, { editor });
  const formattingToolbarSelectionAllowed = useEditorState({
    editor,
    on: "selection",
    selector: ({ editor }) => shouldRenderFormattingToolbar(editor),
  });
  const formattingToolbarAiActive = useFormattingToolbarAi((s) => s.active);
  const formattingToolbarFloatingOptions = useMemo(
    () => ({
      useFloatingOptions: {
        open:
          formattingToolbarAiActive ||
          (formattingToolbarStoreOpen && formattingToolbarSelectionAllowed),
      },
    }),
    [
      formattingToolbarAiActive,
      formattingToolbarSelectionAllowed,
      formattingToolbarStoreOpen,
    ],
  );

  if (!page) return null;

  return (
    <>
    <ContextMenu onOpenChange={(open) => { if (open) handleContextMenuOpen(); }}>
      <ContextMenuTrigger asChild>
        <div
          ref={editorContainerRef}
          onMouseDown={handleEditorBlankMouseDown}
          onPasteCapture={handleEditorPasteCapture}
          data-font-family={page.fontFamily ?? "default"}
          className={cn(
            "workspace-editor-surface relative flex min-h-0 flex-1 flex-col w-full pt-2",
            isEditorFullWidth ? "max-w-none" : "max-w-4xl mx-auto",
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
            const nextContent = normalizePageContent(
              clonePageContent(editor.document as BlockNoteContent),
            );
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
            floatingUIOptions={formattingToolbarFloatingOptions}
          />
          <LinkToolbarController linkToolbar={EditorLinkToolbar} />
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
        {linkPopoverOpen && (
          <div
            ref={linkPopoverRef}
            className="absolute z-[20020] flex items-center gap-1.5 rounded-lg border border-border/80 bg-popover p-2 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/15 dark:bg-[#2f3437]"
            style={{ top: 8, left: "50%", transform: "translateX(-50%)" }}
          >
            <input
              value={linkPopoverUrl}
              onChange={(e) => setLinkPopoverUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLinkPopoverSubmit();
                }
                if (e.key === "Escape") {
                  setLinkPopoverOpen(false);
                }
              }}
              placeholder="https://..."
              autoFocus
              className="h-8 w-56 rounded-md border border-transparent bg-background px-2.5 text-sm shadow-[inset_0_0_0_1px_hsl(var(--input)/0.8)] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            />
            <button
              type="button"
              onClick={handleLinkPopoverSubmit}
              className="flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              确认
            </button>
          </div>
        )}
      </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[180px]">
        {selectedText && activeSearchProviders.length > 0 && (
          <>
            <ContextMenuItem disabled className="max-w-[168px] truncate text-xs text-muted-foreground">
              {selectedText.length > 20 ? `${selectedText.slice(0, 20)}...` : selectedText}
            </ContextMenuItem>
            <ContextMenuSeparator />
            {activeSearchProviders.map((provider) => (
              <ContextMenuItem
                key={provider.id}
                onSelect={() => {
                  const url = provider.urlTemplate.replace(
                    "%s",
                    encodeURIComponent(selectedText),
                  );
                  UToolsAdapter.openUrl(url, utools.openSearchInUtools);
                }}
              >
                <LucideIcons.Search className="mr-2 h-4 w-4" />
                用 {provider.name} 搜索
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
          </>
        )}
        {selectedText && enabledCustomActions.length > 0 && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <LucideIcons.Zap className="mr-2 h-4 w-4" />
                快捷动作
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {enabledCustomActions.map((action) => (
                  <ContextMenuItem
                    key={action.id}
                    onSelect={() => {
                      const label = action.pluginName
                        ? [action.pluginName, action.command] as [string, string]
                        : action.command;
                      UToolsAdapter.redirect(label, selectedText);
                    }}
                  >
                    {action.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          disabled={!editable || !selectedText}
          onSelect={handleCutSelection}
        >
          <LucideIcons.Scissors className="mr-2 h-4 w-4" />
          剪切
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘X</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!selectedText}
          onSelect={handleCopySelection}
        >
          <LucideIcons.Copy className="mr-2 h-4 w-4" />
          拷贝
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘C</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!editable}
          onSelect={handleContextPaste}
        >
          <LucideIcons.Clipboard className="mr-2 h-4 w-4" />
          粘贴
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘V</span>
        </ContextMenuItem>
        {selectedBlocks.length > 0 && (
          <ContextMenuItem
            onSelect={() => {
              selectedBlocksRef.current = selectedBlocks;
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
