import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn, formatShortcut } from "@/lib/utils";

interface CommandItem {
  type?: "divider" | "item";
  title: string;
  description: string;
  searchTerms?: string[];
  icon: any;
  shortcut?: string;
  hint?: {
    title: string;
    items: Array<{ key: string; description: string }>;
  };
  command: (params: { editor: any; range: any }) => void;
}

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  editor: any;
  placement?: "top" | "bottom";
}

export const CommandList = forwardRef((props: CommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTopPlacement = props.placement === "top";

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index];
      if (item && item.type !== "divider") {
        props.command(item);
      }
    },
    [props],
  );

  useEffect(() => {
    // 默认选中第一个不是分割线的项
    const firstSelectableIndex = props.items.findIndex(
      (item) => item.type !== "divider",
    );
    setSelectedIndex(firstSelectableIndex >= 0 ? firstSelectableIndex : 0);
    setShowHint(false);
  }, [props.items]);

  // 延迟显示 hint
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
    ) as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          let nextIndex =
            (selectedIndex - 1 + props.items.length) % props.items.length;
          // 跳过分割线
          while (
            props.items[nextIndex]?.type === "divider" &&
            nextIndex !== selectedIndex
          ) {
            nextIndex =
              (nextIndex - 1 + props.items.length) % props.items.length;
          }
          setSelectedIndex(nextIndex);
          return true;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          let nextIndex = (selectedIndex + 1) % props.items.length;
          // 跳过分割线
          while (
            props.items[nextIndex]?.type === "divider" &&
            nextIndex !== selectedIndex
          ) {
            nextIndex = (nextIndex + 1) % props.items.length;
          }
          setSelectedIndex(nextIndex);
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }),
    [props.items, selectItem, selectedIndex],
  );

  if (props.items.length === 0) {
    return null;
  }

  const selectedItem = props.items[selectedIndex];

  return (
    <div
      className={cn(
        "relative flex gap-2 animate-in fade-in zoom-in-95",
        isTopPlacement
          ? "items-end slide-in-from-bottom-2"
          : "items-start slide-in-from-top-2",
      )}
    >
      <div
        ref={containerRef}
        className="z-50 w-[240px] flex flex-col gap-1.5 p-1 rounded-xl border border-border/75 bg-popover/99 text-popover-foreground shadow-[0_10px_26px_rgba(15,23,42,0.12)] transition-all"
      >
        <div className="text-[10px] font-medium text-muted-foreground px-2 py-1 select-none">
          基本区块
        </div>

        <div className="flex flex-col gap-[1px] max-h-[260px] overflow-y-auto scrollbar-hide">
          {props.items.map((item, index) => {
            if (item.type === "divider") {
              return (
                <div
                  key={index}
                  className="h-[2px] bg-gradient-to-r from-transparent via-border to-transparent mx-1 my-1.5 rounded-full"
                />
              );
            }

            const Icon = item.icon;
            return (
              <button
                key={index}
                data-index={index}
                className={cn(
                  "relative flex cursor-pointer items-center rounded-[3px] px-2 py-1 min-h-[28px] text-sm outline-none w-full text-left transition-colors",
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-foreground/80",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectItem(index)}
              >
                <div className="flex items-center justify-center w-5 h-5 shrink-0 mr-2 overflow-hidden rounded-[3px] bg-transparent">
                  {item.title === "文本" || item.title === "Text" ? (
                    <span
                      className={cn(
                        "text-[15px] font-serif opacity-90 leading-none",
                        index === selectedIndex
                          ? "text-accent-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      T
                    </span>
                  ) : (
                    <Icon
                      className={cn(
                        "h-[14px] w-[14px] stroke-[1.5]",
                        index === selectedIndex
                          ? "text-accent-foreground"
                          : "text-muted-foreground",
                      )}
                    />
                  )}
                </div>

                <div className="flex flex-col flex-1 overflow-hidden">
                  <span
                    className={cn(
                      "font-medium truncate text-[12px]",
                      index === selectedIndex
                        ? "text-accent-foreground"
                        : "text-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                </div>

                {item.shortcut && (
                  <div className="text-[9px] opacity-40 font-mono ml-1.5 mr-2 min-w-[12px] text-right">
                    {item.shortcut}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showHint && selectedItem?.hint && (
        <div className="absolute left-[248px] top-0 z-[60] w-[200px] h-fit bg-muted/98 backdrop-blur-[1px] border border-border/75 text-foreground rounded-xl p-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] flex flex-col gap-3 transition-all animate-in fade-in slide-in-from-left-1">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            {selectedItem.icon && (
              <selectedItem.icon className="h-4 w-4 text-primary" />
            )}
            <span className="text-[12px] font-bold text-primary">
              {selectedItem.hint.title}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {selectedItem.hint.items.map((hint: any, i: number) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="flex items-center gap-1">
                  {hint.key.split(" ").map((k: string, ki: number) => {
                    const isOperator = k === "+" || k === "/";
                    if (isOperator) {
                      return (
                        <span key={ki} className="text-[9px] opacity-40">
                          {k}
                        </span>
                      );
                    }
                    return (
                      <kbd
                        key={ki}
                        className="min-w-[16px] h-4 px-1 flex items-center justify-center rounded-[4px] border border-border bg-background text-[10px] font-mono font-medium shadow-sm text-foreground"
                      >
                        {formatShortcut(k)}
                      </kbd>
                    );
                  })}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight px-0.5">
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
