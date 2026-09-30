import * as GooseIcons from "@/components/ui/icons";
interface SidebarSectionHeaderProps {
  title: string;
  eyebrow?: string;
  /** 不传则不渲染「新建」按钮（如 Electron 无仓库时） */
  onCreate?: () => void;
  createTitle?: string;
  onCollapseAll?: () => void;
}

export function SidebarSectionHeader({
  title,
  eyebrow,
  onCreate,
  createTitle,
  onCollapseAll,
}: SidebarSectionHeaderProps) {
  const createShortcut = formatShortcut(getFixedAppShortcuts().newNote);

  return (
    <div
      className="sidebar-section-label flex min-w-0 items-center gap-2 text-xs font-medium text-[hsl(var(--goose-nav-title))]"
      data-outline-header={eyebrow ? "true" : undefined}
    >
      <span className="sidebar-heading-copy">
        {eyebrow && <span className="sidebar-heading-eyebrow">{eyebrow}</span>}
        <span className="sidebar-heading-title" title={title}>
          {title}
        </span>
      </span>
      {(onCreate || onCollapseAll) && <TooltipProvider delayDuration={600}>
        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
          {onCollapseAll && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                  aria-label="收起全部页面"
                  onClick={onCollapseAll}
                >
                  <GooseIcons.ListCollapse className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">收起全部页面</TooltipContent>
            </Tooltip>
          )}
          {onCreate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                  aria-label={createTitle}
                  onClick={onCreate}
                >
                  <GooseIcons.Plus className="h-4 w-4" />
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
          )}
        </div>
      </TooltipProvider>}
    </div>
  );
}
