import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FileText, NotebookText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiReferenceSuggestionItem } from "./referenceLookup";

interface AiReferenceListProps {
  items: AiReferenceSuggestionItem[];
  command: (item: AiReferenceSuggestionItem) => void | Promise<void>;
  placement?: "top" | "bottom";
}

export const AiReferenceList = forwardRef(
  (props: AiReferenceListProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuPlacement = props.placement ?? "bottom";

    const selectItem = useCallback(
      async (index: number) => {
        const item = props.items[index];
        if (!item) return;
        await props.command(item);
      },
      [props],
    );

    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    useEffect(() => {
      const selectedElement = containerRef.current?.querySelector(
        `[data-ai-reference-index="${selectedIndex}"]`,
      ) as HTMLElement | null;
      selectedElement?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
          if (!props.items.length) return false;

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((current) =>
              current <= 0 ? props.items.length - 1 : current - 1,
            );
            return true;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) =>
              current >= props.items.length - 1 ? 0 : current + 1,
            );
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
      [props.items.length, selectItem, selectedIndex],
    );

    return (
      <div
        className="workspace-shell bg-transparent"
        data-notion-slash-root="true"
        data-placement={menuPlacement}
      >
        {props.items.length > 0 ? (
          <div
            data-ai-reference-menu
            data-notion-slash-surface="true"
            data-placement={menuPlacement}
            className={cn(
              "z-50 w-[320px] overflow-hidden rounded-[var(--radius-notion-slash)] border border-border/75 bg-popover p-1.5 text-popover-foreground shadow-[0_14px_34px_rgba(15,23,42,0.16),0_2px_8px_rgba(15,23,42,0.08)]",
              menuPlacement === "top"
                ? "animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95"
                : "animate-in fade-in-0 slide-in-from-top-2 zoom-in-95",
            )}
          >
            <div className="px-2 py-1.5">
              <div className="text-[11px] font-semibold text-foreground/90">
                引用文件
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                仅作为这次 AI 提问的上下文
              </div>
            </div>

            <div
              ref={containerRef}
              className="flex max-h-[320px] flex-col gap-[1px] overflow-y-auto px-1 pb-1 scrollbar-hide"
            >
              {props.items.map((item, index) => {
                const Icon =
                  item.sourceType === "local-file" ? FileText : NotebookText;

                return (
                  <Button
                    key={`${item.pageId}-${index}`}
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-ai-reference-index={index}
                    className={cn(
                      "flex h-auto min-h-[46px] w-full items-center justify-start rounded-[var(--radius-notion-slash-item)] px-2.5 py-2 text-left outline-none transition-colors",
                      index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/85 hover:bg-accent/60",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      void selectItem(index);
                    }}
                  >
                    <div className="mr-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-notion-slash-icon)] border border-border/70 bg-muted/60">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-foreground">
                        {item.title}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);

AiReferenceList.displayName = "AiReferenceList";
