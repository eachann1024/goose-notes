import React, { forwardRef } from "react";
import { cn } from "@/components/editor/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/editor/ui/tooltip";
import { Kbd } from "@/components/editor/ui/kbd";
import { isSlashMenuDivider, type SlashMenuItem } from "./blocknoteSlashItems";
import { useCustomSlashNavigation } from "./useCustomSlashNavigation";

interface CustomSlashMenuProps {
  items: SlashMenuItem[];
  loadingState: "loading-initial" | "loading" | "loaded";
  selectedIndex: number | undefined;
  onItemClick?: (item: SlashMenuItem) => void;
}

const CustomSlashMenu = forwardRef<HTMLDivElement, CustomSlashMenuProps>(
  ({ items, selectedIndex: externalIndex, onItemClick }, _ref) => {
    const {
      selectedIndex,
      setSelectedIndex,
      containerRef,
      suppressItemHover,
      ignoreMouseEnterUntilRef,
      selectItem,
    } = useCustomSlashNavigation(items, externalIndex, onItemClick);

    if (items.length === 0) {
      return null;
    }

    const lite = __GOOSE_EDITOR_COMPACT__;
    const needsTooltip = items.some(
      (item) =>
        !isSlashMenuDivider(item) && item.disabled && item.disabledReason,
    );

    const list = (
      <div className={cn("flex flex-col", lite ? "gap-0" : "gap-0.5")}>
        {items.map((item, index) => {
          if (isSlashMenuDivider(item)) {
            return (
              <div
                key={`divider-${index}`}
                className={cn(
                  "mx-2 h-px bg-border/60",
                  lite ? "my-0.5" : "my-1",
                )}
              />
            );
          }

          const itemKey = item.title ?? index;
          const button = (
            <button
              type="button"
              data-index={index}
              data-goose-slash-item={lite ? "" : undefined}
              data-goose-slash-selected={
                lite && index === selectedIndex ? "true" : undefined
              }
              className={cn(
                "relative flex h-auto w-full items-center justify-start text-left outline-none transition-colors whitespace-normal",
                lite
                  ? "min-h-[34px] rounded-lg px-2 py-1.5 shadow-none hover:bg-[var(--goose-interactive-hover)] hover:text-[hsl(var(--foreground))]"
                  : "min-h-[40px] rounded-[var(--radius-notion-slash-item)] px-2.5 py-2 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] hover:[&_*]:text-[var(--goose-interactive-hover-fg)]",
                index === selectedIndex
                  ? lite
                    ? "bg-transparent text-[hsl(var(--foreground))]"
                    : "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
                  : "bg-transparent",
              )}
              onMouseEnter={() => {
                if (suppressItemHover) return;
                if (Date.now() < ignoreMouseEnterUntilRef.current) return;
                setSelectedIndex(index);
              }}
              onClick={() => selectItem(index)}
            >
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-notion-slash-icon)] bg-[var(--goose-block-subtle-bg)]",
                  lite ? "mr-2 h-6 w-6" : "mr-2.5 h-7 w-7",
                )}
              >
                {item.icon ? (
                  <span
                    className={cn(
                      "text-xs",
                      index === selectedIndex
                        ? lite
                          ? "text-[hsl(var(--foreground))]"
                          : "text-[var(--goose-interactive-selected-fg)]"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.icon}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    T
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "truncate font-medium",
                    lite ? "text-[11px]" : "text-[12px]",
                    item.disabled
                      ? "text-muted-foreground"
                      : index === selectedIndex
                        ? lite
                          ? "text-[hsl(var(--foreground))]"
                          : "text-[var(--goose-interactive-selected-fg)]"
                        : "text-foreground",
                  )}
                >
                  {item.title}
                </div>
                {item.description && (
                  <div
                    className={cn(
                      "mt-0.5 truncate text-muted-foreground",
                      lite ? "text-[9px]" : "text-[10px]",
                    )}
                  >
                    {item.description}
                  </div>
                )}
              </div>

              {item.badge && (
                <Kbd
                  shortcut={item.badge}
                  className="ml-2 h-4 border-transparent bg-transparent px-0 text-[9px] text-muted-foreground shadow-none"
                />
              )}
            </button>
          );

          if (!item.disabled || !item.disabledReason) {
            return <React.Fragment key={itemKey}>{button}</React.Fragment>;
          }
          return (
            <Tooltip key={itemKey}>
              <TooltipTrigger asChild>
                <span className="block w-full cursor-not-allowed">
                  {button}
                </span>
              </TooltipTrigger>
              <TooltipContent editorContext side="right">
                {item.disabledReason}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );

    return (
      <div
        className="inline-flex max-h-[inherit] min-h-0 flex-col overflow-visible bg-transparent"
        data-notion-slash-root="true"
        {...(lite ? { "data-goose-slash-lite": "true" } : {})}
      >
        <div
          data-notion-slash-surface="true"
          className={cn(
            "goose-editor-inline-context-ui z-50 flex h-auto min-h-0 min-w-0 flex-col overflow-hidden border border-[hsl(var(--goose-menu-border))] bg-[hsl(var(--goose-menu-surface))] text-popover-foreground",
            !lite &&
              "shadow-[0_14px_34px_rgba(15,23,42,0.16),0_2px_8px_rgba(15,23,42,0.08)]",
            lite
              ? "max-h-[inherit] w-[248px] rounded-xl p-1"
              : "max-h-[20rem] w-[280px] rounded-[var(--radius-notion-slash)] p-1.5",
          )}
        >
          <div
            ref={containerRef}
            data-notion-slash-scroll={lite ? "" : undefined}
            className={cn(
              "min-h-0 overflow-y-auto overscroll-contain",
              lite ? "max-h-[inherit] pb-2" : "max-h-[20rem] pb-1",
              suppressItemHover && "pointer-events-none",
            )}
          >
            {needsTooltip ? (
              <TooltipProvider delayDuration={600}>{list}</TooltipProvider>
            ) : (
              list
            )}
          </div>
        </div>
      </div>
    );
  },
);

CustomSlashMenu.displayName = "CustomSlashMenu";
export { CustomSlashMenu };
