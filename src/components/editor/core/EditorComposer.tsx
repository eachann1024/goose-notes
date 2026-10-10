import { useMemo } from "react";
import {
  FilePanelController,
  LinkToolbarController,
  SuggestionMenuController,
  type FloatingUIOptions,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  clonePageContent,
  getContentSignature,
  type BlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { CustomSlashMenu } from "./CustomSlashMenu";
import { EditorFormattingToolbar } from "@/components/editor/toolbars/formatting";
import { FixedFormattingToolbarController } from "@/components/editor/toolbars/formatting/FixedFormattingToolbarController";
import { GooseFormattingToolbarController } from "@/components/editor/toolbars/formatting/GooseFormattingToolbarController";
import { GooseAIMenu } from "@/components/editor/ai/GooseAIMenu";
import { GooseAIMenuController } from "@/components/editor/ai/GooseAIMenuController";
import { FormattingToolbarHoldContext } from "@/components/editor/state/formattingToolbarHold";
import { EditorSideMenu } from "./EditorSideMenu";
import { ImageLightbox } from "@/components/editor/image/ImageLightbox";
import { EditorLinkToolbar } from "@/components/editor/toolbars/link/EditorLinkToolbar";
import { FindInPageBar } from "@/components/editor/find/FindInPageBar";
import { isQuickNoteEditorPage } from "@/pages/workspace/components/editor-host/editorContentMode";
import { EditorFilePanel } from "@/components/editor/menus/EditorFilePanel";
import { GooseTableHandlesController } from "@/components/editor/menus/GooseTableHandlesController";
import { EditorContextMenu } from "@/components/editor/menus/EditorContextMenu";
import {
  shouldOpenPageMentionSuggestionMenu,
  shouldOpenSlashSuggestionMenu,
} from "@/components/editor/utils/slashMenuPolicy";
import { getCompactSlashMenuFloatingOptions } from "@/components/editor/utils/compactSlashMenuFloating";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import { useEditorComposerInteractions } from "./useEditorComposerInteractions";
import { useEditorComposerToolbar } from "./useEditorComposerToolbar";
import { EditorLinkPopover } from "./EditorLinkPopover";
import type { EditorComposerProps } from "./editorComposerTypes";

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
  getSelectedCellPlainText,
  isWholeTableCellSelection,
  getSelectedImageUrl,
  getElementFromNode,
  isInteractiveEditorTarget,
  getActiveGooseNoteEditor,
  getEditorSelectedBlocksForExport,
  readLiveEditorSelectedBlocks,
  rememberEditorSelectedBlocks,
  clearEditorSelectedBlocksCache,
} from "@/components/editor/utils/selection";

