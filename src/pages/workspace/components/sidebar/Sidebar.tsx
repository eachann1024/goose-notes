import { FavoritesSection } from "./FavoritesSection";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarTree } from "./SidebarTree";
import { SettingsDialog } from "./SettingsDialog";
import { TrashList } from "./TrashList";
import type { Page } from "@/types";
import { getPageTitle } from "@/lib/page-title";
import { useDeletePageWithUndo } from "@/hooks/useDeletePageWithUndo";
import { useTabs } from "@/stores/useTabs";
import { toast } from "sonner";

const SIDEBAR_MIN_WIDTH = UToolsAdapter.isUTools ? 180 : 120;

type SidebarView = "pages" | "trash";
type SidebarDragGuideMode = "sort" | "nest-pending" | "nest-ready";

interface SidebarDragGuideState {
  direction: "left" | "right";
  mode: SidebarDragGuideMode;
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  disableResize?: boolean;
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

export function Sidebar({ className, disableResize = false }: SidebarProps) {
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
  const trashItemHeight = Math.max(itemHeight + 20, 48);

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
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renamePageId, setRenamePageId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);
  const [dragGuide, setDragGuide] = useState<SidebarDragGuideState | null>(null);

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
    const handleOpenSettings = () => {
      setShowSettings(true);
    };

    window.addEventListener("goose-note:open-settings", handleOpenSettings);
    return () => {
      window.removeEventListener("goose-note:open-settings", handleOpenSettings);
    };
  }, []);

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
      useTabs.getState().openTab(existingBlankPage.id);
      // 即使是复用空白页，也要聚焦标题
      window.dispatchEvent(new CustomEvent("goose-note:focus-editor-start"));
    } else {
      const newId = createPage(undefined, activeNotebookId || DEFAULT_NOTEBOOK);
      useTabs.getState().openTab(newId);
    }
  };

  const startResizing = (startX: number) => {
    if (disableResize) return;
    setIsResizing(true);

    const startWidth = width;

    const updateWidth = (nextClientX: number) => {
      const newWidth = startWidth + nextClientX - startX;
      setWidth(Math.max(SIDEBAR_MIN_WIDTH, Math.min(480, newWidth)));
    };

    const onMouseMove = (event: MouseEvent) => {
      updateWidth(event.clientX);
    };

    const onPointerMove = (event: PointerEvent) => {
      updateWidth(event.clientX);
    };

    const stopResizing = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", stopResizing);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", stopResizing);
      document.removeEventListener("pointercancel", stopResizing);
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", stopResizing);
    document.addEventListener("pointercancel", stopResizing);
    document.body.style.cursor = "col-resize";
  };

  const handleResizeMouseDown = (event: React.MouseEvent) => {
    if (disableResize) return;
    event.preventDefault();
    startResizing(event.clientX);
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disableResize || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    startResizing(event.clientX);
  };

  const renderResizeEdge = () =>
    disableResize ? null : (
      <div
        className="absolute top-0 h-full z-[60] cursor-col-resize group/resize"
        style={{ right: "-8px", width: "16px" }}
        onMouseDown={handleResizeMouseDown}
        onPointerDown={handleResizePointerDown}
        role="separator"
      >
        <div
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150",
            isResizing ? "opacity-100" : "opacity-0 group-hover/resize:opacity-100",
          )}
          style={{
            width: "2px",
            height: "100%",
            marginLeft: "-1px",
            borderRadius: 0,
            background: isResizing
              ? "var(--workspace-resize-line-active)"
              : "var(--workspace-resize-line)",
          }}
        />
      </div>
    );

  const handleSearch = () => {
    window.dispatchEvent(new CustomEvent("goose-note:open-search"));
  };

  const openRenameDialog = useCallback((page: Page) => {
    if (!page || page.trashedAt) return;
    setRenamePageId(page.id);
    setRenameValue(getPageTitle(page));
    setRenameDialogOpen(true);
  }, []);

  const confirmRename = useCallback(async () => {
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
      const gooseFs = (window as any).gooseFs as GooseFs;
      const dir = page.localFilePath.replace(/[^\/\\]+$/, "");
      const extMatch = page.localFilePath.match(/\.(md|markdown)$/i);
      const ext = extMatch ? extMatch[0] : ".md";
      const rawTitle = nextTitle.replace(/[\/\\]/g, "-").trim();
      const safeTitle = rawTitle.replace(/\.(md|markdown)$/i, "");
      const newPath = `${dir}${safeTitle}${ext}`;

      const exists = gooseFs.existsAsync
        ? await gooseFs.existsAsync(newPath)
        : gooseFs.exists(newPath);
      if (exists) {
        toast.error("重命名失败：目标文件已存在");
        return;
      }
      if (newPath !== page.localFilePath) {
        const renamedResult = gooseFs.rename(page.localFilePath, newPath);
        const renamed =
          renamedResult instanceof Promise
            ? await renamedResult
            : renamedResult;
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

  const SectionHeader = ({
    title,
    onSearch,
    onCreate,
    createTitle,
  }: {
    title: string;
    onSearch: () => void;
    onCreate: () => void;
    createTitle: string;
  }) => {
    const searchShortcut = formatShortcut("Mod+K");
    const createShortcut =
      createTitle === "新建页面" ? formatShortcut("Mod+N") : null;

    return (
      <div className="group flex items-center justify-between pl-2 pr-2 py-1.5 text-xs font-medium text-[hsl(var(--goose-nav-title))] dark:text-[hsl(var(--goose-nav-title))]">
        <span>{title}</span>
        <TooltipProvider delayDuration={0}>
          <div className="flex items-center gap-1 text-muted-foreground dark:text-muted-foreground/70">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="搜索"
                  onClick={onSearch}
                >
                  <LucideIcons.Search className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>搜索</span>
                  <span className="text-[11px] text-muted-foreground">
                    {searchShortcut}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={createTitle}
                  onClick={onCreate}
                >
                  <LucideIcons.Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>{createTitle}</span>
                  {createShortcut && (
                    <span className="text-[11px] text-muted-foreground">
                      {createShortcut}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    );
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
      {renderResizeEdge()}

      <div className="flex-1 flex flex-col overflow-hidden rounded-[inherit]">
        <SidebarHeader
          currentView={currentView}
          isSettingsOpen={showSettings}
          dragGuide={dragGuide}
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
          onOpenSettings={() => setShowSettings(true)}
        />

        {currentView === "pages" ? (
          <>
            <FavoritesSection
              width={width - 12}
              rowHeight={rowHeight}
              itemHeight={itemHeight}
              onCreatePage={handleCreatePage}
              onRequestRename={openRenameDialog}
            />

            <div className="flex-1 min-h-0 flex flex-col">
              <div className="mt-1 shrink-0">
                <SectionHeader
                  title={isLocalFolder ? "本地文件夹" : "页面"}
                  onSearch={handleSearch}
                  onCreate={handleCreatePage}
                  createTitle={isLocalFolder ? "新建文件" : "新建页面"}
                />
              </div>
              <div ref={scrollAreaRef} className="pl-1 pr-2 flex-1 min-h-0">
                <SidebarTree
                  activeNotebookId={activeNotebookId}
                  width={width - 12}
                  rowHeight={rowHeight}
                  itemHeight={itemHeight}
                  viewportHeight={scrollAreaHeight}
                  onCreatePage={handleCreatePage}
                  onRequestRename={openRenameDialog}
                  onDragGuideChange={setDragGuide}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            <TrashList showHeader={false} itemHeight={trashItemHeight} />
          </div>
        )}
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
                    void confirmRename();
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
              onClick={() => {
                void confirmRename();
              }}
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
