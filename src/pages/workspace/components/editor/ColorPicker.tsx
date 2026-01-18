import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  editor: Editor;
}

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
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const panelContent = isOpen ? (
    <div
      className="fixed p-2 z-[9999] rounded-md border border-border bg-popover shadow-md"
      style={{
        top: position.top,
        left: position.left,
        transform: "translate(-50%, -100%)",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <TooltipProvider delayDuration={0}>
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-muted-foreground px-1">
            文本颜色
          </div>
          <div className="grid grid-cols-5 gap-1">
            {TEXT_COLORS.map((item) => (
              <Tooltip key={item.color}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:bg-accent hover:text-accent-foreground",
                      editor.isActive("textStyle", { color: item.color }) &&
                        "bg-accent border-primary/20",
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
                      className="font-serif text-lg leading-none"
                      style={{
                        color:
                          item.color === "inherit" ? undefined : item.color,
                      }}
                    >
                      A
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {item.name}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="border-t border-border/50 my-1" />

          <div className="text-xs font-semibold text-muted-foreground px-1">
            背景颜色
          </div>
          <div className="grid grid-cols-5 gap-1">
            {HIGHLIGHT_COLORS.map((item) => (
              <Tooltip key={item.color}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border",
                      editor.isActive("highlight", { color: item.color }) &&
                        "border-primary ring-1 ring-primary/20",
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
                      className="h-6 w-6 rounded-sm border border-border/20"
                      style={{ backgroundColor: item.color }}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {item.name}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </TooltipProvider>
    </div>
  ) : null;

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-foreground"
        aria-label="颜色选择"
      >
        <LucideIcons.Palette className="h-4 w-4" />
      </Button>
      {createPortal(panelContent, document.body)}
    </div>
  );
}
