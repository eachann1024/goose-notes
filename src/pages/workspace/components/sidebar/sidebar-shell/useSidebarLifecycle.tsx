import { useSidebarView } from "@/stores/useSidebarView";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { useSearchSession } from "../useSearchSession";
import { closeNotebookAiIfFullscreen } from "../../notebook-ai/useNotebookAiPanel";
import { activateWorkspace } from "@/lib/settings-navigation";
import { type SidebarView } from "./shared";
import type { useSidebarNavigation } from "./useSidebarNavigation";

export function useSidebarLifecycle(
  input: ReturnType<typeof useSidebarNavigation>,
) {
  const {
    selectedPageId,
    scrollContainerRef,
    activePageId,
    createPage,
    createLocalPage,
    getPage,
    setExpandPageId,
    activeNotebookId,
    openInCurrentTab,
    outlinePage,
    workspaceSidebarCollapsed,
    sidebarCollapsed,
    forceCollapseLeft,
    setLeftExpandOverride,
    sidebarOverlay,
    setViewportWidth,
    sidebarRef,
    isLocalFolder,
    electronNoVault,
    previewSidebarWidth,
    width,
    currentView,
    setCurrentView,
    openSearchSession,
    exitHistoryView,
    inHistoryMode,
    restoreSidebarFocusRef,
    scrollAreaNode,
    setScrollAreaHeight,
  } = input;

  const previousNotebookIdRef = useRef<string | null | undefined>(undefined);

  const resetSidebarAfterNotebookChange = useCallback(
    (options: { exitHistory: boolean }) => {
      setCurrentView("pages");
      if (options.exitHistory) exitHistoryView();
    },
    [exitHistoryView],
  );

  useEffect(() => {
    const previousNotebookId = previousNotebookIdRef.current;
    previousNotebookIdRef.current = activeNotebookId;
    if (previousNotebookId === activeNotebookId) return;
    if (previousNotebookId === undefined && !isLocalFolder) return;
    if (useSearchSession.getState().open) return;

    resetSidebarAfterNotebookChange({
      exitHistory: inHistoryMode,
    });
  }, [
    activeNotebookId,
    inHistoryMode,
    isLocalFolder,
    resetSidebarAfterNotebookChange,
  ]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const stage = sidebarRef.current?.closest(".workspace-stage");
    root.toggleAttribute("data-sidebar-collapsed", sidebarCollapsed);
    sidebarRef.current?.toggleAttribute("data-sidebar-overlay", sidebarOverlay);
    if (stage instanceof HTMLElement) {
      stage.toggleAttribute("data-sidebar-collapsed", sidebarCollapsed);
      stage.toggleAttribute("data-sidebar-overlay", sidebarOverlay);
    }
    return () => {
      root.removeAttribute("data-sidebar-collapsed");
      sidebarRef.current?.removeAttribute("data-sidebar-overlay");
      if (stage instanceof HTMLElement) {
        stage.removeAttribute("data-sidebar-collapsed");
        stage.removeAttribute("data-sidebar-overlay");
      }
    };
  }, [sidebarCollapsed, sidebarOverlay]);

  useLayoutEffect(() => {
    previewSidebarWidth(width);
  }, [previewSidebarWidth, width]);

  useLayoutEffect(() => {
    if (sidebarOverlay || !restoreSidebarFocusRef.current) return;
    restoreSidebarFocusRef.current = false;
    sidebarRef.current
      ?.closest(".workspace-shell")
      ?.querySelector<HTMLButtonElement>('button[aria-label="展开侧栏"]')
      ?.focus({ preventScroll: true });
  }, [sidebarOverlay]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setViewportWidth(window.innerWidth);
    });
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!scrollAreaNode) {
      setScrollAreaHeight(0);
      return;
    }
    let lastHeight = -1;
    const updateHeight = () => {
      const height = scrollAreaNode.clientHeight;
      if (height === lastHeight) return;
      lastHeight = height;
      setScrollAreaHeight(height);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(scrollAreaNode);
    return () => observer.disconnect();
  }, [scrollAreaNode]);

  const handleCreatePage = () => {
    if (!activeNotebookId) return;
    activateWorkspace();
    closeNotebookAiIfFullscreen();
    // 在当前所处页面的同级创建：取当前页的 parentId 作为新页的父级
    const basePageId = selectedPageId ?? activePageId;
    const basePage = basePageId ? getPage(basePageId) : undefined;
    const siblingParentId =
      basePage && basePage.workspaceId === activeNotebookId
        ? basePage.parentId
        : undefined;
    if (isLocalFolder) {
      void Promise.resolve(
        createLocalPage(siblingParentId, activeNotebookId),
      ).then((newPageId) => {
        if (newPageId) openInCurrentTab(newPageId);
      });
      return;
    }
    const newPageId = createPage(siblingParentId, activeNotebookId);
    openInCurrentTab(newPageId);
    // 新页若落在折叠的父级下，展开祖先并聚焦使其可见
    if (siblingParentId) setExpandPageId(newPageId);
  };

  const handleOpenSearch = () => {
    activateWorkspace();
    setCurrentView("search");
    if (workspaceSidebarCollapsed && !forceCollapseLeft)
      useSidebarView.getState().setSidebarCollapsed(false);
    if (forceCollapseLeft) setLeftExpandOverride(true);
    if (inHistoryMode) exitHistoryView();
    closeNotebookAiIfFullscreen();
    openSearchSession(
      activeNotebookId,
      activePageId,
      scrollContainerRef?.current?.scrollTop ?? 0,
    );
  };

  const switchSidebarView = (view: SidebarView) => {
    activateWorkspace();
    if (forceCollapseLeft) setLeftExpandOverride(true);
    if (inHistoryMode) exitHistoryView();
    if (view !== "search") useSearchSession.getState().closeSearch();
    if (view === "outline") closeNotebookAiIfFullscreen();
    setCurrentView(view);
  };

  const headerTitle =
    currentView === "search"
      ? "搜索"
      : currentView === "outline"
        ? outlinePage
          ? getPageTitle(outlinePage)
          : "大纲"
        : isLocalFolder
          ? "本地"
          : electronNoVault
            ? "仓库"
            : "页面";
  return {
    ...input,
    previousNotebookIdRef,
    resetSidebarAfterNotebookChange,
    handleCreatePage,
    handleOpenSearch,
    switchSidebarView,
    headerTitle,
  };
}
