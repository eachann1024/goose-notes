import { useTabs } from "@/stores/useTabs";
import { useSidebarView } from "@/stores/useSidebarView";
import { useEditorSplitSelector } from "@/stores/useEditorSplit";
import { focusedPageIdOf } from "@/lib/editor-split/tree";
import { useEffectiveSidebarCollapsed } from "@/hooks/useWorkspaceViewportCollapse";
import { useWorkspaceViewport } from "@/stores/useWorkspaceViewport";
import {
  resolveSidebarOverlayWidth,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  useSidebarResize,
} from "../hooks/useSidebarResize";
import { useSidebarItemHeight } from "../hooks/useSidebarItemHeight";
import { isElectronHost } from "@/lib/local-vault";
import { type SidebarView, type SidebarProps } from "./shared";

export function useSidebarLayout({
  className,
  disableResize = false,
  selectedPageId,
  scrollContainerRef,
  settingsOpen,
  settingsSidebarExpanded,
  onSettingsSidebarExpandedChange,
  onSettingsOpenChange,
  settingsTab,
  onSettingsTabChange,
  settingsMainHost,
}: SidebarProps) {
  const activePageId = usePages((s) => s.activePageId);

  const createPage = usePages((s) => s.createPage);

  const createLocalPage = usePages((s) => s.createLocalPage);

  const getPage = usePages((s) => s.getPage);

  const setExpandPageId = usePages((s) => s.setExpandPageId);

  const { activeNotebookId, notebooks } = useNotebooks();

  const { openInCurrentTab, activeTabId, openTabs } = useTabs();

  const activeTab = openTabs.find((tab) => tab.id === activeTabId);

  const outlineTarget = useEditorSplitSelector(
    (state) => {
      const split = activeTabId ? state.byTabId[activeTabId] : null;
      const pageId = split
        ? (focusedPageIdOf(split) ?? activePageId)
        : activePageId;
      return {
        pageId,
        paneId: split?.focusedLeafId ?? null,
        focusKey: `${activeTabId ?? ""}:${split?.focusedLeafId ?? pageId ?? ""}`,
      };
    },
    (left, right) =>
      left.pageId === right.pageId &&
      left.paneId === right.paneId &&
      left.focusKey === right.focusKey,
  );

  const outlinePageId =
    selectedPageId === null || activeTab?.type ? null : outlineTarget.pageId;

  const outlinePage = usePages((s) =>
    outlinePageId ? s.pages[outlinePageId] : undefined,
  );

  const setExpanded = useSidebarView((s) => s.setExpanded);

  const workspaceSidebarCollapsed = useEffectiveSidebarCollapsed();

  const sidebarCollapsed = settingsOpen
    ? !settingsSidebarExpanded
    : workspaceSidebarCollapsed;

  const forceCollapseLeft = useWorkspaceViewport((s) => s.forceCollapseLeft);

  const leftExpandOverride = useWorkspaceViewport((s) => s.leftExpandOverride);

  const setLeftExpandOverride = useWorkspaceViewport(
    (s) => s.setLeftExpandOverride,
  );

  const sidebarOverlay =
    forceCollapseLeft &&
    (settingsOpen ? settingsSidebarExpanded : leftExpandOverride) &&
    !sidebarCollapsed;

  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  const sidebarRef = useRef<HTMLDivElement>(null);

  const sidebarModeRailRef = useRef<HTMLElement>(null);

  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;

  const isLocalFolder = activeNotebook?.source === "local-folder";

  // Electron 仅本地模式：没有仓库时不露出「新建页面」入口与内置本语义
  const electronNoVault = isElectronHost && !activeNotebookId;

  const itemHeight = useSidebarItemHeight() + 4;

  const rowHeight = itemHeight + 2;

  const previewSidebarWidth = useCallback(
    (nextWidth: number) => {
      const sidebar = sidebarRef.current;
      sidebar?.style.setProperty(
        "--sidebar-configured-width",
        `${nextWidth}px`,
      );
      const shell = sidebar?.closest(".workspace-shell");
      if (shell instanceof HTMLElement) {
        shell.style.setProperty(
          "--workspace-sidebar-width",
          `${sidebarCollapsed || sidebarOverlay ? 0 : nextWidth}px`,
        );
      }
    },
    [sidebarCollapsed, sidebarOverlay],
  );

  const sidebarMaxWidth = sidebarOverlay
    ? resolveSidebarOverlayWidth(SIDEBAR_MAX_WIDTH, viewportWidth)
    : SIDEBAR_MAX_WIDTH;

  const workspaceResize = useSidebarResize({
    disableResize: disableResize || sidebarCollapsed || settingsOpen,
    onWidthPreview: previewSidebarWidth,
    maxWidth: sidebarMaxWidth,
  });

  const settingsResize = useSidebarResize({
    disableResize: disableResize || sidebarCollapsed || !settingsOpen,
    defaultWidth: SIDEBAR_MIN_WIDTH,
    storageKey: "settings-sidebar-width",
    onWidthPreview: previewSidebarWidth,
    maxWidth: sidebarMaxWidth,
  });

  const {
    width,
    minWidth,
    maxWidth,
    isResizing,
    handleResizePointerDown,
    handleResizeKeyDown,
  } = settingsOpen ? settingsResize : workspaceResize;

  const [currentView, setCurrentView] = useState<SidebarView>("pages");
  return {
    className,
    disableResize,
    selectedPageId,
    scrollContainerRef,
    settingsOpen,
    settingsSidebarExpanded,
    onSettingsSidebarExpandedChange,
    onSettingsOpenChange,
    settingsTab,
    onSettingsTabChange,
    settingsMainHost,
    activePageId,
    createPage,
    createLocalPage,
    getPage,
    setExpandPageId,
    activeNotebookId,
    notebooks,
    openInCurrentTab,
    activeTabId,
    openTabs,
    activeTab,
    outlineTarget,
    outlinePageId,
    outlinePage,
    setExpanded,
    workspaceSidebarCollapsed,
    sidebarCollapsed,
    forceCollapseLeft,
    leftExpandOverride,
    setLeftExpandOverride,
    sidebarOverlay,
    viewportWidth,
    setViewportWidth,
    sidebarRef,
    sidebarModeRailRef,
    activeNotebook,
    isLocalFolder,
    electronNoVault,
    itemHeight,
    rowHeight,
    previewSidebarWidth,
    sidebarMaxWidth,
    workspaceResize,
    settingsResize,
    width,
    minWidth,
    maxWidth,
    isResizing,
    handleResizePointerDown,
    handleResizeKeyDown,
    currentView,
    setCurrentView,
  };
}
