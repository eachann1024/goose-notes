import { FavoritesSection } from "./FavoritesSection";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarTree } from "./SidebarTree";
import { SettingsDialog } from "./SettingsDialog";
import { TrashList } from "./TrashList";
import type { Page } from "@/types";
import { getPageTitle } from "@/lib/page-title";
import { useDeletePageWithUndo } from "@/hooks/useDeletePageWithUndo";
import { toast } from "sonner";

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
  const {
    createPage,
    pages,
    activePageId,
    setActivePage,
    updatePage,
  } = usePages();
  const { activeNotebookId, notebooks } = useNotebooks();
  const { uiFontSize: _ignored } = useSettings();
  const { deletePageWithUndo } = useDeletePageWithUndo();
  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;
  const isLocalFolder = activeNotebook?.source === "local-folder";

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
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renamePageId, setRenamePageId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);

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
          void deletePageWithUndo(activePageId);
        }
      }
    },
    [activePageId, currentView, deletePageWithUndo],
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
    const notebook = activeNotebookId
      ? useNotebooks.getState().notebooks[activeNotebookId]
      : undefined;
    const isLocalFolder = notebook?.source === "local-folder";

    if (isLocalFolder) {
      usePages
        .getState()
        .createLocalPage(undefined, activeNotebookId || undefined);
      return;
    }

    const existingBlankPage = Object.values(pages).find((p) => {
      const matchWorkspace = p.workspaceId === (activeNotebookId || "default");
      const notTrashed = !p.trashedAt;
      const title = getPageTitle(p);
      const isBlankTitle = !title || title === "无标题" || title.trim() === "";
      const isBlankContent = isEmptyContent(p.content);
      return matchWorkspace && notTrashed && isBlankTitle && isBlankContent;
    });

    if (existingBlankPage) {
      setActivePage(existingBlankPage.id);
      // 即使是复用空白页，也要聚焦标题
      window.dispatchEvent(new CustomEvent("goose-note:focus-editor-start"));
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

  const openRenameDialog = useCallback((page: Page) => {
    if (!page || page.trashedAt) return;
    setRenamePageId(page.id);
    setRenameValue(getPageTitle(page));
    setRenameDialogOpen(true);
  }, []);

  const confirmRename = useCallback(() => {
    if (!renamePageId) return;
    const page = pages[renamePageId];
    const nextTitle = renameValue.trim();
    if (!page || nextTitle === "") return;

    const newContent = JSON.parse(JSON.stringify(page.content));
    if (!newContent || newContent.type !== "doc") {
      newContent.type = "doc";
      newContent.content = [];
    }
    if (
      newContent.content?.[0]?.type === "heading" &&
      newContent.content[0].attrs?.level === 1
    ) {
      newContent.content[0].content = nextTitle
        ? [{ type: "text", text: nextTitle }]
        : undefined;
    } else {
      newContent.content = [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: nextTitle }],
        },
        ...(newContent.content || []),
      ];
    }

    const notebook = useNotebooks.getState().notebooks[page.workspaceId];
    const isLocalFolder = notebook?.source === "local-folder";
    if (isLocalFolder && page.localFilePath && (window as any).gooseFs) {
      const dir = page.localFilePath.replace(/[^\/\\]+$/, "");
      const extMatch = page.localFilePath.match(/\.(md|markdown)$/i);
      const ext = extMatch ? extMatch[0] : ".md";
      const rawTitle = nextTitle.replace(/[\/\\]/g, "-").trim();
      const safeTitle = rawTitle.replace(/\.(md|markdown)$/i, "");
      const newPath = `${dir}${safeTitle}${ext}`;

      if ((window as any).gooseFs.exists(newPath)) {
        toast.error("重命名失败：目标文件已存在");
        return;
      }
      if (newPath !== page.localFilePath) {
        const renamed = (window as any).gooseFs.rename(
          page.localFilePath,
          newPath,
        );
        if (!renamed) {
          toast.error("重命名失败：文件系统错误");
          return;
        }
        updatePage(renamePageId, {
          content: newContent,
          localFilePath: newPath,
        });
      } else {
        updatePage(renamePageId, { content: newContent });
      }
    } else {
      updatePage(renamePageId, { content: newContent });
    }

    setRenameDialogOpen(false);
    setRenamePageId(null);
  }, [pages, renamePageId, renameValue, updatePage]);

  if (currentView === "trash") {
    return (
      <div
        ref={sidebarRef}
        className={cn(
          "pb-0 bg-background dark:bg-background backdrop-blur-[1px] h-full flex flex-col relative",
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
      className="group flex items-center justify-between px-4 py-1.5 text-xs font-medium text-muted-foreground/60 dark:text-muted-foreground/50 hover:text-foreground dark:hover:text-foreground/85 cursor-pointer transition-colors"
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
        "pb-0 bg-background dark:bg-background backdrop-blur-[1px] h-full flex flex-col relative group/sidebar",
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <SidebarHeader
          onCreatePage={handleCreatePage}
          onSearch={handleSearch}
        />

        <FavoritesSection
          itemHeight={itemHeight}
          onRequestRename={openRenameDialog}
        />

        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto">
          <div className="mt-1">
            <SectionHeader
              title={isLocalFolder ? "本地文件夹" : "页面"}
              collapsed={pagesCollapsed}
              onToggle={() => setPagesCollapsed(!pagesCollapsed)}
            />
          </div>
          {!pagesCollapsed && (
            <div className="px-2 pb-10">
              <SidebarTree
                activeNotebookId={activeNotebookId}
                width={width - 16}
                rowHeight={rowHeight}
                itemHeight={itemHeight}
                viewportHeight={scrollAreaHeight}
                onCreatePage={handleCreatePage}
                onRequestRename={openRenameDialog}
              />
            </div>
          )}
        </div>

        <SidebarFooter
          onOpenTrash={() => {
            setActivePage(null);
            setCurrentView("trash");
          }}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (!open) {
            setRenamePageId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px] z-[100]">
          <DialogHeader>
            <DialogTitle>
              {isLocalFolder ? "重命名文件" : "重命名页面"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isLocalFolder ? "输入新的文件名称" : "输入新的页面名称"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="grid gap-2">
              <Label htmlFor="rename-input">新名称</Label>
              <Input
                id="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    confirmRename();
                  } else if (e.key === "Escape") {
                    setRenameDialogOpen(false);
                  }
                }}
                autoFocus
                placeholder={isLocalFolder ? "输入新的文件名称" : "输入新的页面名称"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={confirmRename}
              disabled={!renamePageId || renameValue.trim() === ""}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