export { editorSchema } from "@/components/editor/core/schema";
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
  pendingEditorChangeRef,
  debouncedUpdate,
  userInteractedRef,
  silentContentSync,
  isEditorFullWidth,
  effectiveTheme,
  searchProviders,
  customActions,
  showSideMenu = true,
  suppressFormattingToolbar = false,
  usesRawEditorContent,
}: EditorComposerProps) {
  const interactions = useEditorComposerInteractions({
    editor,
    editable,
    page,
    editorContainerRef,
  });
  const {
    aiSettings,
    getMentionItems,
    handleEditorKeyDownCapture,
    findBarOpen,
    setFindBarOpen,
    findSeedQuery,
    findOpenNonce,
    findOpenReplace,
  } = interactions;
  const { onPromotePreview } = useEditorPageContext();
  const {
    formattingToolbarOpen,
    formattingToolbarFloatingOptions,
    holdFormattingToolbar,
  } = useEditorComposerToolbar(
    { editor, editable, editorContainerRef, suppressFormattingToolbar },
    interactions.setLinkPopoverOpen,
  );

  const slashMenuFloatingOptions = useMemo(
    () =>
      __GOOSE_EDITOR_COMPACT__
        ? getCompactSlashMenuFloatingOptions()
        : undefined,
    [],
  );
  // 选区工具栏一出现就可见。链接工具栏 hover 等 150ms 再出现，减少划过误开；
  // 移出立即收起。挂到 document（portalElement=null），用 --editor-ui-scale
  // 写真实尺寸，避免 CSS zoom 在放大缩小后和图标对不齐。
  const linkToolbarFloatingOptions = useMemo<FloatingUIOptions>(
    () => ({
      useHoverProps: {
        delay: { open: 150, close: 0 },
      },
    }),
    [],
  );
  return (
    <EditorContextMenu
      editor={editor}
      editable={editable}
      page={page}
      editorContainerRef={editorContainerRef}
      handleEditorBlankMouseDown={handleEditorBlankMouseDown}
      handleEditorPasteCapture={handleEditorPasteCapture}
      handleEditorKeyDownCapture={handleEditorKeyDownCapture}
      searchProviders={searchProviders}
      customActions={customActions}
      effectiveTheme={effectiveTheme}
      isEditorFullWidth={isEditorFullWidth}
    >
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={effectiveTheme}
        slashMenu={false}
        formattingToolbar={false}
        linkToolbar={false}
        sideMenu={false}
        tableHandles={false}
        filePanel={false}
        onChange={() => {
          const safePageId = pageIdForUpdateRef.current;
          if (!safePageId) return;
          // raw 文档跳过 normalizePageContent（含 ensureFirstTitleHeading），
          // 与 Editor.tsx 切页/commit 路径保持一致，避免程序化规范化误触保存。
          // 用户真实输入仍会让文档签名偏离基线，照常走 debouncedUpdate 保存。
          // 须与 Editor.tsx 的 contentMode 保持一致；raw 文档不执行页面级规范化。
          const usesRawContent = usesRawEditorContent;
          // 用户意图门控（仅 raw 文档）：打开后无任何用户交互时的 onChange 来自
          // BlockNote 异步 props 补全（折叠块/视频/带属性图片等），静默同步 store 与
          // 基线、不入保存队列。一旦用户交互过（打字/IME/点击/拖拽…），照常入队保存。
          if (usesRawContent && !userInteractedRef.current) {
            const nextContent = clonePageContent(
              editor.document as BlockNoteContent,
            );
            const nextSig = getContentSignature(nextContent);
            if (nextSig === syncedContentSignatureRef.current) return;
            syncedContentSignatureRef.current = nextSig;
            silentContentSync(nextContent);
            return;
          }
          pendingEditorChangeRef.current = true;
          debouncedUpdate(safePageId);
          if (userInteractedRef.current) {
            onPromotePreview?.();
          }
        }}
      >
        {showSideMenu && editable ? <EditorSideMenu /> : null}
        {editable ? <GooseTableHandlesController /> : null}
        <FormattingToolbarHoldContext.Provider value={holdFormattingToolbar}>
          {__GOOSE_EDITOR_COMPACT__ || isQuickNoteEditorPage(page) ? (
            <FixedFormattingToolbarController
              formattingToolbar={EditorFormattingToolbar}
              open={formattingToolbarOpen}
            />
          ) : (
            <GooseFormattingToolbarController
              formattingToolbar={EditorFormattingToolbar}
              floatingUIOptions={formattingToolbarFloatingOptions}
              portalElement={null}
            />
          )}
        </FormattingToolbarHoldContext.Provider>
        <LinkToolbarController
          linkToolbar={EditorLinkToolbar}
          portalElement={null}
          floatingUIOptions={linkToolbarFloatingOptions}
        />
        {editable ? <FilePanelController filePanel={EditorFilePanel} /> : null}
        {editable ? (
          <>
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={getSlashItems}
              floatingUIOptions={slashMenuFloatingOptions}
              shouldOpen={(event) =>
                shouldOpenSlashSuggestionMenu(event, editor, {
                  allowSlashMenuOnFirstBlock: usesRawEditorContent,
                })
              }
              suggestionMenuComponent={CustomSlashMenu as any}
              onItemClick={(item) => {
                if (item && "onItemClick" in item) {
                  (item as any).onItemClick();
                }
              }}
            />
            <SuggestionMenuController
              triggerCharacter="、"
              getItems={getSlashItems}
              floatingUIOptions={slashMenuFloatingOptions}
              shouldOpen={(event) =>
                shouldOpenSlashSuggestionMenu(event, editor, {
                  allowSlashMenuOnFirstBlock: usesRawEditorContent,
                })
              }
              suggestionMenuComponent={CustomSlashMenu as any}
              onItemClick={(item) => {
                if (item && "onItemClick" in item) {
                  (item as any).onItemClick();
                }
              }}
            />
            {__GOOSE_LITE__ || isQuickNoteEditorPage(page) ? null : (
              <SuggestionMenuController
                triggerCharacter="@"
                getItems={getMentionItems}
                floatingUIOptions={slashMenuFloatingOptions}
                shouldOpen={(event) =>
                  shouldOpenPageMentionSuggestionMenu(event, editor)
                }
                suggestionMenuComponent={CustomSlashMenu as any}
                onItemClick={(item) => {
                  if (item && "onItemClick" in item) {
                    (item as any).onItemClick();
                  }
                }}
              />
            )}
          </>
        ) : null}
        {/* 紧凑编辑器构建不挂 AI 菜单。 */}
        {__GOOSE_EDITOR_AI__ &&
          aiSettings.enabled &&
          editable &&
          !isQuickNoteEditorPage(page) && (
            <GooseAIMenuController aiMenu={GooseAIMenu} />
          )}
      </BlockNoteView>
      <EditorLinkPopover {...interactions} />
      <ImageLightbox
        editor={editor}
        editorContainerRef={editorContainerRef}
        editable={editable}
      />
      <FindInPageBar
        editor={editor}
        open={findBarOpen}
        seedQuery={findSeedQuery}
        openNonce={findOpenNonce}
        openReplace={findOpenReplace}
        editable={editable}
        onClose={() => setFindBarOpen(false)}
      />
    </EditorContextMenu>
  );
}
