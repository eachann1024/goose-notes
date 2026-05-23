import { EmojiPicker } from "frimousse";
import * as LucideIcons from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface IconSelectorProps<T extends HTMLElement = HTMLElement> {
  value?: string;
  onChange: (icon: string | undefined) => void;
  children: React.ReactNode;
  portalContainerRef?: React.RefObject<T | null>;
  onFirstOpen?: () => void;
  emojiOnly?: boolean;
  scope?: "file" | "general";
}

// 精选 24 个线性图标，按语义分四组排布
// 书 / 文件 / 标记 / 时间与生活
const CURATED_ICONS: string[] = [
  "BookOpen",
  "Book",
  "BookMarked",
  "Notebook",
  "NotebookPen",
  "GraduationCap",
  "FileText",
  "Clipboard",
  "ClipboardList",
  "Folder",
  "Archive",
  "Inbox",
  "Bookmark",
  "Tag",
  "Flag",
  "Target",
  "Lightbulb",
  "Sparkles",
  "Calendar",
  "Clock",
  "Star",
  "Heart",
  "Coffee",
  "Briefcase",
];

// 保留给历史使用 emoji 的 tab（默认隐藏，需要时通过 emojiOnly 触发）
const GENERAL_EMOJIS = [
  "📝", "📄", "📋", "📌", "🎯", "💡", "⭐", "✨", "🔥", "📚",
  "📖", "📒", "🔖", "🏷️", "📂", "📁", "🗂️", "📅", "🧠", "🚩",
];

export function IconSelector<T extends HTMLElement = HTMLElement>({
  value,
  onChange,
  children,
  portalContainerRef,
  onFirstOpen,
  emojiOnly = false,
}: IconSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const portalContainer = portalContainerRef?.current ?? undefined;
  const hasOpenedRef = useRef(false);

  const filteredIcons = useMemo(
    () => CURATED_ICONS.filter((key) => key in (LucideIcons as any)),
    [],
  );

  useEffect(() => {
    if (open && !hasOpenedRef.current && onFirstOpen) {
      hasOpenedRef.current = true;
      onFirstOpen();
    }
  }, [open, onFirstOpen]);

  const handleRandomIcon = () => {
    if (emojiOnly) {
      const pool = GENERAL_EMOJIS;
      onChange(pool[Math.floor(Math.random() * pool.length)]);
      return;
    }
    if (filteredIcons.length === 0) return;
    onChange(filteredIcons[Math.floor(Math.random() * filteredIcons.length)]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0 rounded-[14px] shadow-[0_16px_36px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.06)] overflow-hidden bg-popover text-foreground border border-border/40"
        align="start"
        side="bottom"
        collisionPadding={10}
        container={portalContainer}
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="text-[12px] font-medium text-muted-foreground">
            {emojiOnly ? "选择表情" : "选择图标"}
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground/80 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-foreground"
                    aria-label="随机"
                    onClick={handleRandomIcon}
                  >
                    <LucideIcons.Shuffle className="h-3.5 w-3.5 stroke-[1.6]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">随机</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              type="button"
              className="inline-flex h-7 items-center justify-center rounded-[8px] px-2 text-[11.5px] text-muted-foreground/80 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-foreground"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              移除
            </button>
          </div>
        </div>

        {emojiOnly ? (
          <EmojiPicker.Root
            className="isolate flex h-[320px] flex-col bg-popover"
            onEmojiSelect={({ emoji }) => {
              onChange(emoji);
              setOpen(false);
            }}
            columns={8}
          >
            <EmojiPicker.Search
              placeholder="搜索表情"
              className="z-10 mx-3 mb-2 appearance-none rounded-[10px] bg-[var(--goose-interactive-hover)] px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none"
            />
            <EmojiPicker.Viewport className="relative flex-1 outline-hidden" style={{ scrollbarGutter: "auto" }}>
              <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                加载中…
              </EmojiPicker.Loading>
              <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                未找到表情
              </EmojiPicker.Empty>
              <EmojiPicker.List
                className="select-none px-3 pb-3"
                components={{
                  Emoji: ({ emoji, ...props }) => (
                    <button
                      className="flex size-8 items-center justify-center rounded-[8px] text-xl transition-colors hover:bg-[var(--goose-interactive-hover)] data-[active]:bg-[var(--goose-interactive-selected)]"
                      {...props}
                    >
                      {emoji.emoji}
                    </button>
                  ),
                }}
              />
            </EmojiPicker.Viewport>
          </EmojiPicker.Root>
        ) : (
          <ScrollArea className="bg-popover">
            <div className="px-3 pb-3 grid grid-cols-6 gap-1">
              {filteredIcons.map((iconName) => {
                const Icon = (LucideIcons as any)[iconName];
                const selected = value === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    className={cn(
                      "group/icon inline-flex aspect-square w-full items-center justify-center rounded-[10px] transition-all duration-150",
                      selected
                        ? "bg-[var(--goose-interactive-selected)] text-foreground"
                        : "text-muted-foreground/85 hover:bg-[var(--goose-interactive-hover)] hover:text-foreground",
                    )}
                    onClick={() => {
                      onChange(iconName);
                      setOpen(false);
                    }}
                    aria-label={iconName}
                    aria-pressed={selected}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] stroke-[1.6] transition-transform duration-150",
                        selected ? "scale-[1.05]" : "group-hover/icon:scale-[1.04]",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
