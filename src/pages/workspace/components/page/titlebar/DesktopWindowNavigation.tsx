import * as GooseIcons from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTabs } from "@/stores/useTabs";

export const actionButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground transition-colors duration-150 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] aria-pressed:bg-[var(--goose-interactive-selected)] aria-pressed:text-[var(--goose-interactive-selected-fg)] aria-pressed:hover:bg-[var(--goose-interactive-selected)] aria-pressed:hover:text-[var(--goose-interactive-hover-fg)]";

export function DesktopWindowNavigation({
  canGoBack, canGoForward, onBeforeActivateTab, onToggleSidebar,
  toggleSidebarCollapsed, sidebarCollapsed, toggleSidebarShortcutLabel,
}: {
  canGoBack: boolean; canGoForward: boolean; onBeforeActivateTab?: () => void;
  onToggleSidebar?: () => void; toggleSidebarCollapsed: () => void;
  sidebarCollapsed: boolean; toggleSidebarShortcutLabel: string;
}) {
  return (
    <div
      className="electron-window-controls flex shrink-0 items-center gap-1"
      data-electron-no-drag
    >
      <TooltipProvider delayDuration={600}>
        {[
          { label: "后退", Icon: GooseIcons.ArrowLeft, disabled: !canGoBack, onClick: () => { onBeforeActivateTab?.(); useTabs.getState().goBackTabHistory(); } },
          { label: "前进", Icon: GooseIcons.ArrowRight, disabled: !canGoForward, onClick: () => { onBeforeActivateTab?.(); useTabs.getState().goForwardTabHistory(); } },
        ].map(({ label, Icon, disabled, onClick }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button type="button" className={cn(actionButtonClass, "disabled:pointer-events-none disabled:text-disabled")} aria-label={label} disabled={disabled} onClick={onClick}>
                <Icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={actionButtonClass}
              onClick={onToggleSidebar ?? toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
              aria-pressed={sidebarCollapsed}
            >
              <GooseIcons.PanelLeft className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>{sidebarCollapsed ? "展开侧栏" : "收起侧栏"}</span>
            {toggleSidebarShortcutLabel && (
              <span className="ml-2 text-[11px] text-muted-foreground">
                {toggleSidebarShortcutLabel}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

}
