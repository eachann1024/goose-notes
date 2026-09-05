/**
 * EditorHostBridge —— 宿主（Electron app）把应用 store 桥接成编辑器内核所需的注入对象。
 *
 * 编辑器内核（@/components/editor）不直接读 usePages/useNotebooks/useSettings/useTabs，
 * 也不直接碰平台 API；本桥读取这些 store 与 Electron 平台实现，组装成 EditorSettings /
 * EditorPageContext，经 <EditorPlatformProvider> + <EditorHostProvider> 注入，再渲染
 * 传入的 <Editor>（children）。
 *
 * 行为保持不变：注入对象的各字段/回调一一对应抽取前 Editor.tsx 内的 store 直读逻辑。
 *
 */
import { useMemo, type ReactNode } from "react";
import type { Page } from "@/types";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { useTabs } from "@/stores/useTabs";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import {
  getPageTitle,
  withInternalPageTitle,
} from "@/components/editor/utils/page-title";
import {
  listVisibleWorkspaceTabs,
  shouldEditTitleInTabPill,
} from "@/pages/workspace/components/page/visibleTabs";
import { shouldUseRawEditorContent } from "./editorContentMode";
import { EditorPlatformProvider } from "@/components/editor/platform/context";
import {
  EditorHostProvider,
  type EditorSettings,
  type EditorPageContext,
} from "@/components/editor/platform/hostContext";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import {
  getAiReferenceSuggestionItems,
  resolveAiReferenceContexts,
} from "@/components/editor/ai/composer/referenceLookup";
import { editorPlatform } from "@/lib/editor-platform/resolve";
import { HostAdapter } from "@/lib/host/adapter";
import { fileStorage } from "@/lib/fileStorage";
import { openResourceExternally } from "@/components/editor/utils/openResourceExternally";
import { tryShowPageInFocusedSplit } from "@/lib/editor-split/commands";
import { resolvePageMentionNavigation } from "@/lib/pageMentionNavigation";
import { toast } from "@/components/ui/sonner";

interface EditorHostBridgeProps {
  /** 当前被编辑的页（替换编辑器内核对 usePages.activePageId/getPage 的直读）。 */
  page: Page;
  /** 宿主决定编辑器是否使用全宽；常规笔记固定为 true。 */
  isEditorFullWidth: boolean;
  /**
   * 内容变更落库回调的覆盖。默认走 usePages.updatePage 落库；速记小窗草稿模式传入此项，
   * 把内容写到草稿存储而非真实 page（草稿不入 pages map、不进笔记列表）。
   */
  onContentChangeOverride?: (
    content: BlockNoteContent,
    options?: { silent?: boolean },
  ) => void;
  /** 宿主显式选择正文处理方式；本地文件默认 raw，应用页面默认 normalized。 */
  contentMode?: "raw" | "normalized";
  children: ReactNode;
}

