import { useMemo } from "react";
import { GooseAIExtension } from "@/components/editor/ai/GooseAIExtension";
import { toast } from "@/components/ui/sonner";
import type { EditorSession } from "./useEditorSession";
import { gooseSelectAllExtension } from "@/components/editor/extensions/selectAllExtension";
import { gooseTableCellSelectionExtension } from "@/components/editor/extensions/tableCellSelectionExtension";
import { gooseCopyCurrentBlockExtension } from "@/components/editor/extensions/copyCurrentBlockExtension";
import { gooseMoveBlockExtension } from "@/components/editor/extensions/moveBlockExtension";
import { createGooseLinkKeyboardExtension } from "@/components/editor/extensions/linkKeyboardExtension";
import { gooseTabBehaviorExtension } from "@/components/editor/extensions/tabBehaviorExtension";
import { gooseTableEnterExtension } from "@/components/editor/extensions/tableEnterExtension";
import { gooseCodeBlockKeyboardExtension } from "@/components/editor/extensions/codeBlockKeyboardExtension";
import { gooseCodeTextDropExtension } from "@/components/editor/extensions/codeTextDropExtension";
import { gooseCodeBlockLinkStripExtension } from "@/components/editor/extensions/codeBlockLinkStripExtension";
import { gooseFirstTitleEnterExtension } from "@/components/editor/extensions/firstTitleEnterExtension";
import { gooseMediaBlockEnterExtension } from "@/components/editor/extensions/mediaBlockEnterExtension";
import { gooseEmptyNestedListEnterExtension } from "@/components/editor/extensions/emptyNestedListEnterExtension";
import { gooseCollapsedToggleEnterExtension } from "@/components/editor/extensions/collapsedToggleEnterExtension";
import { gooseHeadingSectionFoldExtension } from "@/components/editor/extensions/headingSectionFoldExtension";
import { gooseCrossBlockDeleteExtension } from "@/components/editor/extensions/crossBlockDeleteExtension";
import { gooseEmptyBlockBackspaceExtension } from "@/components/editor/extensions/emptyBlockBackspaceExtension";
import { createGooseNumberedListStartNormalizationExtension } from "@/components/editor/extensions/numberedListStartNormalizationExtension";
import { createGooseBodyParagraphGuardExtension } from "@/components/editor/extensions/bodyParagraphGuardExtension";
import { createGooseFirstTitleGuardExtension } from "@/components/editor/inputrules/firstTitleGuard";
import { gooseMarkdownInputRulesExtension } from "@/components/editor/inputrules/markdownInputRules";
import { gooseDividerInputRuleExtension } from "@/components/editor/inputrules/dividerInputRule";
import { gooseSuppressMarkdownInSpecialBlocksExtension } from "@/components/editor/inputrules/suppressMarkdownInSpecialBlocks";
import { gooseHeadingMarkSuppressExtension } from "@/components/editor/extensions/headingMarkSuppressExtension";
import { gooseInlineCodeCaretExtension } from "@/components/editor/extensions/inlineCodeCaretExtension";
import { gooseTrailingBlankClickExtension } from "@/components/editor/extensions/trailingBlankClickExtension";
import { gooseLineBoundaryKeyboardExtension } from "@/components/editor/extensions/lineBoundaryKeyboardExtension";
import { createInlineCodePathTagExtension } from "@/components/editor/extensions/inlineCodePathTagExtension";
import { createPageMentionClickExtension } from "@/components/editor/extensions/pageMentionClickExtension";
import { gooseWikiLinkInputExtension } from "@/components/editor/extensions/wikiLinkInputExtension";
import { gooseInlineCodeBacktickWrapExtension } from "@/components/editor/extensions/inlineCodeBacktickWrapExtension";
import { gooseActiveListMarkerExtension } from "@/components/editor/extensions/activeListMarkerExtension";
import { gooseActiveHeadingCaretExtension } from "@/components/editor/extensions/activeHeadingCaretExtension";
import { gooseActiveLineExtension } from "@/components/editor/extensions/activeLineExtension";
import { gooseFakeSelectionExtension } from "@/components/editor/extensions/fakeSelectionExtension";
import { ArrowInputRuleExtension } from "@/components/editor/inputrules/arrowInputRule";
import { gooseFindInPageExtension } from "@/components/editor/find/findInPagePlugin";
import { gooseSearchSessionHighlightExtension } from "@/components/editor/find/searchSessionHighlightPlugin";
import { createGooseSlashMenuReconcileExtension } from "@/components/editor/extensions/gooseSlashMenuReconcileExtension";

