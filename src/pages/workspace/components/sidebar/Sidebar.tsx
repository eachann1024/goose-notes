import { FavoritesSection } from "./FavoritesSection";
import { SidebarDeleteDialog } from "./SidebarDeleteDialog";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarTree } from "./SidebarTree";
import { SettingsDialog } from "./SettingsDialog";
import { TrashList } from "./TrashList";
import { extractTitleFromContent } from "@/lib/content-text-extractor";

const SIDEBAR_MIN_WIDTH = UToolsAdapter.isUTools ? 180 : 120;

type SidebarView = "pages" | "trash";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const useItemHeight = () => {
  const { uiFontSize } = useSettings();

  return useMemo(() => {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    return Math.round(rootFontSize * 2);
  }, [uiFontSize]);
};

const isEmptyContent = (content: any) => {
  if (!content || content.type !== "doc") return true;
  if (!content.content || content.content.length === 0) return true;
  if (content.content.length === 1) {
    const first = content.content[0];
    if (
      first.type === "paragraph" &&
      (!first.content || first.content.length === 0)
    ) {
      return true;
    }
  }
  return false;
};

export function Sidebar({ className }: SidebarProps) {
  const { createPage, deletePage, pages, activePageId, setActivePage } =
    usePages();
  const { activeNotebookId } = useNotebooks();
  const { uiFontSize: _ignored } = useSettings();

  const itemHeight = useItemHeight();
  const rowHeight = itemHeight + 1;

  const DEFAULT_SIDEBAR_WIDTH = UToolsAdapter.isUTools ? 180 : 220;
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem("sidebar-width");
    return saved
      ? Math.max(SIDEBAR_MIN_WIDTH, Math.min(480, Number(saved)))
      : DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentView, setCurrentView] = useState<SidebarView>("pages");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleDeleteShortcut = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
        const target = e.target as HTMLElement;
        const isInEditor =
          target.closest(".ProseMirror") ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA";

        if (activePageId && !isInEditor && currentView === "pages") {
          e.preventDefault();
          setDeleteDialogOpen(true);
        }
      }
    },
    [activePageId, currentView],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleDeleteShortcut);
    return () => {
      document.removeEventListener("keydown", handleDeleteShortcut);
    };
  }, [handleDeleteShortcut]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("sidebar-width", String(width));
    }, 300);
    return () => clearTimeout(timer);
  }, [width]);

  const handleConfirmDelete = () => {
    if (activePageId) {
      deletePage(activePageId);
      setDeleteDialogOpen(false);
    }
  };

  const handleCreatePage = () => {
    const existingBlankPage = Object.values(pages).find((p) => {
      const matchWorkspace = p.workspaceId === (activeNotebookId || "default");
      const notTrashed = !p.trashedAt;
      const title = extractTitleFromContent(p.content);
      const isBlankTitle = !title || title === "无标题" || title.trim() === "";
      const isBlankContent = isEmptyContent(p.content);
      return matchWorkspace && notTrashed && isBlankTitle && isBlankContent;
    });

    if (existingBlankPage) {
      setActivePage(existingBlankPage.id);
    } else {
      createPage(undefined, activeNotebookId || DEFAULT_NOTEBOOK);
    }
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + e.clientX - startX;
      setWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(480, newWidth)));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
  };

  const handleSearch = () => {
    window.dispatchEvent(new CustomEvent("goose-note:open-search"));
  };

  if (currentView === "trash") {
    return (
      <div
        ref={sidebarRef}
        className={cn(
          "pb-0 border-r bg-muted/30 h-screen flex flex-col relative",
          className,
        )}
        style={{ width }}
      >
        <div
          className={cn(
            "absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50",
            isResizing && "bg-primary",
          )}
          onMouseDown={startResizing}
        />
        <TrashList onBack={() => setCurrentView("pages")} />
      </div>
    );
  }

  const SectionHeader = ({
    title,
    collapsed,
    onToggle,
  }: {
    title: string;
    collapsed: boolean;
    onToggle: () => void;
  }) => (
    <div
      className="group flex items-center justify-between px-4 py-1.5 text-xs font-medium text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
      onClick={onToggle}
    >
      <span>{title}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        {collapsed ? (
          <LucideIcons.ChevronRight className="h-3 w-3" />
        ) : (
          <LucideIcons.ChevronDown className="h-3 w-3" />
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "pb-0 bg-muted/30 h-screen flex flex-col relative group/sidebar",
        className,
      )}
      style={{
        width: width,
        borderRightWidth: "1px",
        borderRightColor: "hsl(var(--border))",
      }}
    >
      <div
        className={cn(
          "absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50",
          isResizing && "bg-primary",
        )}
        onMouseDown={startResizing}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <SidebarHeader
          onCreatePage={handleCreatePage}
          onSearch={handleSearch}
        />

        <FavoritesSection itemHeight={itemHeight} />

        <ScrollArea className="flex-1">
          <div className="mt-1">
            <SectionHeader
              title="页面"
              collapsed={pagesCollapsed}
              onToggle={() => setPagesCollapsed(!pagesCollapsed)}
            />
          </div>
          {!pagesCollapsed && (
            <div className="px-2 pb-20">
              <SidebarTree
                activeNotebookId={activeNotebookId}
                width={width - 16}
                rowHeight={rowHeight}
                itemHeight={itemHeight}
                onCreatePage={handleCreatePage}
              />
            </div>
          )}
        </ScrollArea>

        <SidebarFooter
          onOpenTrash={() => setCurrentView("trash")}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <SidebarDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={
          activePageId
            ? extractTitleFromContent(pages[activePageId]?.content) || "无标题"
            : ""
        }
      />
    </div>
  );
}
