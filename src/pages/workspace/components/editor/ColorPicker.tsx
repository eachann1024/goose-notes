import { Editor } from "@tiptap/react";
import * as LucideIcons from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  editor: Editor;
}

interface PositionState {
  top: number;
  left: number;
  showAbove: boolean;
}

const TOOLTIP_STYLE =
  "rounded-lg border border-black/20 bg-[#1f1f1f] px-2 py-1.5 text-white shadow-[0_6px_14px_rgba(0,0,0,0.28)] dark:border-white/25";

const TEXT_COLORS = [
  { name: "默认", color: "inherit" },
  { name: "灰色", color: "#787774" },
  { name: "褐色", color: "#9F6B53" },
  { name: "橙色", color: "#D9730D" },
  { name: "黄色", color: "#CB912F" },
  { name: "绿色", color: "#448361" },
  { name: "蓝色", color: "#337EA9" },
  { name: "紫色", color: "#9065B0" },
  { name: "粉色", color: "#C14C8A" },
  { name: "红色", color: "#D44C47" },
];

const HIGHLIGHT_COLORS = [
  { name: "无背景", color: "transparent" },
  { name: "灰色背景", color: "#F1F1EF" },
  { name: "褐色背景", color: "#F4EEEE" },
  { name: "橙色背景", color: "#FBECDD" },
  { name: "黄色背景", color: "#FBF3DB" },
  { name: "绿色背景", color: "#EDF3EC" },
  { name: "蓝色背景", color: "#EBF5FE" },
  { name: "紫色背景", color: "#F5F3F8" },
  { name: "粉色背景", color: "#FAF1F5" },
  { name: "红色背景", color: "#FDEBEC" },
];

export function ColorPicker({ editor }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState<PositionState>({ top: 0, left: 0, showAbove: true });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeAnimTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (closeAnimTimeoutRef.current) {
        clearTimeout(closeAnimTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (closeAnimTimeoutRef.current) clearTimeout(closeAnimTimeoutRef.current);

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const panelHeight = 280;
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      const showAbove = spaceAbove >= panelHeight || spaceAbove > spaceBelow;

      setPosition({
        top: showAbove ? rect.top - 8 : rect.bottom + 8,
        left: rect.left + rect.width / 2,
        showAbove,
      });
    }

    setIsMounted(true);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      return;
    }

    if (closeAnimTimeoutRef.current) clearTimeout(closeAnimTimeoutRef.current);
    closeAnimTimeoutRef.current = setTimeout(() => {
      setIsMounted(false);
    }, 180);
  }, [isOpen]);

  const panelContent = isMounted ? (
    <div
      className={cn(
        "fixed z-[20000] w-fit rounded-[10px] border border-border/75 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-[1px] transition-all duration-180 ease-out dark:border-white/20",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: position.showAbove
          ? isOpen
            ? "translate(-50%, -100%)"
            : "translate(-50%, calc(-100% - 4px))"
          : isOpen
            ? "translate(-50%, 0)"
            : "translate(-50%, -4px)",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col gap-1">
        <div className="px-1 pt-0.5 text-[12px] font-semibold text-muted-foreground">
          文本颜色
        </div>
        <div className="grid grid-cols-[repeat(5,1.75rem)] gap-1 px-1">
          {TEXT_COLORS.map((item) => (
            <Button
              key={item.color}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-[6px] border border-transparent p-0 hover:bg-accent hover:text-accent-foreground",
                editor.isActive("textStyle", { color: item.color }) &&
                  "bg-accent border-primary/20 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]",
              )}
              onClick={() => {
                if (item.color === "inherit") {
                  editor.chain().focus().unsetColor().run();
                } else {
                  editor.chain().focus().setColor(item.color).run();
                }
              }}
            >
              <div
                className="font-serif text-[34px] leading-none scale-[0.56]"
                style={{
                  color: item.color === "inherit" ? undefined : item.color,
                }}
              >
                A
              </div>
            </Button>
          ))}
        </div>

        <div className="my-1 border-t border-border/60" />

        <div className="px-1 text-[12px] font-semibold text-muted-foreground">
          背景颜色
        </div>
        <div className="grid grid-cols-[repeat(5,1.75rem)] gap-1 px-1 pb-0.5">
          {HIGHLIGHT_COLORS.map((item) => (
            <Button
              key={item.color}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-[6px] border border-transparent p-0 hover:border-border/80 hover:bg-accent/40",
                editor.isActive("highlight", { color: item.color }) &&
                  "border-primary ring-1 ring-primary/25",
              )}
              onClick={() => {
                if (item.color === "transparent") {
                  editor.chain().focus().unsetHighlight().run();
                } else {
                  editor
                    .chain()
                    .focus()
                    .setHighlight({ color: item.color })
                    .run();
                }
              }}
            >
              <div
                className="h-5 w-5 rounded-[4px] border border-border/20"
                style={{ backgroundColor: item.color }}
              />
            </Button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            type="button"
            ref={buttonRef}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md p-0 text-foreground/90 transition-colors hover:bg-muted"
            aria-label="颜色选择"
          >
            <LucideIcons.Palette className="h-[15px] w-[15px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className={TOOLTIP_STYLE}>
          <div className="text-[12px] font-medium leading-none text-white">
            颜色
          </div>
        </TooltipContent>
      </Tooltip>
      <Portal>{panelContent}</Portal>
    </div>
  );
}
