import { useSettings } from "@/stores/settings";

interface SidebarFooterProps {
  currentView: "pages" | "trash" | "outline";
  isSettingsOpen: boolean;
  onSwitchToPages: () => void;
  onSwitchToTrash: () => void;
  onSwitchToOutline: () => void;
  onOpenSettings: () => void;
}

export function SidebarFooter({
  currentView,
  isSettingsOpen,
  onSwitchToPages,
  onSwitchToTrash,
  onSwitchToOutline,
  onOpenSettings,
}: SidebarFooterProps) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const btnClass =
    "h-8 w-8 flex items-center justify-center rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent";
  const activeClass = "text-foreground bg-accent";

  return (
    <div className="px-2 pb-2 pt-1 mt-auto bg-[hsl(var(--goose-shell-bg))] flex items-center justify-between">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={cn(btnClass, isSettingsOpen && activeClass)}
          aria-label="设置"
          onClick={onOpenSettings}
        >
          <LucideIcons.Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={cn(
            btnClass,
            !isSettingsOpen && currentView === "trash" && activeClass,
          )}
          aria-label="垃圾箱"
          onClick={onSwitchToTrash}
        >
          <LucideIcons.Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={cn(
            btnClass,
            !isSettingsOpen && currentView === "outline" && activeClass,
          )}
          aria-label="大纲"
          onClick={onSwitchToOutline}
        >
          <LucideIcons.List className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        className={cn(btnClass)}
        aria-label={isDark ? "切换到亮色模式" : "切换到暗色模式"}
        onClick={toggleTheme}
      >
        {isDark ? (
          <LucideIcons.Sun className="h-4 w-4" />
        ) : (
          <LucideIcons.Moon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
