import { type ComponentProps, type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import * as LucideIcons from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useSettings } from "@/stores/useSettings";
import { useTabs } from "@/stores/useTabs";
import { Sidebar } from "./components/sidebar/Sidebar";
import { PageEmptyState } from "./components/page/PageEmptyState";
import { FolderHomePage } from "./components/page/FolderHomePage";
import { PageHeader } from "./components/page/PageHeader";
import { DesktopTitleBar } from "./components/page/DesktopTitleBar";
import { useDesktopWindowTitleSync } from "@/hooks/useDesktopWindowTitle";
import { CommandPalette } from "./components/command/CommandPalette";
import { LocalFolderTargetPicker } from "./components/sidebar/LocalFolderTargetPicker";
import { AIFeatureNotice } from "./components/AIFeatureNotice";
import { type EditorRef } from "@/components/editor/core/Editor";
import { locateAndHighlight } from "@/components/editor/find/searchHighlightLocate";
import { EditorSplitSurface } from "./components/editor-split/EditorSplitSurface";
import { SplitEditorPane } from "./components/editor-split/SplitEditorPane";
import { useOptionalEditorPaneRegistry } from "./components/editor-split/editorPaneRegistry";
import {
  countLeaves,
  focusedPageIdOf,
  isSplitState,
} from "@/lib/editor-split/tree";
import { useEditorSplit, useEditorSplitSelector } from "@/stores/useEditorSplit";
import {
  HistoryToolbar,
  HistoryReader,
} from "./components/history/HistoryView";
import { useHistoryView } from "@/stores/useHistoryView";
import {
  permanentlyDeletePageWithCleanup,
  restorePageWithToast,
} from "@/lib/page-delete-actions";
import { NotebookAiPanel } from "./components/notebook-ai/NotebookAiPanel";
import { NotebookAiHostScope } from "./components/notebook-ai/NotebookAiHostScope";
import { NotebookAiSessionProvider } from "./components/notebook-ai/NotebookAiSession";
import {
  isFullscreenAiLayout,
  useNotebookAiPanel,
} from "./components/notebook-ai/useNotebookAiPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { subscribePageTitleFocus } from "@/lib/page-title-focus";
import { isElectronRuntime } from "@/lib/electron/runtime";
import { effectiveSingleTabMode } from "@/lib/tabMode";

// Electron 桌面端 chrome：全宽 overlay 顶栏挂在 .workspace-shell 顶部（覆盖侧栏+主区），
// 主区内不再重复渲染 PageHeader/HistoryToolbar。Electron 构建保持现状，一行不挪。
const isElectronChrome = isElectronRuntime();

function GuardedNotebookAiPanel(props: ComponentProps<typeof NotebookAiPanel>) {
  return (
    <ErrorBoundary
      resetKey={props.notebookId}
      fallback={(_, reset) => (
        <div className="flex min-h-[260px] min-w-[240px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
          <p>AI 面板渲染失败，已阻止整窗白屏。</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]"
          >
            重试
          </button>
        </div>
      )}
    >
      <NotebookAiPanel {...props} />
    </ErrorBoundary>
  );
}

