import { useShallow } from "zustand/react/shallow";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { useTabs } from "@/stores/useTabs";
import { useDesktopWindowTitleSync } from "@/hooks/useDesktopWindowTitle";
import { useOptionalEditorPaneRegistry } from "../components/editor-split/editorPaneRegistry";
import { useHistoryView } from "@/stores/useHistoryView";
import {
  isFullscreenAiLayout,
  useNotebookAiPanel,
} from "../components/notebook-ai/useNotebookAiPanel";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { isEffectiveRightSidePanelOpen } from "@/lib/workspaceViewport";
import { useWorkspaceViewportCollapse } from "@/hooks/useWorkspaceViewportCollapse";
import { useWorkspaceViewport } from "@/stores/useWorkspaceViewport";
import { type WorkspaceLayoutProps } from "./shared";

export function useWorkspaceLayoutState({
  isDragging,
  dragIntent,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  editorRef,
  scrollContainerRef,
}: WorkspaceLayoutProps) {
  const { activePageId, getPage, isLocked, isTrashed } = usePages(
    useShallow((s) => {
      const p = s.activePageId ? s.pages[s.activePageId] : undefined;
      return {
        activePageId: s.activePageId,
        getPage: s.getPage,
        isLocked: Boolean(p?.isLocked),
        isTrashed: Boolean(p?.trashedAt),
        // 订进 shallow，否则改字体/图标时本组件不重渲染，顶栏拿到的仍是旧 page
        pageFontFamily: p?.fontFamily ?? "default",
        pageIcon: p?.icon ?? "",
      };
    }),
  );

  const { openTabs, activeTabId, openNewTab } = useTabs(
    useShallow((s) => ({
      openTabs: s.openTabs,
      activeTabId: s.activeTabId,
      openNewTab: s.openNewTab,
    })),
  );

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const isWelcomeTab = activeTab?.type === "welcome";

  const openNewTabHandler = () => {
    openNewTab();
  };

  const aiEnabled = useSettings((s) => s.ai.enabled);

  const {
    isOpen: aiPanelOpen,
    layoutMode: aiLayoutMode,
    setLayoutMode: setAiLayoutMode,
    open: openAiPanel,
    toggle: toggleAiPanel,
    close: closeAiPanel,
    capturedSelection: aiPanelCapturedSelection,
    consumeCapturedSelection: consumeAiPanelCapturedSelection,
  } = useNotebookAiPanel();

  const aiFullscreen = isFullscreenAiLayout(aiLayoutMode);

  const userSideAiPanel = aiEnabled && aiPanelOpen && !aiFullscreen;

  useWorkspaceViewportCollapse();

  const forceCollapseRight = useWorkspaceViewport((s) => s.forceCollapseRight);

  const rightExpandOverride = useWorkspaceViewport(
    (s) => s.rightExpandOverride,
  );

  const showSideAiPanel = isEffectiveRightSidePanelOpen(
    userSideAiPanel,
    forceCollapseRight,
    rightExpandOverride,
  );

  const showFullscreenAi = aiEnabled && aiPanelOpen && aiFullscreen;

  const { activeNotebookId, notebooks } = useNotebooks(
    useShallow((s) => ({
      activeNotebookId: s.activeNotebookId,
      notebooks: s.notebooks,
    })),
  );

  const singleTabModeSetting = useSettings((s) => s.singleTabMode);

  const singleTabMode = effectiveSingleTabMode(singleTabModeSetting);

  const historyActivePageId = useHistoryView((s) => s.active);

  const inHistoryMode =
    !!historyActivePageId && historyActivePageId === activePageId;

  const activeNotebook = activeNotebookId
    ? notebooks[activeNotebookId]
    : undefined;

  const isLocalFolderRepo = activeNotebook?.source === "local-folder";

  const showElectronLocalImportHint =
    __HOST_TARGET__ === "electron" &&
    isLocalFolderRepo &&
    dragIntent === "text-file";

  const page = activePageId ? getPage(activePageId) : undefined;

  const pageNotebook = page ? notebooks[page.workspaceId] : undefined;

  // Electron：订阅 activePage 标题，防抖同步系统窗口 title（Electron 构建内部 no-op）。
  useDesktopWindowTitleSync();

  // 以页面本身是否带本地路径为准（比 notebook.source 更贴合「正文无 H1 标题块」）
  const isLocalFolderPage =
    Boolean(page?.localFilePath) || pageNotebook?.source === "local-folder";

  // Notebook AI 已具备本地文件读取保护、写入失败回滚和本地页面创建通道，
  // 不应再把本地文件夹笔记本静默排除。设置页开启后，所有笔记本统一显示入口。
  const aiAvailableForNotebook = aiEnabled;

  // 全屏 AI 优先用当前笔记本；本地文件夹切页竞态下 activeNotebookId 可能短暂为空，回退到页面所属本。
  const aiNotebookId = activeNotebookId ?? page?.workspaceId ?? null;

  const paneRegistry = useOptionalEditorPaneRegistry();
  return {
    isDragging,
    dragIntent,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    editorRef,
    scrollContainerRef,
    activePageId,
    getPage,
    isLocked,
    isTrashed,
    openTabs,
    activeTabId,
    openNewTab,
    activeTab,
    isWelcomeTab,
    openNewTabHandler,
    aiEnabled,
    aiPanelOpen,
    aiLayoutMode,
    setAiLayoutMode,
    openAiPanel,
    toggleAiPanel,
    closeAiPanel,
    aiPanelCapturedSelection,
    consumeAiPanelCapturedSelection,
    aiFullscreen,
    userSideAiPanel,
    forceCollapseRight,
    rightExpandOverride,
    showSideAiPanel,
    showFullscreenAi,
    activeNotebookId,
    notebooks,
    singleTabModeSetting,
    singleTabMode,
    historyActivePageId,
    inHistoryMode,
    activeNotebook,
    isLocalFolderRepo,
    showElectronLocalImportHint,
    page,
    pageNotebook,
    isLocalFolderPage,
    aiAvailableForNotebook,
    aiNotebookId,
    paneRegistry,
  };
}
