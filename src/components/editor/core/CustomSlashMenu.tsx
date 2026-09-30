import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useExtension } from "@blocknote/react";
import { SuggestionMenu } from "@blocknote/core/extensions";
import { cn } from "@/components/editor/utils/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/editor/ui/tooltip";
import { Kbd } from "@/components/editor/ui/kbd";
import { Button } from "@/components/editor/ui/button";
import type { SlashMenuItem } from "./blocknoteSlashItems";

interface CustomSlashMenuProps {
  items: SlashMenuItem[];
  loadingState: "loading-initial" | "loading" | "loaded";
  selectedIndex: number | undefined;
  onItemClick?: (item: SlashMenuItem) => void;
}

const CustomSlashMenu = forwardRef<HTMLDivElement, CustomSlashMenuProps>(
  ({ items, selectedIndex: externalIndex, onItemClick }, _ref) => {
    const [selectedIndex, setSelectedIndex] = useState(externalIndex ?? 0);
    const [showHint, setShowHint] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const suggestionMenu = useExtension(SuggestionMenu);
    const wrapScrollRef = useRef<null | "top" | "bottom">(null);

    const selectableIndexes = useMemo(
      () =>
        items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => (item as any).type !== "divider" && !item.disabled)
          .map(({ index }) => index),
      [items],
    );

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item && (item as any).type !== "divider" && !item.disabled) {
          // 必须经由 props.onItemClick 调用，让 SuggestionMenuWrapper 的
          // onItemClickCloseMenu 先执行 closeMenu() + clearQuery()，再回调
          // item.onItemClick()。直接调用 item.onItemClick() 会绕过 closeMenu/
          // clearQuery，导致查询词残留进块内容、菜单不关闭。
          onItemClick?.(item);
        }
      },
      [items, onItemClick],
    );

    useEffect(() => {
      if (items.length === 0) {
        // Notion-style: close menu immediately when no matches
        const timer = setTimeout(() => suggestionMenu?.closeMenu(), 0);
        return () => clearTimeout(timer);
      }
      if (selectableIndexes.length === 0) {
        setSelectedIndex(0);
      } else if (externalIndex !== undefined && selectableIndexes.includes(externalIndex)) {
        setSelectedIndex(externalIndex);
      } else {
        setSelectedIndex(selectableIndexes[0]);
      }
      setShowHint(false);
    }, [items, selectableIndexes, externalIndex, suggestionMenu]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      // 循环跳转：直接把菜单拉到顶/底，让用户看到完整边界
      if (wrapScrollRef.current === "bottom") {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
        wrapScrollRef.current = null;
        return;
      }
      if (wrapScrollRef.current === "top") {
        container.scrollTo({ top: 0, behavior: "smooth" });
        wrapScrollRef.current = null;
        return;
      }
      const selectedEl = container.querySelector(
        `[data-index="${selectedIndex}"]`,
      ) as HTMLElement | null;
      selectedEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [selectedIndex]);

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (!containerRef.current || !containerRef.current.isConnected) return;
        const target = e.target as HTMLElement | null;
        const inEditorScope = !!target?.closest(
          '.bn-editor, [data-content-type="blockNote"]',
        );
        if (!inEditorScope) return;
        if (!selectableIndexes.length) return;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          const pos = Math.max(selectableIndexes.indexOf(selectedIndex), 0);
          if (pos === 0) {
            // 循环到末尾，并把容器滚到底
            wrapScrollRef.current = "bottom";
            setSelectedIndex(selectableIndexes[selectableIndexes.length - 1]);
          } else {
            setSelectedIndex(selectableIndexes[pos - 1]);
          }
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          const pos = Math.max(selectableIndexes.indexOf(selectedIndex), 0);
          if (pos === selectableIndexes.length - 1) {
            // 循环到开头，并把容器滚到顶
            wrapScrollRef.current = "top";
            setSelectedIndex(selectableIndexes[0]);
          } else {
            setSelectedIndex(selectableIndexes[pos + 1]);
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          const validIndex = selectableIndexes.includes(selectedIndex)
            ? selectedIndex
            : selectableIndexes[0];
          selectItem(validIndex);
        }
      };
      window.addEventListener("keydown", handler, true);
      return () => window.removeEventListener("keydown", handler, true);
    }, [selectedIndex, selectItem, selectableIndexes]);

    if (items.length === 0) {
      return null;
    }

    return (
      <div className="workspace-shell bg-transparent rounded-[var(--radius-notion-slash)] overflow-hidden" data-notion-slash-root="true">
        <div
          data-notion-slash-surface="true"
          className="z-50 w-[280px] rounded-[var(--radius-notion-slash)] border border-border/75 bg-popover p-1.5 text-popover-foreground shadow-[0_14px_34px_rgba(15,23,42,0.16),0_2px_8px_rgba(15,23,42,0.08)]"
        >
          <div ref={containerRef} className="max-h-[320px] overflow-y-auto overscroll-contain">
            <TooltipProvider delayDuration={600}>
              <div className="flex flex-col gap-0.5">
                {items.map((item, index) => {
                  if ((item as any).type === "divider") {
                    return (
                      <div key={`divider-${index}`} className="mx-2 my-1 h-px bg-border/60" />
                    );
                  }

                  const button = (
                    <Button
                      key={item.title ?? index}
                      variant="ghost"
                      data-index={index}
                      className={cn(
                        "relative flex h-auto min-h-[40px] w-full items-center justify-start rounded-[var(--radius-notion-slash-item)] px-2.5 py-2 text-left outline-none transition-colors whitespace-normal",
                        index === selectedIndex ? "bg-accent" : "bg-transparent",
                      )}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => selectItem(index)}
                    >
                      <div className="mr-2.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-notion-slash-icon)] bg-[var(--goose-block-subtle-bg)]">
                        {item.icon ? (
                          <span
                            className={cn(
                              "text-xs",
                              index === selectedIndex ? "text-accent-foreground" : "text-muted-foreground",
                            )}
                          >
                            {item.icon}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">T</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "truncate text-[12px] font-medium",
                            item.disabled
                              ? "text-muted-foreground/55"
                              : index === selectedIndex
                                ? "text-accent-foreground"
                                : "text-foreground",
                          )}
                        >
                          {item.title}
                        </div>
                        {item.description && (
                          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                      </div>

                      {item.badge && (
                        <Kbd shortcut={item.badge} className="ml-2 h-4 border-transparent bg-transparent px-0 text-[9px] opacity-45 shadow-none" />
                      )}
                    </Button>
                  );

                  if (!item.disabled || !item.disabledReason) return button;
                  return (
                    <Tooltip key={item.title ?? index}>
                      <TooltipTrigger asChild>
                        <span className="block w-full cursor-not-allowed">{button}</span>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.disabledReason}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </div>
        </div>
      </div>
    );
  },
);

CustomSlashMenu.displayName = "CustomSlashMenu";
export { CustomSlashMenu };
