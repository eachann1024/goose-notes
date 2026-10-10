import { useSidebarView } from "@/stores/useSidebarView";
import { useSidebarEffects } from "../hooks/useSidebarEffects";
import { shouldDismissSidebarOverlay } from "../sidebarOverlayEscape";
import { useSearchSession } from "../useSearchSession";
import { useHistoryView } from "@/stores/useHistoryView";
import { closeNotebookAiIfFullscreen } from "../../notebook-ai/useNotebookAiPanel";
import { activateWorkspace } from "@/lib/settings-navigation";
import { type SidebarView } from "./shared";
import type { useSidebarLayout } from "./useSidebarLayout";

export function useSidebarNavigation(
  input: ReturnType<typeof useSidebarLayout>,
) {
  const {
    scrollContainerRef,
    settingsOpen,
    onSettingsSidebarExpandedChange,
    onSettingsOpenChange,
    onSettingsTabChange,
    activePageId,
    activeNotebookId,
    workspaceSidebarCollapsed,
    forceCollapseLeft,
    setLeftExpandOverride,
    sidebarOverlay,
    sidebarRef,
    sidebarModeRailRef,
    currentView,
    setCurrentView,
  } = input;

  const [settingsSidebarHost, setSettingsSidebarHost] =
    useState<HTMLDivElement | null>(null);

  const searchSessionOpen = useSearchSession((state) => state.open);

  useEffect(() => {
    if (searchSessionOpen) setCurrentView("search");
    else if (currentView === "search") setCurrentView("pages");
  }, [searchSessionOpen, currentView]);

  useLayoutEffect(() => {
    const rail = sidebarModeRailRef.current;
    if (!rail?.contains(document.activeElement)) return;
    // 焦点已在窄栏内时跟随当前视图，保留编辑器或搜索框里的焦点。
    rail
      .querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.focus({ preventScroll: true });
  }, [currentView, settingsOpen]);

  const openSearchSession = useSearchSession((s) => s.openSearch);

  const searchShortcut = useSettings((state) =>
    state.appShortcuts.openSearch
      ? formatShortcut(state.appShortcuts.openSearch)
      : "",
  );

  const sidebarViewShortcut = (digit: 1 | 2 | 3) =>
    formatShortcut(`Mod+${digit}`);

  // 历史模式暂时隐藏窄轨和页面树，但保留当前模式与 Footer；退出后回到原侧栏状态。
  const historyActivePageId = useHistoryView((s) => s.active);

  const exitHistoryView = useHistoryView((s) => s.exit);

  const inHistoryMode =
    !!historyActivePageId && historyActivePageId === activePageId;

  const restoreSidebarFocusRef = useRef(false);

  const [scrollAreaNode, setScrollAreaNode] = useState<HTMLDivElement | null>(
    null,
  );

  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);

  const closeSidebarOverlay = useCallback(() => {
    const active = document.activeElement;
    restoreSidebarFocusRef.current =
      !!active &&
      (!!sidebarRef.current?.contains(active) ||
        active === sidebarRef.current?.previousElementSibling);
    if (settingsOpen) onSettingsSidebarExpandedChange(false);
    else setLeftExpandOverride(false);
  }, [settingsOpen, onSettingsSidebarExpandedChange, setLeftExpandOverride]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      activateWorkspace();
      const detail = (event as CustomEvent<{ resetQuery?: boolean }>).detail;
      if (detail?.resetQuery) useSearchSession.getState().setQuery("");
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
    const onSwitchSidebarView = (event: Event) => {
      const view = (event as CustomEvent<{ view?: SidebarView }>).detail?.view;
      if (view === "search") onOpen(event);
      else if (view === "pages" || view === "outline") {
        activateWorkspace();
        if (useSearchSession.getState().open)
          useSearchSession.getState().closeSearch();
        if (view === "outline") closeNotebookAiIfFullscreen();
        setCurrentView(view);
        if (forceCollapseLeft) setLeftExpandOverride(true);
        if (inHistoryMode) exitHistoryView();
      }
    };
    const onWorkspaceActivate = () => onSettingsOpenChange(false);
    const onCloseSettings = () => onSettingsOpenChange(false);
    window.addEventListener("goose-note:open-search", onOpen);
    window.addEventListener(
      "goose-note:switch-sidebar-view",
      onSwitchSidebarView,
    );
    window.addEventListener(
      "goose-note:workspace-activate",
      onWorkspaceActivate,
    );
    window.addEventListener("goose-note:close-settings", onCloseSettings);
    return () => {
      window.removeEventListener("goose-note:open-search", onOpen);
      window.removeEventListener(
        "goose-note:switch-sidebar-view",
        onSwitchSidebarView,
      );
      window.removeEventListener(
        "goose-note:workspace-activate",
        onWorkspaceActivate,
      );
      window.removeEventListener("goose-note:close-settings", onCloseSettings);
    };
  }, [
    activeNotebookId,
    activePageId,
    forceCollapseLeft,
    inHistoryMode,
    scrollContainerRef,
    openSearchSession,
    setLeftExpandOverride,
    exitHistoryView,
    onSettingsOpenChange,
    workspaceSidebarCollapsed,
  ]);

  useEffect(() => {
    if (!sidebarOverlay) return;
    const onEscape = (event: KeyboardEvent) => {
      if (settingsOpen || useSearchSession.getState().open) return;
      if (!shouldDismissSidebarOverlay(event, document)) return;
      event.preventDefault();
      event.stopPropagation();
      closeSidebarOverlay();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [sidebarOverlay, settingsOpen, closeSidebarOverlay]);

  useSidebarEffects({
    activePageId,
    activeNotebookId,
    currentView,
    onSettingsTabChange,
    onOpenSettings: (tab) => {
      if (tab) onSettingsTabChange(tab);
      onSettingsOpenChange(true);
    },
  });
  return {
    ...input,
    settingsSidebarHost,
    setSettingsSidebarHost,
    searchSessionOpen,
    openSearchSession,
    searchShortcut,
    sidebarViewShortcut,
    historyActivePageId,
    exitHistoryView,
    inHistoryMode,
    restoreSidebarFocusRef,
    scrollAreaNode,
    setScrollAreaNode,
    scrollAreaHeight,
    setScrollAreaHeight,
    closeSidebarOverlay,
  };
}