interface WorkspaceLayoutProps {
  isDragging: boolean;
  dragIntent: "folder" | "text-file" | "file";
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => Promise<void>;
  editorRef: RefObject<EditorRef | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

export function WorkspaceLayout({
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
  const showSideAiPanel =
    aiEnabled && aiPanelOpen && !aiFullscreen;
  const showFullscreenAi =
    aiEnabled && aiPanelOpen && aiFullscreen;
  const searchHighlightNonce = usePages((s) => s.searchHighlightNonce);
  const searchHighlightQuery = usePages((s) => s.searchHighlightQuery);
  const searchHighlightPageId = usePages((s) => s.searchHighlightPageId);
  const handledSearchHighlightNonce = usePages(
    (s) => s.handledSearchHighlightNonce,
  );
  const setHandledSearchHighlightNonce = usePages(
    (s) => s.setHandledSearchHighlightNonce,
  );
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

  // 全局搜索「跳转即定位」：监听搜索高亮信号，落到匹配块并展开折叠 + 高亮。
  // 信号由命令面板写入（只带 query，不带 blockId），见 searchHighlightLocate.ts。
  //
  // 关键：点搜索结果时「切页」是异步的，nonce 信号到达那一刻 activePageId 往往还没追上
  // 目标页。所以本 effect 不能只依赖 nonce，否则首跑被 pageId 守卫挡掉后永不重试。
  // 改为：依赖 activePageId/page 一并参与，用 handledSearchHighlightNonce 做幂等去重，
  // 等切页落定、目标页 editor ready 后自然会再跑一次并完成定位。
  const locateRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mod+J 快捷键（useAppHotkeys 派发）→ 开关 AI 面板，与 UI 按钮门控一致：未启用 AI 时不响应
  useEffect(() => {
    const onToggle = () => {
      if (!aiAvailableForNotebook) return;
      toggleAiPanel();
      // 由关闭切到打开时，面板若是首次挂载会自行聚焦；已挂载（如布局切换场景）则补发聚焦事件
      if (!aiPanelOpen) {
        window.dispatchEvent(new CustomEvent("goose-note:focus-ai-composer"));
      }
    };
    window.addEventListener("goose-note:toggle-ai-panel", onToggle);
    return () =>
      window.removeEventListener("goose-note:toggle-ai-panel", onToggle);
  }, [aiAvailableForNotebook, aiPanelOpen, toggleAiPanel]);

  // 极简工作区的新建页会直接进入标题编辑。若此时 AI 正以全屏覆盖主区域，
  // 必须同步退出 AI，否则只会看到页头标题框，正文仍错误地停留在 AI 会话。
  useEffect(
    () =>
      subscribePageTitleFocus(() => {
        if (aiPanelOpen && isFullscreenAiLayout(aiLayoutMode)) {
          closeAiPanel();
        }
      }),
    [aiLayoutMode, aiPanelOpen, closeAiPanel],
  );

  // 编辑器内的显式面板事件统一走此入口。
  // 使用 open 而非 toggle，重复触发不会把已经打开的面板关掉。
  useEffect(() => {
    const onOpen = (event: Event) => {
      if (!aiAvailableForNotebook) return;
      const detail = (event as CustomEvent<unknown>).detail;
      const record =
        detail && typeof detail === "object"
          ? (detail as Record<string, unknown>)
          : null;
      if (record?.layout === "side-panel") {
        setAiLayoutMode("side-panel");
      }
      const capture =
        record &&
        record.version === 1 &&
        typeof record.pageId === "string" &&
        Boolean(record.selection)
          ? (detail as Parameters<typeof openAiPanel>[0])
          : null;
      openAiPanel(capture);
      // 面板已打开时重复触发「打开」不会重挂载，补发聚焦事件让输入框重新获焦；
      // 首次挂载时面板自身会聚焦，此事件无害。
      window.dispatchEvent(new CustomEvent("goose-note:focus-ai-composer"));
    };
    window.addEventListener("goose-note:open-ai-panel", onOpen);
    return () => window.removeEventListener("goose-note:open-ai-panel", onOpen);
  }, [aiAvailableForNotebook, openAiPanel, setAiLayoutMode]);

  // AI 功能不可用时强制收起侧栏面板，避免 localStorage 仍为 true 导致下次误展开
  useEffect(() => {
    if (!aiAvailableForNotebook) closeAiPanel();
  }, [aiAvailableForNotebook, closeAiPanel]);

  const paneRegistry = useOptionalEditorPaneRegistry();
  const splitLeafCount = useEditorSplitSelector(
    (state) => {
      if (!activeTabId) return 0;
      const split = state.byTabId[activeTabId];
      return split ? countLeaves(split.root) : 0;
    },
    Object.is,
  );

  // 全屏打开后再给编辑区打 inert，避开点击帧对 BlockNote 大树做无障碍更新
  useEffect(() => {
    const fromPanes = paneRegistry?.getScrollElements() ?? [];
    const fallback = scrollContainerRef.current;
    const targets =
      fromPanes.length > 0 ? fromPanes : fallback ? [fallback] : [];
    if (targets.length === 0) return;
    if (!showFullscreenAi) {
      for (const el of targets) {
        el.inert = false;
        el.classList.remove("invisible");
      }
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      for (const el of targets) {
        el.inert = true;
        el.classList.add("invisible");
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      for (const el of targets) {
        el.inert = false;
        el.classList.remove("invisible");
      }
    };
  }, [showFullscreenAi, scrollContainerRef, paneRegistry, splitLeafCount]);

  useEffect(() => {
    if (locateRetryRef.current) {
      clearTimeout(locateRetryRef.current);
      locateRetryRef.current = null;
    }
    if (!searchHighlightNonce || searchHighlightNonce <= 0) return;
    // 这个 nonce 已经处理过了，跳过（幂等，避免重复定位/重复高亮）
    if (searchHighlightNonce === handledSearchHighlightNonce) return;
    if (!searchHighlightQuery) return;
    // 信号指向的页面还没成为当前活动页 → 等切页完成后本 effect 会因 activePageId
    // 变化再次运行，那时再继续。不在这里标记 handled，留待真正定位成功。
    if (!searchHighlightPageId || searchHighlightPageId !== activePageId)
      return;
    if (inHistoryMode || !page) return;

    const nonceToHandle = searchHighlightNonce;
    const query = searchHighlightQuery;
    let attempts = 0;
    const tryLocate = () => {
      const editor = editorRef.current?.editor;
      if (editor) {
        locateAndHighlight(editor, query);
        setHandledSearchHighlightNonce(nonceToHandle);
        locateRetryRef.current = null;
        return;
      }
      // 切页后编辑器可能还没挂载/换内容，短轮询等待 ready（上限约 1.5s）
      if (attempts++ < 30) {
        locateRetryRef.current = setTimeout(tryLocate, 50);
      }
    };
    // 首次延一帧，让切页的 replaceBlocks 先把目标页内容铺好
    locateRetryRef.current = setTimeout(tryLocate, 60);

    return () => {
      if (locateRetryRef.current) {
        clearTimeout(locateRetryRef.current);
        locateRetryRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchHighlightNonce, activePageId, page]);

  return (
    <>
      <div
        className="workspace-shell window-shell-safe-top flex overflow-hidden bg-background text-foreground"
        data-electron-chrome={isElectronChrome || undefined}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isElectronChrome && (
          <DesktopTitleBar
            page={page}
            isWelcomeTab={isWelcomeTab}
            inHistoryMode={inHistoryMode}
            onOpenSearch={() => {
              if (showFullscreenAi) closeAiPanel();
              openNewTab();
            }}
            onBeforeActivateTab={
              showFullscreenAi ? closeAiPanel : undefined
            }
            onRestore={
              activePageId ? () => restorePageWithToast(activePageId) : undefined
            }
            onDelete={
              activePageId
                ? () => void permanentlyDeletePageWithCleanup(activePageId)
                : undefined
            }
            aiPanelOpen={aiAvailableForNotebook && aiPanelOpen}
            aiLayoutMode={aiLayoutMode}
            onToggleAiPanel={
              aiAvailableForNotebook ? toggleAiPanel : undefined
            }
          />
        )}
        {isDragging && (
          <div className="fixed inset-0 z-[25000] flex items-center justify-center bg-[hsl(var(--goose-editor-bg)/0.96)] animate-in fade-in duration-150">
            <div className="flex min-h-[188px] min-w-[312px] flex-col items-center justify-center rounded-[14px] border border-border/70 bg-[hsl(var(--goose-shell-bg)/0.98)] px-10 py-8 text-center shadow-[0_18px_42px_rgba(15,23,42,0.12),0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/10 dark:shadow-[0_18px_42px_rgba(0,0,0,0.32)]">
              {dragIntent === "folder" ? (
                <LucideIcons.FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/80" />
              ) : dragIntent === "text-file" ? (
                <LucideIcons.FileText className="mb-4 h-12 w-12 text-muted-foreground/80" />
              ) : (
                <LucideIcons.FileQuestion className="mb-4 h-12 w-12 text-muted-foreground/70" />
              )}
              <p className="text-base font-medium text-foreground">
                {dragIntent === "folder"
                  ? "松手打开文件夹"
                  : dragIntent === "text-file"
                    ? showElectronLocalImportHint
                      ? "松开以导入到当前文件夹 · 按住 ⌥ 选择位置"
                      : "松手导入文本文件"
                    : "松手后检查文件"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {dragIntent === "folder"
                  ? "会作为本地文件夹记事本载入"
                  : "支持 .md、.markdown、.txt"}
              </p>
            </div>
          </div>
        )}
        <CommandPalette />
        <LocalFolderTargetPicker />
        <AIFeatureNotice />
        <div className="workspace-stage">
          <Sidebar
            className="workspace-sidebar-pane"
            disableResize={false}
            // 全屏 AI 时取消侧栏高亮：用户再点页面会触发选中并切回该标签
            selectedPageId={showFullscreenAi ? null : activePageId}
            editorRef={editorRef}
            scrollContainerRef={scrollContainerRef}
          />

          <main
            className="workspace-main-sheet relative flex-1 flex flex-col h-full overflow-hidden"
            data-single-tab-mode={singleTabMode ? "true" : undefined}
            data-local-file-page={isLocalFolderPage ? "true" : undefined}
          >
            {/*
              会话运行时与面板 UI 解耦：Provider 在 AI 可用时常驻，
              关面板 / 切页不卸载 useChat，顶栏动画可跟到请求真正结束。
            */}
            {aiAvailableForNotebook && aiNotebookId ? (
              <NotebookAiSessionProvider
                key={aiNotebookId}
                notebookId={aiNotebookId}
                editorRef={editorRef}
              >
                <NotebookAiWorkspaceBody
                  showFullscreenAi={showFullscreenAi}
                  aiNotebookId={aiNotebookId}
                  aiAvailableForNotebook={aiAvailableForNotebook}
                  isWelcomeTab={isWelcomeTab}
                  openNewTabHandler={openNewTabHandler}
                  aiPanelOpen={aiPanelOpen}
                  aiLayoutMode={aiLayoutMode}
                  toggleAiPanel={toggleAiPanel}
                  showSideAiPanel={showSideAiPanel}
                  closeAiPanel={closeAiPanel}
                  editorRef={editorRef}
                  aiPanelCapturedSelection={aiPanelCapturedSelection}
                  consumeAiPanelCapturedSelection={
                    consumeAiPanelCapturedSelection
                  }
                  setAiLayoutMode={setAiLayoutMode}
                  activePageId={activePageId}
                  page={page}
                  inHistoryMode={inHistoryMode}
                  isLocalFolderPage={isLocalFolderPage}
                  isLocked={isLocked}
                  isTrashed={isTrashed}
                  scrollContainerRef={scrollContainerRef}
                />
              </NotebookAiSessionProvider>
            ) : (
              <NotebookAiWorkspaceBody
                showFullscreenAi={false}
                aiNotebookId={null}
                aiAvailableForNotebook={false}
                isWelcomeTab={isWelcomeTab}
                openNewTabHandler={openNewTabHandler}
                aiPanelOpen={false}
                aiLayoutMode={aiLayoutMode}
                toggleAiPanel={toggleAiPanel}
                showSideAiPanel={false}
                closeAiPanel={closeAiPanel}
                editorRef={editorRef}
                aiPanelCapturedSelection={null}
                consumeAiPanelCapturedSelection={
                  consumeAiPanelCapturedSelection
                }
                setAiLayoutMode={setAiLayoutMode}
                activePageId={activePageId}
                page={page}
                inHistoryMode={inHistoryMode}
                isLocalFolderPage={isLocalFolderPage}
                isLocked={isLocked}
                isTrashed={isTrashed}
                scrollContainerRef={scrollContainerRef}
              />
            )}
          </main>
        </div>
      </div>
    </>
  );
}

function NotebookEditorSplitColumn({
  page,
  activePageId,
  isLocalFolderPage,
  handleOpenSearch,
  handleBeforeActivateTab,
  aiAvailableForNotebook,
  aiPanelOpen,
  aiLayoutMode,
  toggleAiPanel,
  showSideAiPanel,
  aiNotebookId,
  editorRef,
  aiPanelCapturedSelection,
  consumeAiPanelCapturedSelection,
  setAiLayoutMode,
  closeAiPanel,
}: {
  page: NonNullable<ReturnType<typeof usePages.getState>["pages"][string]>;
  activePageId: string;
  isLocalFolderPage: boolean;
  handleOpenSearch: () => void;
  handleBeforeActivateTab?: () => void;
  aiAvailableForNotebook: boolean;
  aiPanelOpen: boolean;
  aiLayoutMode: ReturnType<typeof useNotebookAiPanel>["layoutMode"];
  toggleAiPanel: () => void;
  showSideAiPanel: boolean;
  aiNotebookId: string | null;
  editorRef: RefObject<EditorRef | null>;
  aiPanelCapturedSelection: ReturnType<
    typeof useNotebookAiPanel
  >["capturedSelection"];
  consumeAiPanelCapturedSelection: () => void;
  setAiLayoutMode: ReturnType<typeof useNotebookAiPanel>["setLayoutMode"];
  closeAiPanel: () => void;
}) {
  const { activeTabId } = useTabs(
    useShallow((s) => ({ activeTabId: s.activeTabId })),
  );
  const splitState = useEditorSplitSelector(
    (state) => (activeTabId ? (state.byTabId[activeTabId] ?? null) : null),
    Object.is,
  );
  const isSplit = splitState ? isSplitState(splitState) : false;
  const focusedPageId = splitState ? focusedPageIdOf(splitState) : null;

  useLayoutEffect(() => {
    if (!activeTabId || !activePageId) return;
    useEditorSplit.getState().ensureTab(activeTabId, activePageId);
  }, [activeTabId, activePageId]);

  useLayoutEffect(() => {
    if (!activeTabId || !focusedPageId) return;
    if (focusedPageId !== usePages.getState().activePageId) {
      void usePages.getState().setActivePage(focusedPageId);
    }
    useTabs.getState().syncTabPageId(activeTabId, focusedPageId);
  }, [activeTabId, focusedPageId]);

  if (!activeTabId) return null;

  return (
    <div
      className="workspace-editor-surface relative ml-0 mt-0 flex min-h-0 flex-1 flex-row gap-2 overflow-hidden !bg-[hsl(var(--goose-shell-bg))]"
      data-font-family={page.fontFamily ?? "default"}
      data-local-file-page={isLocalFolderPage ? "true" : undefined}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          !isSplit &&
            "rounded-[12px] bg-[hsl(var(--goose-editor-bg))]",
        )}
        data-editor-split-column=""
        data-editor-split={isSplit ? "true" : undefined}
      >
        {!isElectronChrome && (
          <PageHeader
            page={page}
            onOpenSearch={handleOpenSearch}
            onBeforeActivateTab={handleBeforeActivateTab}
            onRestore={() => restorePageWithToast(activePageId)}
            onDelete={() => void permanentlyDeletePageWithCleanup(activePageId)}
            aiPanelOpen={aiAvailableForNotebook && aiPanelOpen}
            aiLayoutMode={aiLayoutMode}
            onToggleAiPanel={
              aiAvailableForNotebook ? toggleAiPanel : undefined
            }
            hideDocumentTitle={isSplit}
          />
        )}
        <div className="min-h-0 flex-1">
          <EditorSplitSurface
            tabId={activeTabId}
            renderPane={(leaf, { focused }) => (
              <SplitEditorPane
                leaf={leaf}
                focused={focused}
                showChrome={isSplit}
              />
            )}
          />
        </div>
      </div>
      {showSideAiPanel && aiNotebookId ? (
        <NotebookAiHostScope notebookId={aiNotebookId}>
          <GuardedNotebookAiPanel
            key={aiNotebookId}
            notebookId={aiNotebookId}
            onClose={closeAiPanel}
            editorRef={editorRef}
            capturedSelection={aiPanelCapturedSelection}
            onConsumeCapturedSelection={consumeAiPanelCapturedSelection}
            layoutMode={aiLayoutMode}
            onLayoutModeChange={setAiLayoutMode}
            variant="side-panel"
          />
        </NotebookAiHostScope>
      ) : null}
    </div>
  );
}

/** 主内容区 + 条件挂载的 AI 面板 UI（运行时在外层 Provider）。 */
function NotebookAiWorkspaceBody({
  showFullscreenAi,
  aiNotebookId,
  aiAvailableForNotebook,
  isWelcomeTab,
  openNewTabHandler,
  aiPanelOpen,
  aiLayoutMode,
  toggleAiPanel,
  showSideAiPanel,
  closeAiPanel,
  editorRef,
  aiPanelCapturedSelection,
  consumeAiPanelCapturedSelection,
  setAiLayoutMode,
  activePageId,
  page,
  inHistoryMode,
  isLocalFolderPage,
  isLocked: _isLocked,
  isTrashed: _isTrashed,
  scrollContainerRef: _scrollContainerRef,
}: {
  showFullscreenAi: boolean;
  aiNotebookId: string | null;
  aiAvailableForNotebook: boolean;
  isWelcomeTab: boolean;
  openNewTabHandler: () => void;
  aiPanelOpen: boolean;
  aiLayoutMode: ReturnType<typeof useNotebookAiPanel>["layoutMode"];
  toggleAiPanel: () => void;
  showSideAiPanel: boolean;
  closeAiPanel: () => void;
  editorRef: RefObject<EditorRef | null>;
  aiPanelCapturedSelection: ReturnType<
    typeof useNotebookAiPanel
  >["capturedSelection"];
  consumeAiPanelCapturedSelection: () => void;
  setAiLayoutMode: ReturnType<typeof useNotebookAiPanel>["setLayoutMode"];
  activePageId: string | null | undefined;
  page: ReturnType<typeof usePages.getState>["pages"][string] | undefined;
  inHistoryMode: boolean;
  isLocalFolderPage: boolean;
  isLocked: boolean;
  isTrashed: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const handleOpenSearch = showFullscreenAi
    ? () => {
        closeAiPanel();
        openNewTabHandler();
      }
    : openNewTabHandler;
  const handleBeforeActivateTab = showFullscreenAi ? closeAiPanel : undefined;
  const hideFolderHome =
    isElectronChrome && Boolean(page?.isFolder) && isLocalFolderPage;

  return (
    <>
            {/*
              全屏 AI 叠在页头下方，不重挂页头。正文 invisible/inert 推迟到下一帧，
              避免点击帧对 BlockNote 大树做 visibility 强制布局。
            */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {isWelcomeTab ? (
                <>
                  {!isElectronChrome && (
                    <PageHeader
                      onOpenSearch={handleOpenSearch}
                      onBeforeActivateTab={handleBeforeActivateTab}
                      aiPanelOpen={aiAvailableForNotebook && aiPanelOpen}
                      aiLayoutMode={aiLayoutMode}
                      onToggleAiPanel={
                        aiAvailableForNotebook ? toggleAiPanel : undefined
                      }
                    />
                  )}
                  <div className="relative ml-0 mt-0 flex min-h-0 flex-1 flex-row gap-2 overflow-hidden !bg-[hsl(var(--goose-shell-bg))]">
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-[hsl(var(--goose-editor-bg))]",
                      )}
                    >
                      <PageEmptyState />
                    </div>
                    {showSideAiPanel && aiNotebookId ? (
                      <NotebookAiHostScope notebookId={aiNotebookId}>
                        <GuardedNotebookAiPanel
                          key={`welcome-${aiNotebookId}`}
                          notebookId={aiNotebookId}
                          onClose={closeAiPanel}
                          editorRef={editorRef}
                          capturedSelection={aiPanelCapturedSelection}
                          onConsumeCapturedSelection={
                            consumeAiPanelCapturedSelection
                          }
                          layoutMode={aiLayoutMode}
                          onLayoutModeChange={setAiLayoutMode}
                          variant="side-panel"
                        />
                      </NotebookAiHostScope>
                    ) : null}
                  </div>
                </>
              ) : activePageId && page && inHistoryMode ? (
                <>
                  {!isElectronChrome && <HistoryToolbar />}
                  <div className="workspace-editor-surface relative ml-0 mt-0 flex-1 min-h-0 overflow-hidden">
                    <div
                      className={cn(
                        "h-full overflow-y-auto page-scroll-container bg-[hsl(var(--goose-editor-bg))]",
                      )}
                    >
                      <div className="flex min-h-full flex-col px-14 pt-0">
                        <HistoryReader />
                      </div>
                    </div>
                  </div>
                </>
              ) : activePageId && page && !hideFolderHome ? (
                page.isFolder && isLocalFolderPage ? (
                  /* Electron 本地文件夹目录页：主区渲染 FolderHomePage，不挂编辑器 */
                  <>
                    <div className="workspace-editor-surface relative ml-0 mt-0 flex min-h-0 flex-1 flex-row gap-2 overflow-hidden !bg-[hsl(var(--goose-shell-bg))]">
                      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-[hsl(var(--goose-editor-bg))]">
                        {!isElectronChrome && (
                          <PageHeader
                            page={page}
                            onOpenSearch={handleOpenSearch}
                            onBeforeActivateTab={handleBeforeActivateTab}
                            onRestore={() => restorePageWithToast(activePageId)}
                            onDelete={() =>
                              void permanentlyDeletePageWithCleanup(activePageId)
                            }
                            aiPanelOpen={aiAvailableForNotebook && aiPanelOpen}
                            aiLayoutMode={aiLayoutMode}
                            onToggleAiPanel={
                              aiAvailableForNotebook ? toggleAiPanel : undefined
                            }
                          />
                        )}
                        <FolderHomePage page={page} />
                      </div>
                      {showSideAiPanel && aiNotebookId ? (
                        <NotebookAiHostScope notebookId={aiNotebookId}>
                          <GuardedNotebookAiPanel
                            key={`folder-${aiNotebookId}`}
                            notebookId={aiNotebookId}
                            onClose={closeAiPanel}
                            editorRef={editorRef}
                            capturedSelection={aiPanelCapturedSelection}
                            onConsumeCapturedSelection={
                              consumeAiPanelCapturedSelection
                            }
                            layoutMode={aiLayoutMode}
                            onLayoutModeChange={setAiLayoutMode}
                            variant="side-panel"
                          />
                        </NotebookAiHostScope>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <NotebookEditorSplitColumn
                    page={page}
                    activePageId={activePageId}
                    isLocalFolderPage={isLocalFolderPage}
                    handleOpenSearch={handleOpenSearch}
                    handleBeforeActivateTab={handleBeforeActivateTab}
                    aiAvailableForNotebook={aiAvailableForNotebook}
                    aiPanelOpen={aiPanelOpen}
                    aiLayoutMode={aiLayoutMode}
                    toggleAiPanel={toggleAiPanel}
                    showSideAiPanel={showSideAiPanel}
                    aiNotebookId={aiNotebookId}
                    editorRef={editorRef}
                    aiPanelCapturedSelection={aiPanelCapturedSelection}
                    consumeAiPanelCapturedSelection={
                      consumeAiPanelCapturedSelection
                    }
                    setAiLayoutMode={setAiLayoutMode}
                    closeAiPanel={closeAiPanel}
                  />
                )
              ) : (
                <PageEmptyState />
              )}
            </div>

            {showFullscreenAi && aiNotebookId && aiAvailableForNotebook ? (
              <div className="notebook-ai-fullscreen-host absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden bg-[hsl(var(--goose-shell-bg))]">
                <NotebookAiHostScope notebookId={aiNotebookId}>
                  <GuardedNotebookAiPanel
                    key={`fullscreen-${aiNotebookId}`}
                    notebookId={aiNotebookId}
                    onClose={closeAiPanel}
                    editorRef={editorRef}
                    capturedSelection={aiPanelCapturedSelection}
                    onConsumeCapturedSelection={
                      consumeAiPanelCapturedSelection
                    }
                    layoutMode={aiLayoutMode}
                    onLayoutModeChange={setAiLayoutMode}
                    variant="fullscreen"
                  />
                </NotebookAiHostScope>
              </div>
            ) : null}
    </>
  );
}
