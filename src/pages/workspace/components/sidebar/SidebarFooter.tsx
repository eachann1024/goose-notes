interface SidebarFooterProps {
  currentView: "pages" | "trash" | "outline";
  isSettingsOpen: boolean;
  onSwitchToPages: () => void;
  onSwitchToTrash: () => void;
  onOpenSettings: () => void;
}

export function SidebarFooter({
  currentView,
  isSettingsOpen,
  onSwitchToPages,
  onSwitchToTrash,
  onOpenSettings,
}: SidebarFooterProps) {
  const tabButtonClass =
    "h-8 flex-1 rounded-full p-0 transition-all duration-200 inline-flex items-center justify-center";

  return (
    <div className="pl-0 pr-[9px] pb-2 pt-1 mt-auto bg-[hsl(var(--goose-shell-bg))]">
      <div className="relative overflow-hidden rounded-full bg-[#F1F1F1] dark:bg-[hsl(var(--goose-selected-bg)/0.88)] px-1 py-1 flex items-center gap-1">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  tabButtonClass,
                  !isSettingsOpen && currentView === "pages"
                    ? "bg-[var(--goose-interactive-selected)] text-foreground"
                    : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
                )}
                aria-label="页面"
                onClick={onSwitchToPages}
              >
                <LucideIcons.FileText className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">页面</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  tabButtonClass,
                  !isSettingsOpen && currentView === "trash"
                    ? "bg-[var(--goose-interactive-selected)] text-foreground"
                    : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
                )}
                aria-label="垃圾箱"
                onClick={onSwitchToTrash}
              >
                <LucideIcons.Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">垃圾箱</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  tabButtonClass,
                  isSettingsOpen
                    ? "bg-[var(--goose-interactive-selected)] text-foreground"
                    : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
                )}
                aria-label="设置"
                onClick={onOpenSettings}
              >
                <LucideIcons.Settings className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">设置</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
