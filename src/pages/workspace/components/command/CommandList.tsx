import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn, formatShortcut } from "@/lib/utils";
import type { CommandSuggestionItem } from "./commandItems";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface CommandItem extends CommandSuggestionItem {
  title: string;
  description: string;
  icon: any;
  hint?: {
    title: string;
    items: Array<{ key: string; description: string }>;
  };
  command?: (params: { editor: any; range: any }) => void | Promise<void>;
}

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void | Promise<void>;
  editor: any;
  placement?: "top" | "bottom";
  title?: string;
  subtitle?: string;
  onBack?: () => void;
}

export const CommandList = forwardRef((props: CommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTopPlacement = props.placement === "top";

  const selectableIndexes = useMemo(
    () =>
      props.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.type !== "divider" && !item.disabled)
        .map(({ index }) => index),
    [props.items],
  );

  const selectItem = useCallback(
    async (index: number) => {
      const item = props.items[index];
      if (item && item.type !== "divider" && !item.disabled) {
        await props.command(item);
      }
    },
    [props],
  );

  useEffect(() => {
    setSelectedIndex(selectableIndexes[0] ?? 0);
    setShowHint(false);
  }, [props.items, selectableIndexes]);

  useEffect(() => {
    const selectedItem = props.items[selectedIndex];
    if (!selectedItem?.hint) {
      setShowHint(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowHint(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedIndex, props.items]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selectedEl = container.querySelector(
      `[data-index="${selectedIndex}"]`,
    ) as HTMLElement | null;
    selectedEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (!selectableIndexes.length) return false;

        if (event.key === "ArrowUp") {
          event.preventDefault();
          const currentPosition = Math.max(selectableIndexes.indexOf(selectedIndex), 0);
          const nextPosition =
            (currentPosition - 1 + selectableIndexes.length) % selectableIndexes.length;
          setSelectedIndex(selectableIndexes[nextPosition]);
          return true;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const currentPosition = Math.max(selectableIndexes.indexOf(selectedIndex), 0);
          const nextPosition = (currentPosition + 1) % selectableIndexes.length;
          setSelectedIndex(selectableIndexes[nextPosition]);
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          void selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }),
    [selectedIndex, selectItem, selectableIndexes],
  );

  if (props.items.length === 0) {
    return (
      <div className="z-50 w-[280px] rounded-[18px] border border-border/75 bg-popover/98 p-2.5 text-sm text-muted-foreground shadow-[0_14px_34px_rgba(15,23,42,0.16),0_2px_8px_rgba(15,23,42,0.08)]">
        暂无匹配动作
      </div>
    );
  }

  const selectedItem = props.items[selectedIndex];

  return (
    <div
      className={cn(
        "relative flex gap-2 animate-in fade-in zoom-in-95",
        isTopPlacement ? "items-end slide-in-from-bottom-2" : "items-start slide-in-from-top-2",
      )}
    >
      <div
        ref={containerRef}
        className="z-50 w-[280px] rounded-[18px] border border-border/75 bg-popover/98 p-1.5 text-popover-foreground shadow-[0_14px_34px_rgba(15,23,42,0.16),0_2px_8px_rgba(15,23,42,0.08)]"
      >
        <div className="flex items-start gap-2 px-2 py-1.5 select-none">
          {props.onBack && (
            <button
              type="button"
              className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={props.onBack}
              aria-label="返回上一级"
            >
              ←
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-foreground/90">{props.title ?? "基础模块"}</div>
            {props.subtitle && (
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{props.subtitle}</div>
            )}
          </div>
        </div>

        <div className="flex max-h-[320px] flex-col gap-[1px] overflow-y-auto scrollbar-hide px-1 pb-1">
          <TooltipProvider delayDuration={0}>
            {props.items.map((item, index) => {
              if (item.type === "divider") {
                return (
                  <div
                    key={`divider-${index}`}
                    className="mx-1 my-1.5 h-px rounded-full bg-gradient-to-r from-transparent via-border to-transparent"
                  />
                );
              }

              const Icon = item.icon;
              const button = (
                <Button
                  key={item.title ?? index}
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-index={index}
                  disabled={item.disabled}
                  className={cn(
                    "relative flex h-auto min-h-[40px] w-full items-center justify-start rounded-[10px] px-2.5 py-2 text-left outline-none transition-colors whitespace-normal",
                    item.disabled
                      ? "cursor-not-allowed text-muted-foreground/55 hover:bg-transparent"
                      : index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "cursor-pointer text-foreground/80 hover:bg-accent/55",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    void selectItem(index);
                  }}
                >
                  <div className="mr-2.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-muted/65">
                    {Icon ? (
                      <Icon
                        className={cn(
                          "h-[15px] w-[15px] stroke-[1.7]",
                          item.disabled
                            ? "text-muted-foreground/45"
                            : index === selectedIndex
                              ? "text-accent-foreground"
                              : "text-muted-foreground",
                        )}
                      />
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
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.description}</div>
                    )}
                  </div>

                  {item.shortcut && (
                    <div className="ml-2 text-[9px] font-mono opacity-45">{formatShortcut(item.shortcut)}</div>
                  )}
                  {item.children?.length ? (
                    <div className="ml-2 text-[11px] text-muted-foreground/70">→</div>
                  ) : null}
                </Button>
              );

              if (!item.disabled || !item.disabledReason) {
                return button;
              }

              return (
                <Tooltip key={item.title ?? index}>
                  <TooltipTrigger asChild>
                    <span className="block w-full cursor-not-allowed">{button}</span>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.disabledReason}</TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </div>

      {showHint && selectedItem?.hint && (
        <div className="absolute left-[288px] top-0 z-[60] flex h-fit w-[200px] flex-col gap-3 rounded-xl border border-border/75 bg-muted p-3 text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.1)] transition-all animate-in fade-in slide-in-from-left-1">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            {selectedItem.icon && <selectedItem.icon className="h-4 w-4 text-primary" />}
            <span className="text-[12px] font-bold text-primary">{selectedItem.hint.title}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {selectedItem.hint.items.map((hint: any, i: number) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="flex items-center gap-1">
                  {hint.key.split(" ").map((keyPart: string, keyIndex: number) => {
                    const isOperator = keyPart === "+" || keyPart === "/";
                    if (isOperator) {
                      return (
                        <span key={keyIndex} className="text-[9px] opacity-40">
                          {keyPart}
                        </span>
                      );
                    }
                    return (
                      <kbd
                        key={keyIndex}
                        className="flex h-4 min-w-[16px] items-center justify-center rounded-[4px] border border-border bg-background px-1 text-[10px] font-mono font-medium text-foreground shadow-sm"
                      >
                        {formatShortcut(keyPart)}
                      </kbd>
                    );
                  })}
                </span>
                <span className="px-0.5 text-[10px] leading-tight text-muted-foreground">
                  {hint.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
