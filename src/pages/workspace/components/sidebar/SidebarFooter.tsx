import * as LucideIcons from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatShortcut } from "@/lib/utils";
import { useSettings } from "@/stores/useSettings";
import { useSidebarView } from "@/stores/useSidebarView";
import { NotebookSwitcher } from "./NotebookSwitcher";

export interface SidebarFooterProps {
  currentView: "pages" | "trash" | "outline";
  isSettingsOpen: boolean;
  hideTrash?: boolean;
  onSwitchToTrash: () => void;
  onOpenSettings: () => void;
}

/**
 * 侧栏底栏：笔记本切换 + 快捷控制条。
 * 窗口置顶仍在 Electron 顶栏（布局 C），此处不重复挂 Pin。
 */
export function SidebarFooter({
  currentView,
  isSettingsOpen,
  hideTrash = false,
  onSwitchToTrash,
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
    <div className="mt-auto shrink-0 border-t border-border/60 bg-[hsl(var(--goose-shell-bg))] pt-2">
      <div className="pr-2">
        <NotebookSwitcher
          currentView={currentView}
          isSettingsOpen={isSettingsOpen}
          hideTrash={hideTrash}
          onSwitchToTrash={onSwitchToTrash}
          onOpenSettings={onOpenSettings}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-1 px-2 pb-2 pt-1">
        <div className="flex items-center gap-0.5">
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
          {!hideTrash ? (
            <button
              type="button"
              className={cn(
                btnClass,
                !isSettingsOpen && currentView === "trash" && activeClass,
              )}
              aria-label="垃圾箱"
              aria-pressed={!isSettingsOpen && currentView === "trash"}
              data-active={
                !isSettingsOpen && currentView === "trash" ? "true" : "false"
              }
              onClick={onSwitchToTrash}
            >
              <LucideIcons.Trash2 className="h-4 w-4" />
            </button>
          ) : null}
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
    </div>
  );
}
