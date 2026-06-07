import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import {
  FilePanelController,
  FormattingToolbarController,
  LinkToolbarController,
  SuggestionMenuController,
  TableHandlesController,
  useEditorState,
  useExtensionState,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { offset as floatingOffset, shift as floatingShift } from "@floating-ui/react";
import {
  clonePageContent,
  getContentSignature,
  normalizePageContent,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { CustomSlashMenu } from "@/components/editor/core/CustomSlashMenu";
import {
  EditorFormattingToolbar,
  shouldRenderFormattingToolbar,
} from "@/components/editor/toolbars/formatting";
import { AIMenuController } from "@blocknote/xl-ai";
import { useFormattingToolbarAi } from "@/components/editor/state/formattingToolbarAi";
import { EditorSideMenu } from "@/components/editor/core/EditorSideMenu";
import { ImageLightbox } from "@/components/editor/image/ImageLightbox";
import { EditorLinkToolbar } from "@/components/editor/toolbars/link/EditorLinkToolbar";
import { FindInPageBar } from "@/components/editor/find/FindInPageBar";
import { closeAllOverlays } from "@/lib/closeAllOverlays";

// Sub-component and modular utility imports
import { EditorFilePanel } from "@/components/editor/menus/EditorFilePanel";
import { GooseTableHandle, GooseTableExtendButton } from "@/components/editor/menus/GooseTableHandle";
import { EditorContextMenu } from "@/components/editor/menus/EditorContextMenu";
import { editorSchema } from "@/components/editor/core/schema";

// Re-exports to prevent broken imports elsewhere
export {
  normalizeClipboardLineEndings,
  looksLikeMarkdownFragment,
  stripMarkdownHardBreaks,
  normalizeMarkdownPasteText,
  parseMarkdownLink,
  shouldPreferVisibleSelectionText,
  isValidUrl,
} from "@/components/editor/utils/clipboard";

export {
  isBottomEditorBlankClick,
  getSelectedPlainTextContext,
  getElementFromNode,
  isInteractiveEditorTarget,
} from "@/components/editor/utils/selection";

export { editorSchema } from "@/components/editor/core/schema";

type EditorComposerProps = {
  editor: any;
  editable: boolean;
  page: any;
  editorContainerRef: RefObject<HTMLDivElement | null>;
  handleEditorBlankMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleEditorPasteCapture: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  getSlashItems: (query: string) => Promise<any[]>;
  pageIdForUpdateRef: RefObject<string | null>;
  syncedContentSignatureRef: RefObject<string | null>;
  debouncedUpdate: ((id: string, content: BlockNoteContent) => void) & { cancel: () => void };
  isEditorFullWidth: boolean;
  effectiveTheme: "light" | "dark";
  tableEvenColumnWidth: boolean;
  searchProviders: any[];
  customActions: any[];
  /** 是否渲染块侧边菜单（+ / ⋮⋮）。速记小窗传 false 不显示，仅主编辑器显示。 */
  showSideMenu?: boolean;
};

export function EditorComposer({
  editor,
  editable,
  page,
  editorContainerRef,
  handleEditorBlankMouseDown,
  handleEditorPasteCapture,
  getSlashItems,
  pageIdForUpdateRef,
  syncedContentSignatureRef,
  debouncedUpdate,
  isEditorFullWidth,
  effectiveTheme,
  tableEvenColumnWidth,
  searchProviders,
  customActions,
  showSideMenu = true,
}: EditorComposerProps) {
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkPopoverUrl, setLinkPopoverUrl] = useState("");
  const linkPopoverRef = useRef<HTMLDivElement | null>(null);
  const [findBarOpen, setFindBarOpen] = useState(false);

  useEffect(() => {
    const handleOpenFind = () => {
      // 先关其它弹层，再开查找栏。setTimeout 让 Escape 引发的 commit 先跑完，
      // 避免被同步的 close 路径反吃掉。
      closeAllOverlays();
      setTimeout(() => setFindBarOpen(true), 0);
    };
    window.addEventListener("goose-note:editor-find-open", handleOpenFind);
    return () =>
      window.removeEventListener("goose-note:editor-find-open", handleOpenFind);
  }, []);

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

  const handleLinkPopoverSubmit = () => {
    const trimmed = linkPopoverUrl.trim();
    if (trimmed) {
      editor.createLink(trimmed);
    }
    setLinkPopoverOpen(false);
    setLinkPopoverUrl("");
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
        // 锁定在选区上方，去掉默认的 flip()：跨多行拖选时选区包围盒不断变高，
        // flip() 会在 top/bottom 之间反复翻转导致工具栏上下抖动（BlockNote #1569）。
        // 仅保留 offset + 受限 shift，水平方向贴边时平移、不再纵向翻转。
        placement: "top-start" as const,
        middleware: [
          floatingOffset(10),
          floatingShift({ crossAxis: false, padding: 8 }),
        ],
      },
    }),
    [
      formattingToolbarAiActive,
      formattingToolbarSelectionAllowed,
      formattingToolbarStoreOpen,
    ],
  );

  return (
    <EditorContextMenu
      editor={editor}
      editable={editable}
      page={page}
      editorContainerRef={editorContainerRef}
      handleEditorBlankMouseDown={handleEditorBlankMouseDown}
      handleEditorPasteCapture={handleEditorPasteCapture}
      searchProviders={searchProviders}
      customActions={customActions}
      effectiveTheme={effectiveTheme}
      isEditorFullWidth={isEditorFullWidth}
      tableEvenColumnWidth={tableEvenColumnWidth}
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
          const nextContent = normalizePageContent(
            clonePageContent(editor.document as BlockNoteContent),
          );
          const nextSig = getContentSignature(nextContent);
          if (nextSig === syncedContentSignatureRef.current) return;
          syncedContentSignatureRef.current = nextSig;
          debouncedUpdate(safePageId, nextContent);
        }}
      >
        {showSideMenu ? <EditorSideMenu /> : null}
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
            // 首块是「文件名标题」(恒为 H1，见 emptyContent / firstTitleGuard)，
            // 不允许被转成任何其它块类型，故首块行内一律不弹 slash 菜单。
            const cursorBlock = editor.getTextCursorPosition().block;
            if (cursorBlock && cursorBlock.id === editor.document[0]?.id) return false;
            if ($from.parentOffset !== 0) return false; // 仅行首触发
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
            // 同上：首块为文件名标题，不弹 slash 菜单。
            const cursorBlock = editor.getTextCursorPosition().block;
            if (cursorBlock && cursorBlock.id === editor.document[0]?.id) return false;
            if ($from.parentOffset !== 0) return false; // 仅行首触发
            return !$from.parent.type.isInGroup("tableContent");
          }}
          suggestionMenuComponent={CustomSlashMenu}
          onItemClick={(item) => {
            if (item && "onItemClick" in item) {
              (item as any).onItemClick();
            }
          }}
        />
        <AIMenuController />
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
      <ImageLightbox editor={editor} editorContainerRef={editorContainerRef} />
      <FindInPageBar
        editor={editor}
        open={findBarOpen}
        onClose={() => setFindBarOpen(false)}
      />
    </EditorContextMenu>
  );
}
