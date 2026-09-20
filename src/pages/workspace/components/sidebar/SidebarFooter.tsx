import * as LucideIcons from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWindowAlwaysOnTop } from "@/hooks/useWindowAlwaysOnTop";
import { isElectronHost } from "@/lib/local-vault";
import { cn, formatShortcut } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";
import { useSidebarView } from "@/stores/useSidebarView";

export interface SidebarFooterProps {
  isSettingsOpen: boolean;
  onOpenSettings: () => void;
}

export function SidebarFooter({
  isSettingsOpen,
  onOpenSettings,
}: SidebarFooterProps) {
  const theme = useSettings((s) => s.theme);
  const toggleDarkMode = useSettings((s) => s.toggleDarkMode);
  const toggleSidebarShortcut = useSettings(
    (s) => s.appShortcuts.toggleSidebar,
  );
  const sidebarCollapsed = useSidebarView((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useSidebarView(
    (s) => s.toggleSidebarCollapsed,
  );
  const { alwaysOnTop, toggleAlwaysOnTop } = useWindowAlwaysOnTop();
  const toggleSidebarShortcutLabel = toggleSidebarShortcut
    ? formatShortcut(toggleSidebarShortcut)
    : "";
  const themeLabel =
    theme === "system" ? "跟随系统" : theme === "dark" ? "深色模式" : "浅色模式";
  const ThemeIcon =
    theme === "system"
      ? LucideIcons.Laptop
      : theme === "dark"
        ? LucideIcons.Moon
        : LucideIcons.Sun;

  const btnClass =
    "sidebar-footer-control inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md p-0 text-muted-foreground transition-[background-color,color,box-shadow,transform] hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)] active:translate-y-px active:bg-[var(--goose-interactive-selected)] active:text-[var(--goose-interactive-selected-fg)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--goose-interactive-selected-fg)] [&_svg]:block";
  const activeClass =
    "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]";

  return (
    <div className="mt-auto flex items-center justify-between gap-1 bg-[hsl(var(--goose-shell-bg))] px-2 pb-0 pt-1">
      <div className="flex items-center gap-1">
        {isElectronHost ? (
          <TooltipProvider delayDuration={600}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(btnClass, alwaysOnTop && activeClass)}
                  aria-label={alwaysOnTop ? "取消窗口置顶" : "窗口置顶"}
                  aria-pressed={alwaysOnTop}
                  data-active={alwaysOnTop ? "true" : "false"}
                  onClick={toggleAlwaysOnTop}
                >
                  <LucideIcons.Pin
                    className={cn(
                      "h-4 w-4",
                      alwaysOnTop &&
                        "fill-[var(--goose-interactive-selected-fg)]",
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span>{alwaysOnTop ? "取消窗口置顶" : "窗口置顶"}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider delayDuration={600}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(btnClass, sidebarCollapsed && activeClass)}
                  aria-label="收起侧栏"
                  aria-pressed={sidebarCollapsed}
                  data-active={sidebarCollapsed ? "true" : "false"}
                  onClick={toggleSidebarCollapsed}
                >
                  <LucideIcons.PanelLeft className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="flex items-center gap-2">
                  <span>收起侧栏</span>
                  {toggleSidebarShortcutLabel ? (
                    <span className="text-[11px] text-muted-foreground">
                      {toggleSidebarShortcutLabel}
                    </span>
                  ) : null}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider delayDuration={600}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(btnClass)}
                aria-label={`主题：${themeLabel}，点击切换`}
                data-active="false"
                onClick={toggleDarkMode}
              >
                <ThemeIcon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span>{themeLabel}（点击切换）</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <button
        type="button"
        className={cn(btnClass, isSettingsOpen && activeClass)}
        aria-label="设置"
        aria-pressed={isSettingsOpen}
        data-active={isSettingsOpen ? "true" : "false"}
        onClick={onOpenSettings}
      >
        <LucideIcons.Settings className="h-4 w-4" />
      </button>
    </div>
  );
}
