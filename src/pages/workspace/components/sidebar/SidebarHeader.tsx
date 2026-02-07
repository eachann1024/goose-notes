import { NotebookSwitcher } from "./NotebookSwitcher";

interface SidebarHeaderProps {
  currentView: "pages" | "trash";
  isSettingsOpen: boolean;
  onSwitchToPages: () => void;
  onSwitchToTrash: () => void;
  onOpenSettings: () => void;
  dragGuide: {
    direction: "left" | "right";
    mode: "sort" | "nest-pending" | "nest-ready";
  } | null;
}

function nodeHasVisibleContent(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;

  const typedNode = node as {
    text?: unknown;
    content?: unknown;
    type?: unknown;
  };

  if (
    typeof typedNode.text === "string" &&
    typedNode.text.trim().length > 0
  ) {
    return true;
  }

  const children = Array.isArray(typedNode.content) ? typedNode.content : [];
  if (children.some((child) => nodeHasVisibleContent(child))) {
    return true;
  }

  if (
    typedNode.type === "doc" ||
    typedNode.type === "paragraph" ||
    typedNode.type === "heading" ||
    typedNode.type === "text" ||
    typedNode.type === "hardBreak"
  ) {
    return false;
  }

  return typeof typedNode.type === "string" && typedNode.type.length > 0;
}

export function SidebarHeader({
  currentView,
  isSettingsOpen,
  onSwitchToPages,
  onSwitchToTrash,
  onOpenSettings,
  dragGuide,
}: SidebarHeaderProps) {
  const pages = usePages((state) => state.pages);
  const activeNotebookId = useNotebooks((state) => state.activeNotebookId);
  const hasAnyPageContent = useMemo(
    () =>
      Object.values(pages).some((page) => {
        if (page.trashedAt) return false;
        if (activeNotebookId && page.workspaceId !== activeNotebookId) {
          return false;
        }
        return nodeHasVisibleContent(page.content);
      }),
    [pages, activeNotebookId],
  );
  const PagesCapsuleIcon = hasAnyPageContent
    ? LucideIcons.FileText
    : LucideIcons.File;

  const topTabButtonClass =
    "h-8 flex-1 rounded-full p-0 transition-all duration-200 inline-flex items-center justify-center";
  const settingsShortcut = formatShortcut("Mod+,");

  return (
    <>
      <div className="pl-1 pr-2 h-12 flex items-center shrink-0">
        <div className="flex items-center w-full">
          <NotebookSwitcher />
        </div>
      </div>

      <div className="pl-1 pr-2 pb-2 pt-0">
        <div className="relative overflow-hidden rounded-full bg-[#F1F1F1] dark:bg-[hsl(var(--goose-selected-bg)/0.88)] px-1 py-1 flex items-center gap-1">
          {dragGuide && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-full border border-primary/35 bg-[hsl(var(--background)/0.98)] px-3 text-[11px] font-medium text-primary shadow-sm backdrop-blur-sm">
              {dragGuide.mode === "sort" && "左移继续排序，右移可放入子页面"}
              {dragGuide.mode === "nest-pending" && "保持右移 0.5 秒后松手，放入子页面"}
              {dragGuide.mode === "nest-ready" && "松手即可放入目标页面"}
            </div>
          )}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    topTabButtonClass,
                    !isSettingsOpen && currentView === "pages"
                      ? "bg-[var(--goose-interactive-selected)] text-foreground shadow-[inset_0_0_0_1px_var(--goose-interactive-selected-border)]"
                      : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
                  )}
                  aria-label="页面"
                  onClick={onSwitchToPages}
                >
                  <PagesCapsuleIcon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">页面</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    topTabButtonClass,
                    !isSettingsOpen && currentView === "trash"
                      ? "bg-[var(--goose-interactive-selected)] text-foreground shadow-[inset_0_0_0_1px_var(--goose-interactive-selected-border)]"
                      : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
                  )}
                  aria-label="垃圾箱"
                  onClick={onSwitchToTrash}
                >
                  <LucideIcons.Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">垃圾箱</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    topTabButtonClass,
                    isSettingsOpen
                      ? "bg-[var(--goose-interactive-selected)] text-foreground shadow-[inset_0_0_0_1px_var(--goose-interactive-selected-border)]"
                      : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
                  )}
                  aria-label="设置"
                  onClick={onOpenSettings}
                >
                  <LucideIcons.Settings className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center gap-2">
                  <span>设置</span>
                  <span className="text-[11px] text-muted-foreground">
                    {settingsShortcut}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}
