import { useBlockNoteEditor, useActiveStyles } from "@blocknote/react";
import { useEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Portal } from "@/components/ui/portal";
import { cn } from "@/lib/utils";

interface PositionState {
  top: number;
  left: number;
  showAbove: boolean;
}

/** BlockNote 命名颜色 —— 必须与 BlockNote CSS 中定义的颜色名一致 */
const TEXT_COLORS = [
  { name: "默认", color: "default" },
  { name: "灰色", color: "gray" },
  { name: "褐色", color: "brown" },
  { name: "红色", color: "red" },
  { name: "橙色", color: "orange" },
  { name: "黄色", color: "yellow" },
  { name: "绿色", color: "green" },
  { name: "蓝色", color: "blue" },
  { name: "紫色", color: "purple" },
  { name: "粉色", color: "pink" },
];

const HIGHLIGHT_COLORS = [
  { name: "无背景", color: "default" },
  { name: "灰色背景", color: "gray" },
  { name: "褐色背景", color: "brown" },
  { name: "红色背景", color: "red" },
  { name: "橙色背景", color: "orange" },
  { name: "黄色背景", color: "yellow" },
  { name: "绿色背景", color: "green" },
  { name: "蓝色背景", color: "blue" },
  { name: "紫色背景", color: "purple" },
  { name: "粉色背景", color: "pink" },
];

/** 颜色名 → CSS 颜色值（用于预览，与 BlockNote COLORS_DEFAULT 保持一致） */
const COLOR_PREVIEW: Record<string, string> = {
  gray: "#9b9a97",
  brown: "#64473a",
  red: "#e03e3e",
  orange: "#d9730d",
  yellow: "#dfab01",
  green: "#4d6461",
  blue: "#0b6e99",
  purple: "#6940a5",
  pink: "#ad1a72",
};

const BG_PREVIEW: Record<string, string> = {
  gray: "#ebeced",
  brown: "#e9e5e3",
  red: "#fbe4e4",
  orange: "#f6e9d9",
  yellow: "#fbf3db",
  green: "#ddedea",
  blue: "#ddebf1",
  purple: "#eae4f2",
  pink: "#f4dfeb",
};

export function FormattingToolbarColorPicker() {
  const editor = useBlockNoteEditor();
  const activeStyles = useActiveStyles();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState<PositionState>({
    top: 0,
    left: 0,
    showAbove: true,
  });
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeAnimTimeoutRef.current) clearTimeout(closeAnimTimeoutRef.current);
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

  const currentTextColor = activeStyles.textColor;
  const currentBgColor = activeStyles.backgroundColor;

  const isTextColorActive = currentTextColor && currentTextColor !== "default";
  const isBgColorActive =
    currentBgColor && currentBgColor !== "default";

  const panelContent = isMounted ? (
    <div
      className={cn(
        "fixed z-[20000] w-fit rounded-[10px] border border-border/75 bg-popover p-1 shadow-[0_8px_22px_hsl(var(--foreground)/0.08),0_1px_3px_hsl(var(--foreground)/0.05)] backdrop-blur-[1px] transition-all duration-180 ease-out dark:border-white/20",
        isOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      )}
      onMouseDown={(e) => e.preventDefault()}
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
                isTextColorActive && currentTextColor === item.color
                  ? "bg-accent border-primary/20 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]"
                  : ""
              )}
              onClick={() => {
                if (item.color === "default") {
                  editor.removeStyles({ textColor: true } as any);
                } else {
                  editor.addStyles({ textColor: item.color });
                }
              }}
            >
              <div
                className="font-serif text-[34px] leading-none scale-[0.56]"
                style={{
                  color:
                    item.color === "default"
                      ? undefined
                      : COLOR_PREVIEW[item.color],
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
                isBgColorActive && currentBgColor === item.color
                  ? "border-primary ring-1 ring-primary/25"
                  : ""
              )}
              onClick={() => {
                if (item.color === "default") {
                  editor.removeStyles({ backgroundColor: true } as any);
                } else {
                  editor.addStyles({ backgroundColor: item.color });
                }
              }}
            >
              <div
                className="h-5 w-5 rounded-[4px] border border-border/20"
                style={{
                  backgroundColor:
                    item.color === "default" ? "transparent" : BG_PREVIEW[item.color],
                }}
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
        <TooltipContent side="top" sideOffset={8}>
          <div className="text-[12px] font-medium leading-none">颜色</div>
        </TooltipContent>
      </Tooltip>
      <Portal>{panelContent}</Portal>
    </div>
  );
}
