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

export function SidebarHeader({
  currentView,
  isSettingsOpen,
  onSwitchToPages,
  onSwitchToTrash,
  onOpenSettings,
  dragGuide,
}: SidebarHeaderProps) {
  const topTabButtonClass =
    "h-8 flex-1 rounded-full p-0 transition-all duration-200 inline-flex items-center justify-center";

  return (
    <>
      <div className="px-2 h-12 flex items-center shrink-0">
        <div className="flex items-center w-full">
          <NotebookSwitcher />
        </div>
      </div>

      <div className="px-2 pb-2 pt-0">
        <div className="mx-0.5 relative overflow-hidden rounded-full bg-[#F1F1F1] dark:bg-[hsl(var(--goose-selected-bg)/0.88)] px-1 py-1 flex items-center gap-1">
          {dragGuide && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-full border border-primary/35 bg-[hsl(var(--background)/0.98)] px-3 text-[11px] font-medium text-primary shadow-sm backdrop-blur-sm">
              {dragGuide.mode === "sort" && "左移继续排序，右移可放入子页面"}
              {dragGuide.mode === "nest-pending" && "保持右移 0.5 秒后松手，放入子页面"}
              {dragGuide.mode === "nest-ready" && "松手即可放入目标页面"}
            </div>
          )}
          <button
            type="button"
            className={cn(
              topTabButtonClass,
              !isSettingsOpen && currentView === "pages"
                ? "bg-white text-foreground shadow-[0_1px_4px_rgba(15,23,42,0.08)] dark:bg-[hsl(var(--goose-editor-bg))]"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="页面"
            onClick={onSwitchToPages}
          >
            <LucideIcons.FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(
              topTabButtonClass,
              !isSettingsOpen && currentView === "trash"
                ? "bg-white text-foreground shadow-[0_1px_4px_rgba(15,23,42,0.08)] dark:bg-[hsl(var(--goose-editor-bg))]"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="垃圾箱"
            onClick={onSwitchToTrash}
          >
            <LucideIcons.Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(
              topTabButtonClass,
              isSettingsOpen
                ? "bg-white text-foreground shadow-[0_1px_4px_rgba(15,23,42,0.08)] dark:bg-[hsl(var(--goose-editor-bg))]"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="设置"
            onClick={onOpenSettings}
          >
            <LucideIcons.Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