export function useEditorExtensions(session: EditorSession) {
  const {
    getActivePageLocalFilePathRef,
    getActivePageLocalFolderRootRef,
    platformRef,
    onOpenMarkdownPathRef,
    onOpenPageRef,
    settingsRef,
    usesRawEditorContentRef,
    editorInstanceRef,
    aiSettingsRef,
    inlineAiScopeRef,
  } = session;
  // 行内代码相对路径 tag：扩展实例只建一次（extensions 数组变化会重建编辑器），
  // 依赖全部走 ref 读取。放在 inlineCodeCaret 之前，Cmd/Ctrl 点击先被它短路。
  const inlineCodePathTagExtension = useMemo(
    () =>
      createInlineCodePathTagExtension({
        getPageLocalFilePath: () => getActivePageLocalFilePathRef.current(),
        getLocalFolderRoot: () => getActivePageLocalFolderRootRef.current(),
        existsAsync: (path) => platformRef.current.fs.existsAsync(path),
        isFsAvailable: () => platformRef.current.fs.isAvailable(),
        openPath: (rawText) => {
          const openMarkdown = onOpenMarkdownPathRef.current;
          if (!openMarkdown) return;
          void openMarkdown(rawText).then((opened) => {
            if (!opened) {
              toast.error("无法打开该 Markdown 笔记");
            }
          });
        },
      }),
    [],
  );

  const pageMentionClickExtension = useMemo(
    () =>
      createPageMentionClickExtension({
        openPage: (pageId, wikiTarget, options) =>
          onOpenPageRef.current(pageId, wikiTarget, options),
      }),
    [],
  );

  return [
    createGooseFirstTitleGuardExtension(usesRawEditorContentRef),
    createGooseBodyParagraphGuardExtension(usesRawEditorContentRef),
    gooseSuppressMarkdownInSpecialBlocksExtension,
    gooseHeadingMarkSuppressExtension,
    pageMentionClickExtension,
    gooseWikiLinkInputExtension,
    inlineCodePathTagExtension,
    gooseTrailingBlankClickExtension,
    gooseLineBoundaryKeyboardExtension,
    gooseInlineCodeCaretExtension,
    gooseInlineCodeBacktickWrapExtension,
    gooseActiveListMarkerExtension,
    gooseActiveHeadingCaretExtension,
    gooseActiveLineExtension,
    gooseTabBehaviorExtension,
    gooseTableEnterExtension,
    gooseSelectAllExtension,
    gooseTableCellSelectionExtension,
    gooseCopyCurrentBlockExtension,
    gooseMoveBlockExtension,
    createGooseLinkKeyboardExtension(settingsRef),
    gooseCodeBlockKeyboardExtension,
    gooseCodeTextDropExtension(),
    gooseCodeBlockLinkStripExtension,
    gooseFirstTitleEnterExtension,
    gooseMediaBlockEnterExtension,
    gooseEmptyNestedListEnterExtension,
    gooseCollapsedToggleEnterExtension,
    gooseHeadingSectionFoldExtension,
    gooseCrossBlockDeleteExtension,
    gooseEmptyBlockBackspaceExtension,
    createGooseNumberedListStartNormalizationExtension(usesRawEditorContentRef),
    createGooseSlashMenuReconcileExtension(
      usesRawEditorContentRef,
      editorInstanceRef,
    ),
    gooseMarkdownInputRulesExtension(),
    gooseFakeSelectionExtension,
    ArrowInputRuleExtension,
    gooseFindInPageExtension,
    gooseSearchSessionHighlightExtension,
    gooseDividerInputRuleExtension(),
    // 紧凑编辑器构建不挂 AI 扩展，避免加载不需要的模型依赖。
    ...(!__GOOSE_EDITOR_AI__
      ? []
      : [
          GooseAIExtension({
            getSettings: () => aiSettingsRef.current,
            getScope: () => inlineAiScopeRef.current(),
          }),
        ]),
  ];
}