export function EditorHostBridge({
  page,
  isEditorFullWidth,
  onContentChangeOverride,
  contentMode = shouldUseRawEditorContent(page) ? "raw" : "normalized",
  children,
}: EditorHostBridgeProps) {
  const theme = useSettings((s) => s.theme);
  const editorFontSize = useSettings((s) => s.editorFontSize);
  const customFonts = useSettings((s) => s.customFonts);
  const defaultCodeBlockWrap = useSettings((s) => s.defaultCodeBlockWrap);
  const setDefaultCodeBlockWrap = useSettings((s) => s.setDefaultCodeBlockWrap);
  const ai = useSettings((s) => s.ai);
  const searchProviders = useSettings((s) => s.searchProviders);
  const customActions = useSettings((s) => s.customActions);
  const singleTabModeSetting = useSettings((s) => s.singleTabMode);
  const openTabs = useTabs((s) => s.openTabs);
  const getPage = usePages((s) => s.getPage);
  const activeNotebookId = useNotebooks((s) => s.activeNotebookId);
  const showLocalFileTitle =
    !effectiveSingleTabMode(singleTabModeSetting) &&
    !shouldEditTitleInTabPill(
      listVisibleWorkspaceTabs(openTabs, getPage, activeNotebookId),
    );

  const settings = useMemo<EditorSettings>(
    () => {
      const notebook = useNotebooks.getState().notebooks[page.workspaceId];
      return {
      theme,
      editorFontSize,
      customFonts,
      defaultCodeBlockWrap,
      onDefaultCodeBlockWrapChange: setDefaultCodeBlockWrap,
      ai,
      searchProviders,
      customActions,
      openLinksInHost: false,
      useInternalImageViewer: false,
      features: {
        tablePresentationControls: true,
        mermaidUnsafeHTML: true,
        // Electron 无 FFmpeg：视频原文件保存，slash 文案走「保存为相对资源」。
        transcodeVideoUploads: false,
        openAttachmentsExternally: true,
        localFolderNotebook: notebook?.source === "local-folder",
      },
      redirectAction: undefined,
    };
    },
    [
      theme,
      editorFontSize,
      customFonts,
      defaultCodeBlockWrap,
      setDefaultCodeBlockWrap,
      ai,
      searchProviders,
      customActions,
      page.workspaceId,
    ],
  );

  const pageContext = useMemo<EditorPageContext>(
    () => ({
      page,
      contentMode,
      isEditorFullWidth,
      onContentChange: (
        content: BlockNoteContent,
        options?: { silent?: boolean },
      ) => {
        if (onContentChangeOverride) {
          onContentChangeOverride(content, options);
          return;
        }
        const pagesStore = usePages.getState();
        const livePage = pagesStore.pages[page.id] ?? page;
        const contentToSave =
          contentMode === "normalized" && effectiveSingleTabMode()
            ? withInternalPageTitle(content, getPageTitle(livePage))
            : content;
        pagesStore.updatePage(
          page.id,
          { content: contentToSave } as Partial<Page>,
          options?.silent ? { silent: true } : undefined,
        );
      },
      onOpenPage: (pageId, wikiTarget, options) => {
        const pagesStore = usePages.getState();
        const resolved = resolvePageMentionNavigation(
          pageId,
          pagesStore.pages,
          useNotebooks.getState().activeNotebookId,
          wikiTarget,
        );
        if (!resolved.ok) {
          toast.error(
            resolved.reason === "trashed" ? "这篇笔记已在回收站" : "找不到这篇笔记",
          );
          return false;
        }
        closeNotebookAiIfFullscreen();
        if (resolved.switchNotebook) {
          pagesStore.setPendingNavigatePageId(resolved.page.id);
          useNotebooks.getState().setActiveNotebook(resolved.page.workspaceId);
        }
        if (!options?.newTab && tryShowPageInFocusedSplit(resolved.page.id)) {
          pagesStore.setExpandPageId(resolved.page.id);
          return true;
        }
        if (options?.splitOnly) return false;
        useTabs.getState().openTab(resolved.page.id);
        pagesStore.setExpandPageId(resolved.page.id);
        return true;
      },
      getActivePageLocalFilePath: () => {
        const livePage = usePages.getState().pages[page.id] ?? page;
        return livePage.localFilePath ?? null;
      },
      getActivePageLocalFolderRoot: () => {
        const livePage = usePages.getState().pages[page.id] ?? page;
        const notebook = useNotebooks.getState().notebooks[livePage.workspaceId];
        return notebook?.source === "local-folder"
          ? (notebook.localPath ?? null)
          : null;
      },
      onOpenAttachment: async (source, fileName) => {
        const livePage = usePages.getState().pages[page.id] ?? page;
        return openResourceExternally({
          source,
          fileName,
          mimeType: /\.html?$/i.test(fileName) ? "text/html" : undefined,
          pageLocalFilePath: livePage.localFilePath ?? null,
          platform: editorPlatform,
          loadInternalResource: async (ref) => {
            if (ref.startsWith("att-file:")) return fileStorage.load(ref);
            return editorPlatform.imageStorage.load(ref);
          },
        });
      },
      searchPages: (query: string) => {
        const { pages } = usePages.getState();
        const { notebooks, activeNotebookId } = useNotebooks.getState();
        const includeFolders =
          (page.workspaceId &&
            notebooks[page.workspaceId]?.source === "local-folder") ||
          (activeNotebookId != null &&
            notebooks[activeNotebookId]?.source === "local-folder");
        return getAiReferenceSuggestionItems(
          query,
          pages,
          notebooks,
          activeNotebookId,
          { includeFolders },
        );
      },
      resolvePageContexts: (refs) => {
        const { pages } = usePages.getState();
        const { notebooks } = useNotebooks.getState();
        return resolveAiReferenceContexts(refs, pages, notebooks);
      },
      getLatestPage: (pageId: string) =>
        usePages.getState().pages[pageId] ?? null,
      onPromotePreview: () => useTabs.getState().promotePreviewTab(),
      showLocalFileTitle,
    }),
    [page, contentMode, isEditorFullWidth, onContentChangeOverride, showLocalFileTitle],
  );

  return (
    <EditorPlatformProvider platform={editorPlatform}>
      <EditorHostProvider settings={settings} pageContext={pageContext}>
        {children}
      </EditorHostProvider>
    </EditorPlatformProvider>
  );
}
