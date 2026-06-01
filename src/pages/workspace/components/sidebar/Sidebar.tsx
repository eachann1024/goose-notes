import { FavoritesSection } from "./FavoritesSection";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarTree } from "./SidebarTree";
import { SidebarMainTree } from "./main-tree/SidebarMainTree";
import { SettingsDialog } from "./SettingsDialog";
import { TrashList } from "./TrashList";
import { useTabs } from "@/stores/useTabs";
import { useSidebarView } from "@/stores/useSidebarView";
import type { EditorRef } from "@/components/editor/core/Editor";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useSidebarItemHeight } from "./hooks/useSidebarItemHeight";
import { useSidebarEffects } from "./hooks/useSidebarEffects";
import { SidebarResizeEdge } from "./SidebarResizeEdge";
import { SidebarSectionHeader } from "./SidebarSectionHeader";
import { SidebarRenameDialog, useRenameDialog } from "./SidebarRenameDialog";
import { SidebarOutline } from "./SidebarOutline";
import { HistoryVersionList } from "../history/HistoryView";
import { useHistoryView } from "@/stores/useHistoryView";

const SIDEBAR_SIDE_GAP_LEFT = 0;
const SIDEBAR_SIDE_GAP_RIGHT = 9;
const SIDEBAR_CONTENT_WIDTH_OFFSET = SIDEBAR_SIDE_GAP_LEFT + SIDEBAR_SIDE_GAP_RIGHT;

type SidebarView = "pages" | "trash" | "outline";
type SidebarDragGuideMode = "sort" | "nest-pending" | "nest-ready";

interface SidebarDragGuideState {
  direction: "left" | "right";
  mode: SidebarDragGuideMode;
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  disableResize?: boolean;
  selectedPageId?: string | null;
  editorRef?: React.RefObject<EditorRef | null>;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  isAiPageOpen?: boolean;
}

