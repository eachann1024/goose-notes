import { FavoritesSection } from "./FavoritesSection";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarTree } from "./SidebarTree";
import { SettingsDialog } from "./SettingsDialog";
import { TrashList } from "./TrashList";
import { useTabs } from "@/stores/useTabs";
import type { EditorRef } from "../editor/Editor";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useSidebarItemHeight } from "./hooks/useSidebarItemHeight";
import { useSidebarEffects } from "./hooks/useSidebarEffects";
import { SidebarResizeEdge } from "./SidebarResizeEdge";
import { SidebarSectionHeader } from "./SidebarSectionHeader";
import { SidebarRenameDialog, useRenameDialog } from "./SidebarRenameDialog";
import { SidebarOutline } from "./SidebarOutline";

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
        className,
      )}
      style={{ width, overflow: "visible" }}
    >
      {!disableResize && (
        <SidebarResizeEdge
          isResizing={isResizing}
          onMouseDown={handleResizeMouseDown}
          onPointerDown={handleResizePointerDown}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden rounded-[inherit]">
        <SidebarHeader
          dragGuide={dragGuide}
          selectedPageId={selectedPageId}
          onOpenPinnedPage={() => {
            setCurrentView("pages");
            setShowSettings(false);
          }}
        />

        {currentView === "trash" ? (
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
                  onSwitchToPages={() => setCurrentView("pages")}
                  onSwitchToOutline={() => setCurrentView("outline")}
                />
              </div>
              {currentView === "pages" ? (
                <div ref={scrollAreaRef} className="pl-0 pr-[9px] flex-1 min-h-0 flex flex-col">
                  <SidebarTree
                    activeNotebookId={activeNotebookId}
                    selectedPageId={selectedPageId}
                    width={width - SIDEBAR_CONTENT_WIDTH_OFFSET}
                    rowHeight={rowHeight}
                    itemHeight={itemHeight}
                    viewportHeight={scrollAreaHeight}
                    onCreatePage={handleCreatePage}
                    onDragGuideChange={setDragGuide}
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
          setCurrentView("pages");
          setShowSettings(false);
          setActivePage(null);
        }}
        onSwitchToTrash={() => {
          setCurrentView("trash");
          setShowSettings(false);
          setActivePage(null);
        }}
        onSwitchToOutline={() => {
          setCurrentView("outline");
          setShowSettings(false);
        }}
        onOpenSettings={() => setShowSettings(true)}
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