export function Sidebar({
  className,
  disableResize = false,
  selectedPageId,
  editorRef,
  scrollContainerRef,
  isAiPageOpen = false,
}: SidebarProps) {
  const { activePageId, setActivePage, createPage, createLocalPage } = usePages();
  const { activeNotebookId, notebooks } = useNotebooks();
  const { openInCurrentTab } = useTabs();
  const setExpanded = useSidebarView((s) => s.setExpanded);
  const sidebarCollapsed = useSidebarView((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSidebarView((s) => s.toggleSidebarCollapsed);
  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;
  const isLocalFolder = activeNotebook?.source === "local-folder";

  const itemHeight = useSidebarItemHeight();
  const rowHeight = itemHeight + 1;
  const trashItemHeight = Math.max(itemHeight + 20, 48);

  const { width, isResizing, handleResizeMouseDown, handleResizePointerDown } =
    useSidebarResize({ disableResize });

  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<SidebarView>("pages");
  const [dragGuide, setDragGuide] = useState<SidebarDragGuideState | null>(null);

  // 历史模式：临时整体替换 Sidebar 中段（页面树/大纲），但 Header/Footer 与
  // currentView/scrollAreaRef 等 state 保持，退出后页面树原状回到上次的滚动与选中。
  const historyActivePageId = useHistoryView((s) => s.active);
  const exitHistoryView = useHistoryView((s) => s.exit);
  const inHistoryMode =
    !!historyActivePageId && historyActivePageId === activePageId;

  const sidebarRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);

  const {
    renameDialogOpen,
    setRenameDialogOpen,
    renameValue,
    setRenameValue,
    renamePageId,
    confirmRename,
  } = useRenameDialog();

  useSidebarEffects({
    activePageId,
    currentView,
    isAiPageOpen,
    onAiPageOpenWithOutline: () => setCurrentView("pages"),
    onOpenSettings: () => setShowSettings(true),
  });

  useEffect(() => {
    if (!scrollAreaRef.current) return;
    const updateHeight = () => {
      const height = scrollAreaRef.current?.clientHeight ?? 0;
      setScrollAreaHeight(height);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(scrollAreaRef.current);
    return () => observer.disconnect();
  }, []);

  const handleCreatePage = () => {
    if (!activeNotebookId) return;
    if (isLocalFolder) {
      void createLocalPage(undefined, activeNotebookId);
      return;
    }
    const newPageId = createPage(undefined, activeNotebookId);
    openInCurrentTab(newPageId);
    window.dispatchEvent(new CustomEvent("goose-note:focus-editor-start"));
  };

  const handleSearch = () => {
    window.dispatchEvent(new CustomEvent("goose-note:open-search"));
  };

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "pb-0 bg-[hsl(var(--goose-shell-bg))] h-full flex flex-col relative group/sidebar",
        "transition-[width,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        sidebarCollapsed && "pointer-events-none",
        className,
      )}
      style={{
        width: sidebarCollapsed ? 0 : width,
        minWidth: sidebarCollapsed ? 0 : undefined,
        opacity: sidebarCollapsed ? 0 : 1,
        overflow: sidebarCollapsed ? "hidden" : "visible",
      }}
      aria-hidden={sidebarCollapsed}
    >
      {!disableResize && !sidebarCollapsed && (
        <SidebarResizeEdge
          isResizing={isResizing}
          onMouseDown={handleResizeMouseDown}
          onPointerDown={handleResizePointerDown}
        />
      )}

      {/* 原生壳 titlebar 让位区：红绿灯右侧放折叠按钮，其余空白可拖动窗口。
          浏览器/uTools 下由 CSS 整体隐藏（见 index.css [data-sidebar-titlebar]）。 */}
      <div
        data-sidebar-titlebar
        data-window-drag
        className="absolute left-0 right-0 top-0 z-20 flex items-center"
        style={{
          height: "var(--goose-titlebar-h, 0px)",
          paddingLeft: "calc(var(--goose-titlebar-left, 0px) - 14px)",
        }}
      >
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-no-window-drag
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-muted-foreground/80 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-foreground"
                onClick={toggleSidebarCollapsed}
                aria-label="收起侧栏"
              >
                <LucideIcons.PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="flex items-center gap-2">
                <span>收起侧栏</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatShortcut("Mod+B")}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden rounded-[inherit]">
        <SidebarHeader
          dragGuide={dragGuide}
          selectedPageId={selectedPageId}
          onOpenPinnedPage={() => {
            setCurrentView("pages");
            setShowSettings(false);
          }}
        />

        {inHistoryMode ? (
          <HistoryVersionList />
        ) : currentView === "trash" ? (
          <div className="flex-1 overflow-hidden">
            <TrashList showHeader={false} itemHeight={trashItemHeight} />
          </div>
        ) : (
          <>
            <FavoritesSection
              width={width - SIDEBAR_CONTENT_WIDTH_OFFSET}
              rowHeight={rowHeight}
              itemHeight={itemHeight}
              onCreatePage={handleCreatePage}
            />

            <div className="flex-1 min-h-0 flex flex-col">
              <div className="mt-1 shrink-0">
                <SidebarSectionHeader
                  title={isLocalFolder ? "本地文件夹" : "页面"}
                  onSearch={handleSearch}
                  onCreate={handleCreatePage}
                  createTitle={isLocalFolder ? "新建文件" : "新建页面"}
                  view={currentView}
                  onSwitchToPages={() => {
                    if (currentView === "pages" && activeNotebookId) {
                      setExpanded(activeNotebookId, []);
                    } else {
                      setCurrentView("pages");
                    }
                  }}
                  onSwitchToOutline={() => setCurrentView("outline")}
                />
              </div>
              {currentView === "pages" ? (
                <div ref={scrollAreaRef} className="pl-0 pr-[9px] flex-1 min-h-0 flex flex-col">
                  <SidebarMainTree
                    activeNotebookId={activeNotebookId}
                    selectedPageId={selectedPageId}
                    width={width - SIDEBAR_CONTENT_WIDTH_OFFSET}
                    rowHeight={rowHeight}
                    itemHeight={itemHeight}
                    viewportHeight={scrollAreaHeight}
                    onCreatePage={handleCreatePage}
                  />
                </div>
              ) : (
                <div className="pl-0 pr-[9px] flex-1 min-h-0 overflow-hidden">
                  <SidebarOutline
                    editorRef={editorRef}
                    scrollContainerRef={scrollContainerRef}
                    pageId={activePageId}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <SidebarFooter
        currentView={currentView}
        isSettingsOpen={showSettings}
        onSwitchToPages={() => {
          if (inHistoryMode) exitHistoryView();
          setCurrentView("pages");
          setShowSettings(false);
          setActivePage(null);
        }}
        onSwitchToTrash={() => {
          if (inHistoryMode) exitHistoryView();
          setCurrentView("trash");
          setShowSettings(false);
          setActivePage(null);
        }}
        onSwitchToOutline={() => {
          if (inHistoryMode) exitHistoryView();
          setCurrentView("outline");
          setShowSettings(false);
        }}
        onOpenSettings={() => {
          if (inHistoryMode) exitHistoryView();
          setShowSettings(true);
        }}
      />

      <SidebarRenameDialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
        }}
        renamePageId={renamePageId}
        renameValue={renameValue}
        onRenameValueChange={setRenameValue}
        isLocalFolder={isLocalFolder}
        onConfirm={() => { void confirmRename(); }}
      />

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
